import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trackingId, tapeIntact, boxCrushed, isTampered, otpProvided, evidenceUrl } = body;

    if (!trackingId) {
      return NextResponse.json({ error: 'Tracking ID is required' }, { status: 400 });
    }

    const userId = req.headers.get('x-user-id');

    console.log(`[Dock Receive] Intake recorded for Tracking ID: ${trackingId}`, body);

    const isDamaged = !tapeIntact || boxCrushed || isTampered;

    // Check if it exists in RemovalShipment trackingNumber
    const removalShipments = await prisma.removalShipment.findMany({
      where: { trackingNumber: trackingId }
    });

    // Check if it exists in Order platformOrderId
    const order = await prisma.order.findUnique({
      where: { platformOrderId: trackingId }
    });

    // Resolve Manifest
    let manifest = await prisma.manifest.findUnique({
      where: { trackingId }
    });

    if (!manifest) {
      if (removalShipments.length === 0 && !order) {
        return NextResponse.json({
          error: 'This package/order is not in our shipment removal or order database and cannot be received.'
        }, { status: 404 });
      }

      const firstRemovalShipment = removalShipments[0] || null;
      const removalOrderId = firstRemovalShipment?.removalOrderId || null;

      // If no Manifest exists yet, we create the Manifest
      manifest = await prisma.manifest.create({
        data: {
          trackingId,
          status: 'EXPECTED',
          courierName: 'Unknown',
          removalOrderId,
          marketplace: 'AMAZON',
          expectedDate: new Date(),
        }
      });
      console.log(`[Dock Receive Dynamic Create] Created verified Manifest for Tracking ID: ${trackingId}`);
    }

    // Link shipments, order and generate return items
    let targetOrderId = order?.platformOrderId || null;

    if (removalShipments.length > 0) {
      const firstRemovalShipment = removalShipments[0];
      targetOrderId = firstRemovalShipment.removalOrderId;

      // Fetch raw order to get details
      const rawOrder = await prisma.aMZRemovalOrder.findFirst({
        where: { orderId: firstRemovalShipment.removalOrderId }
      });

      // 1. Create/upsert the operational Order
      const opOrder = await prisma.order.upsert({
        where: { platformOrderId: firstRemovalShipment.removalOrderId },
        update: {
          marketplace: 'AMAZON',
          manifestId: manifest.id,
          ...(rawOrder ? {
            purchaseDate: rawOrder.requestDate || new Date(),
            totalAmount: rawOrder.removalFee || null,
            fulfillmentChannel: 'AMAZON_REMOVAL'
          } : {})
        },
        create: {
          platformOrderId: firstRemovalShipment.removalOrderId,
          marketplace: 'AMAZON',
          manifestId: manifest.id,
          purchaseDate: rawOrder?.requestDate || new Date(),
          totalAmount: rawOrder?.removalFee || null,
          fulfillmentChannel: 'AMAZON_REMOVAL'
        }
      });

      // 2. Link all matching RemovalShipment rows to Manifest
      await prisma.removalShipment.updateMany({
        where: { trackingNumber: trackingId },
        data: { manifestId: manifest.id }
      });

      // 3. Dynamically create ReturnItem entries for expected SKU quantities
      for (const shipment of removalShipments) {
        const qty = shipment.shippedQuantity || 1;
        for (let i = 0; i < qty; i++) {
          const virtualLpn = `LPN-${trackingId}-${shipment.sku}-${i}`.toUpperCase();

          const rawReturn = await prisma.aMZCustomerReturn.findFirst({
            where: {
              orderId: shipment.removalOrderId,
              sku: shipment.sku
            }
          });

          await prisma.returnItem.upsert({
            where: { lpn: virtualLpn },
            update: {
              orderId: opOrder.platformOrderId,
              sku: shipment.sku,
              asin: rawReturn?.asin || null,
              fnsku: rawReturn?.fnsku || null,
              productName: rawReturn?.productName || `SKU: ${shipment.sku}`,
              quantity: 1,
              returnReason: rawReturn?.reason || 'Removal Order Shipment',
              customerComments: rawReturn?.customerComments || null,
              amazonDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
            },
            create: {
              lpn: virtualLpn,
              orderId: opOrder.platformOrderId,
              sku: shipment.sku,
              asin: rawReturn?.asin || null,
              fnsku: rawReturn?.fnsku || null,
              productName: rawReturn?.productName || `SKU: ${shipment.sku}`,
              quantity: 1,
              returnReason: rawReturn?.reason || 'Removal Order Shipment',
              customerComments: rawReturn?.customerComments || null,
              amazonDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
            }
          });
        }
      }
    } else if (order) {
      // Just link the order to the manifest
      await prisma.order.update({
        where: { platformOrderId: order.platformOrderId },
        data: { manifestId: manifest.id }
      });
    }

    await prisma.$transaction(async (tx) => {
      // Update Manifest status and receive timestamp
      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: isDamaged ? 'EXPECTED' : 'AT_DOCK',
          receivedAt: isDamaged ? null : new Date()
        }
      });

      // Create a Dispute if visually damaged/tampered (L1 alert)
      if (isDamaged) {
        await tx.dispute.create({
          data: {
            manifestId: manifest.id,
            type: 'L1_DOCK_ALERT',
            evidenceUrl: evidenceUrl || null
          }
        });
        console.log(`[Dock Receive Dispute Alert] Created L1 Dispute for manifest: ${manifest.id}`);
      }

      // Create COURIER_TO_RECEIVER handshake when package is accepted (not damaged)
      if (!isDamaged && userId) {
        // Check if handshake already exists to avoid duplicates
        const existingHandshake = await tx.handshake.findFirst({
          where: {
            manifestId: manifest.id,
            type: 'COURIER_TO_RECEIVER',
          }
        });

        if (!existingHandshake) {
          await tx.handshake.create({
            data: {
              manifestId: manifest.id,
              receiverId: userId,
              type: 'COURIER_TO_RECEIVER',
              timestamp: new Date(),
            }
          });
          console.log(`[Dock Receive Handshake] Created COURIER_TO_RECEIVER handshake for Tracking ID: ${trackingId}, receiver: ${userId}`);
        }

        // Increment receiver's itemsProcessed
        await tx.user.update({
          where: { id: userId },
          data: { itemsProcessed: { increment: 1 } }
        }).catch(() => {
          // Silently fail if user doesn't exist (edge case)
          console.warn(`[Dock Receive] Could not increment itemsProcessed for user ${userId}`);
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: isDamaged 
        ? 'Package intake rejected due to visual damage. Dispute registered.'
        : 'Package intake recorded at dock successfully',
      data: body
    }, { status: 200 });

  } catch (error: any) {
    console.error('🔥 DOCK RECEIVE CRASHED:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}