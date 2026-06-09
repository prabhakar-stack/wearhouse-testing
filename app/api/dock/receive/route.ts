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

    // Ensure only EXPECTED or IN_TRANSIT packages can be received.
    if (manifest.status !== 'EXPECTED' && manifest.status !== 'IN_TRANSIT') {
      return NextResponse.json({
        error: `Cannot receive package. It is currently in "${manifest.status}" state, but can only be received if it is EXPECTED or IN_TRANSIT.`
      }, { status: 400 });
    }

    // Fetch removal shipments and AMZ removal orders matching the manifest's removalOrderId to link them
    const removalOrderId = manifest.removalOrderId;
    const removalShipments = removalOrderId ? await prisma.aMZRemovalShipment.findMany({
      where: { orderId: removalOrderId }
    }) : [];

    const rawOrder = removalOrderId ? await prisma.aMZRemovalOrder.findFirst({
      where: { orderId: removalOrderId }
    }) : null;

    let targetOrderId = removalOrderId;

    // Link shipments, order and generate return items if removalOrderId is active
    if (removalOrderId) {
      const totalQuantity = removalShipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      // Create/upsert the operational Order
      const opOrder = await prisma.order.upsert({
        where: { platformOrderId: removalOrderId },
        update: {
          marketplace: 'AMAZON',
          manifestId: manifest.id,
          totalQuantity: totalQuantity,
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
          totalQuantity: totalQuantity,
          requestDate: rawOrder?.requestDate || new Date(),
          totalAmount: rawOrder?.removalFee || null,
          fulfillmentChannel: 'AMAZON_REMOVAL'
        }
      });


      // Dynamically generate ReturnItem records (LPN-level) is intentionally omitted here.
      // Data is sourced directly from AMZ_customer_returns table at inspection time.
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
      // qcCheckedAt is stamped here — it marks the moment the receiver completed
      // their visual QC check. A null value means QC was never performed (used by
      // Ghost Delivery T1 cron to distinguish "courier says delivered but not QC'd").
      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: isDamaged ? 'CLAIMS_STAGING' : 'AT_DOCK',
          receivedAt: new Date(),
          receivedBy: userEmail,
          qcCheckedAt: new Date(),  // stamp QC completion time for both accept and reject
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
            targetUsers: userId ? {
              connect: [{ id: userId }]
            } : undefined
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