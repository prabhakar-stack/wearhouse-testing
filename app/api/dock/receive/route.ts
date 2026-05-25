import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trackingId, tapeIntact, boxCrushed, isTampered, otpProvided, evidenceUrl } = body;

    if (!trackingId) {
      return NextResponse.json({ error: 'Tracking ID or Order ID is required' }, { status: 400 });
    }

    const userId = req.headers.get('x-user-id');
    console.log(`[Dock Receive] Scanned code: ${trackingId}`, body);

    const isDamaged = !tapeIntact || boxCrushed || isTampered;

    // 1. First, search Manifest by tracking number (trackingId)
    let manifest = await prisma.manifest.findUnique({
      where: { trackingId }
    });

    // 2. If not found, try searching Manifest by removalOrderId (where user scanned the Order ID)
    if (!manifest) {
      manifest = await prisma.manifest.findFirst({
        where: { removalOrderId: trackingId }
      });
    }

    // 3. If still not found anywhere in manifest expected logs, block intake
    if (!manifest) {
      return NextResponse.json({
        error: `This package/order (${trackingId}) is not in expected return logs. Please search in main database or contact administrator.`
      }, { status: 404 });
    }

    // If found, check if it is in EXPECTED or LOST_IN_TRANSIT or AT_DOCK status to continue
    const allowedStatuses = ['EXPECTED', 'LOST_IN_TRANSIT', 'AT_DOCK'];
    if (!allowedStatuses.includes(manifest.status)) {
      console.warn(`[Dock Receive Warning] Manifest ${manifest.trackingId} is in status ${manifest.status}. Allowing check-in overwrite.`);
    }

    // Fetch removal shipments and AMZ removal orders matching the manifest's removalOrderId to link them
    const removalOrderId = manifest.removalOrderId;
    const removalShipments = removalOrderId ? await prisma.removalShipment.findMany({
      where: { removalOrderId }
    }) : [];

    const rawOrder = removalOrderId ? await prisma.aMZRemovalOrder.findFirst({
      where: { orderId: removalOrderId }
    }) : null;

    let targetOrderId = removalOrderId;

    // Link shipments, order and generate return items if removalOrderId is active
    if (removalOrderId) {
      // Create/upsert the operational Order
      const opOrder = await prisma.order.upsert({
        where: { platformOrderId: removalOrderId },
        update: {
          marketplace: 'AMAZON',
          manifestId: manifest.id,
          ...(rawOrder ? {
            requestDate: rawOrder.requestDate || new Date(),
            totalAmount: rawOrder.removalFee || null,
            fulfillmentChannel: 'AMAZON_REMOVAL'
          } : {})
        },
        create: {
          platformOrderId: removalOrderId,
          marketplace: 'AMAZON',
          manifestId: manifest.id,
          requestDate: rawOrder?.requestDate || new Date(),
          totalAmount: rawOrder?.removalFee || null,
          fulfillmentChannel: 'AMAZON_REMOVAL'
        }
      });

      // Link matching expected shipments to this Manifest
      await prisma.removalShipment.updateMany({
        where: { removalOrderId },
        data: { manifestId: manifest.id }
      });

      // Dynamically generate ReturnItem records (LPN-level) for expected SKU quantities
      for (const shipment of removalShipments) {
        const qty = shipment.shippedQuantity || 1;
        for (let i = 0; i < qty; i++) {
          const virtualLpn = `LPN-${manifest.trackingId}-${shipment.sku}-${i}`.toUpperCase();

          const rawReturn = await prisma.aMZCustomerReturn.findFirst({
            where: {
              orderId: shipment.removalOrderId,
              sku: shipment.sku
            }
          });

          const customerOrderId = rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER';

          await prisma.returnItem.upsert({
            where: { lpn: virtualLpn },
            update: {
              orderId: opOrder.platformOrderId,
              sku: shipment.sku,
              asin: rawReturn?.asin || null,
              fnsku: rawReturn?.fnsku || null,
              productName: rawReturn?.productName || `SKU: ${shipment.sku}`,
              returnReason: rawReturn?.reason || 'Removal Order Shipment',
              customerComments: rawReturn?.customerComments || null,
              amazonDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
              customerOrderId: customerOrderId,
            },
            create: {
              lpn: virtualLpn,
              orderId: opOrder.platformOrderId,
              sku: shipment.sku,
              asin: rawReturn?.asin || null,
              fnsku: rawReturn?.fnsku || null,
              productName: rawReturn?.productName || `SKU: ${shipment.sku}`,
              returnReason: rawReturn?.reason || 'Removal Order Shipment',
              customerComments: rawReturn?.customerComments || null,
              amazonDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
              customerOrderId: customerOrderId,
            }
          });
        }
      }
    }

    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const userEmail = user?.email || 'receiver@cubelelo.com';

    await prisma.$transaction(async (tx) => {
      // Find customer order id if possible
      let customerOrderId = null;
      if (removalOrderId) {
        const firstShipment = removalShipments[0];
        const rawReturn = await tx.aMZCustomerReturn.findFirst({
          where: {
            orderId: removalOrderId,
            sku: firstShipment?.sku
          }
        });
        customerOrderId = rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER';
      }

      // Update Manifest status, receive timestamp, receivedBy and customerOrderId
      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: isDamaged ? 'EXPECTED' : 'AT_DOCK',
          receivedAt: isDamaged ? null : new Date(),
          receivedBy: userEmail,
          customerOrderId: customerOrderId,
        }
      });

      // Create an Evidence if visually damaged/tampered (receiver rejection)
      if (isDamaged) {
        await tx.evidence.upsert({
          where: { lpn: manifest.trackingId },
          update: {
            orderId: targetOrderId,
            type: 'RECEIVER_REJECTION',
            uploadedByEmail: userEmail,
            manifestId: manifest.id,
            claimReason: 'DOCK_DAMAGE',
            claimSubReason: 'Package failed visual inspection',
            orderDriveLink: evidenceUrl || null,
          },
          create: {
            lpn: manifest.trackingId,
            orderId: targetOrderId,
            type: 'RECEIVER_REJECTION',
            uploadedByEmail: userEmail,
            manifestId: manifest.id,
            claimReason: 'DOCK_DAMAGE',
            claimSubReason: 'Package failed visual inspection',
            orderDriveLink: evidenceUrl || null,
          }
        });

        // Trigger L1 Alert directly
        await tx.alert.create({
          data: {
            level: 'L1',
            type: 'INTAKE_REJECTION',
            title: `Intake Visual Rejection`,
            description: `Package intake rejected for Tracking ID ${manifest.trackingId} due to visual damage.`,
            manifestId: manifest.id,
          }
        });
        console.log(`[Dock Receive Alert] Created L1 Alert for manifest: ${manifest.id}`);
      }

      // Increment receiver's itemsProcessed if accepted
      if (!isDamaged && userId) {
        await tx.user.update({
          where: { id: userId },
          data: { itemsProcessed: { increment: 1 } }
        }).catch(() => {
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