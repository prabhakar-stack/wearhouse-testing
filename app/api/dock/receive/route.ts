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

    // Resolve Manifest
    let manifest = await prisma.manifest.findUnique({
      where: { trackingId }
    });

    if (!manifest) {
      // Check if it exists in RemovalShipment trackingNumber
      const removalShipment = await prisma.removalShipment.findUnique({
        where: { trackingNumber: trackingId }
      });

      // Check if it exists in Order platformOrderId
      const order = await prisma.order.findUnique({
        where: { platformOrderId: trackingId }
      });

      if (!removalShipment && !order) {
        return NextResponse.json({
          error: 'This package/order is not in our shipment removal or order database and cannot be received.'
        }, { status: 404 });
      }

      // If it exists in RemovalShipment or Order but no Manifest exists yet, we create the Manifest
      manifest = await prisma.manifest.create({
        data: {
          trackingId,
          status: 'EXPECTED',
          courierName: 'Unknown',
          expectedDate: new Date(),
        }
      });
      
      // Link the RemovalShipment to this new Manifest if found
      if (removalShipment) {
        await prisma.removalShipment.update({
          where: { id: removalShipment.id },
          data: { manifestId: manifest.id }
        });
      }

      // Link the Order to this new Manifest if found
      if (order) {
        await prisma.order.update({
          where: { platformOrderId: order.platformOrderId },
          data: { manifestId: manifest.id }
        });
      }

      console.log(`[Dock Receive Dynamic Create] Created verified Manifest for Tracking ID: ${trackingId}`);
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