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
    console.log(`[Dock Receive] Scanned code: ${trackingId}`, body);

    const isDamaged = !tapeIntact || boxCrushed || isTampered;

    // 1. Look up Manifest by trackingId — primary lookup only.
    //    Every manifest is now keyed by tracking number (tracking-first architecture).
    //    The legacy fallback by removalOrderId is removed: if a manifest doesn't exist
    //    for this trackingId it has not been staged yet and must be reported.
    const manifest = await prisma.manifest.findUnique({
      where: { trackingId }
    });

    if (!manifest) {
      return NextResponse.json({
        error: `This package (${trackingId}) is not in expected return logs. Please search in main database or contact administrator.`
      }, { status: 404 });
    }

    // Ensure only EXPECTED or IN_TRANSIT packages can be received.
    if (manifest.status !== 'EXPECTED' && manifest.status !== 'IN_TRANSIT') {
      return NextResponse.json({
        error: `Cannot receive package. It is currently in "${manifest.status}" state, but can only be received if it is EXPECTED or IN_TRANSIT.`
      }, { status: 400 });
    }

    // Fetch removal shipments scoped strictly to this tracking number.
    // This is the shipment-centric lookup: only rows belonging to this physical box.
    const removalShipments = await prisma.aMZRemovalShipment.findMany({
      where: { trackingNumber: manifest.trackingId }
    });

    // Resolve orderId from the manifest metadata (set during staging sync)
    const removalOrderId = manifest.removalOrderId;

    // Fetch order-level metadata from the raw staging table for request-date context
    const rawOrder = removalOrderId
      ? await prisma.aMZRemovalOrder.findFirst({ where: { orderId: removalOrderId } })
      : null;

    // Upsert the operational Order (independent — no manifestId FK).
    // This exists for order-level tracking (request date, reimbursement window alerts).
    if (removalOrderId) {
      const totalQuantity = removalShipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);
      await prisma.order.upsert({
        where: { platformOrderId: removalOrderId },
        update: {
          marketplace: 'AMAZON',
          totalQuantity,
          ...(rawOrder ? {
            requestDate: rawOrder.requestDate || new Date(),
            totalAmount: rawOrder.removalFee || null,
            fulfillmentChannel: 'AMAZON_REMOVAL',
          } : {}),
        },
        create: {
          platformOrderId: removalOrderId,
          marketplace: 'AMAZON',
          totalQuantity,
          requestDate: rawOrder?.requestDate || new Date(),
          totalAmount: rawOrder?.removalFee || null,
          fulfillmentChannel: 'AMAZON_REMOVAL',
        },
      });
    }

    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const userEmail = user?.email || 'receiver@cubelelo.com';

    await prisma.$transaction(async (tx) => {
      // Resolve customer order ID from the first shipment's SKU match
      let customerOrderId = null;
      if (removalOrderId && removalShipments.length > 0) {
        const firstShipment = removalShipments[0];
        const rawReturn = await tx.aMZCustomerReturn.findFirst({
          where: {
            orderId: removalOrderId,
            sku: firstShipment?.sku,
          }
        });
        customerOrderId = rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER';
      }

      // Update Manifest status, receive timestamp, receivedBy, and qcCheckedAt.
      // qcCheckedAt stamps the moment the receiver completed their visual QC check.
      // A null value means QC was never performed (used by Ghost Delivery T1 cron).
      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: isDamaged ? 'CLAIMS_STAGING' : 'AT_DOCK',
          receivedAt: new Date(),
          receivedBy: userEmail,
          qcCheckedAt: new Date(),
        }
      });

      // Create Evidence if visually damaged/tampered (receiver rejection)
      if (isDamaged) {
        await tx.evidence.upsert({
          where: { lpn: manifest.trackingId },
          update: {
            orderId: removalOrderId,
            trackingId: manifest.trackingId,
            type: 'RECEIVER_REJECTION',
            uploadedByEmail: userEmail,
            manifestId: manifest.id,
            claimReason: 'DOCK_DAMAGE',
            claimSubReason: 'Package failed visual inspection',
            orderDriveLink: evidenceUrl || null,
          },
          create: {
            lpn: manifest.trackingId,
            orderId: removalOrderId,
            trackingId: manifest.trackingId,
            type: 'RECEIVER_REJECTION',
            uploadedByEmail: userEmail,
            manifestId: manifest.id,
            claimReason: 'DOCK_DAMAGE',
            claimSubReason: 'Package failed visual inspection',
            orderDriveLink: evidenceUrl || null,
          }
        });

        // Trigger L1 Alert
        await tx.alert.create({
          data: {
            level: 'L1',
            type: 'INTAKE_REJECTION',
            title: `Intake Visual Rejection`,
            description: `Package intake rejected for Tracking ID ${manifest.trackingId} due to visual damage.`,
            manifestId: manifest.id,
            targetUsers: userId ? { connect: [{ id: userId }] } : undefined,
          }
        });
        console.log(`[Dock Receive Alert] Created L1 Alert for manifest: ${manifest.id}`);
      }

      // Increment receiver's itemsProcessed if accepted
      if (!isDamaged && userId) {
        await tx.user.update({
          where: { id: userId },
          data: { itemsProcessed: { increment: 1 } },
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
      data: body,
    }, { status: 200 });

  } catch (error: any) {
    console.error('🔥 DOCK RECEIVE CRASHED:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}