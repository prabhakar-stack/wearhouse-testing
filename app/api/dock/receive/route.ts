import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');
    
    if (!role || !['RECEIVER', 'INSPECTOR', 'ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trackingAwb, tapeIntact, boxCrushed, isTampered, otpProvided, evidenceUrl } = await req.json();

    const manifest = await prisma.manifest.findUnique({
      where: { trackingAwb }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found.' }, { status: 404 });
    }

    if (manifest.status !== 'EXPECTED' && manifest.status !== 'LOST_IN_TRANSIT') {
      return NextResponse.json({ error: 'Conflict: Package is already processed.' }, { status: 409 });
    }

    const isDamaged = !tapeIntact || boxCrushed || isTampered;

    if (isDamaged) {
      // PRD: "Rejecting Damage: If a box is damaged, the Receiver must reject... system instructs them to 'Reject Delivery.'"
      await prisma.dispute.create({
        data: {
          manifestId: manifest.id,
          type: "L1_DOCK_ALERT",
          evidenceUrl: evidenceUrl || null,
        }
      });
      // We do not take custody. We can update status if we want, but for now we just reject.
      return NextResponse.json({ message: 'Damage Logged. Please Reject Delivery.', isDamaged: true }, { status: 202 });
    }

    // Clean Path
    await prisma.$transaction(async (tx) => {
      await tx.handshake.create({
        data: {
          manifestId: manifest.id,
          senderId: otpProvided || null,
          receiverId: userId,
          type: 'COURIER_TO_RECEIVER',
          timestamp: new Date()
        }
      });

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { 
          status: 'AT_DOCK',
          receivedAt: new Date()
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Delivery Accepted at Dock.', isDamaged: false }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
