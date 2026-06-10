import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Count total IN_INSPECTION manifests in the table for troubleshooting
    const totalInInspection = await prisma.manifest.count({
      where: {
        status: 'IN_INSPECTION',
      },
    });

    // Fetch manifests that are IN_INSPECTION (taken over by this inspector)
    const ledger = await prisma.manifest.findMany({
      where: {
        status: 'IN_INSPECTION',
        inspectedBy: user.email,
      },
      select: {
        id: true,
        trackingId: true,
        removalOrderId: true,
        status: true,
        receivedAt: true,
        inspectedBy: true,
      },
      orderBy: { receivedAt: 'desc' }
    });

    // console.log(`[Ledger Audit] Total IN_INSPECTION manifests: ${totalInInspection}, Returned manifests for user ${user.email}: ${ledger.length}`);

    // Batch fetch all removal shipments scoped by trackingId (tracking-first architecture)
    const allTrackingNumbers = ledger.map(item => item.trackingId).filter(Boolean);

    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: { trackingNumber: { in: allTrackingNumbers } },
      select: {
        id: true,
        orderId: true,
        trackingNumber: true,
        shippedQuantity: true
      }
    });

    // Transform into the format the UI expects
    const formattedLedger = ledger.map((item) => {
      // In the tracking-first model, orderId comes from manifest.removalOrderId metadata
      const orderId = item.removalOrderId || item.trackingId;
      const isInspecting = item.status === 'IN_INSPECTION' && item.inspectedBy === user.email;

      // Filter batch-fetched shipments for this manifest by trackingId
      const matchedShipments = shipments.filter(s => s.trackingNumber === item.trackingId);
      const itemsExpected = matchedShipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      return {
        id: item.id,
        trackingId: item.trackingId,
        orderId,
        marketplace: 'AMAZON',
        status: isInspecting ? 'INSPECTING' : 'PENDING_INSPECTION',
        receivedAt: item.receivedAt?.toISOString() || new Date().toISOString(),
        itemsExpected: itemsExpected,
        itemsInspected: 0,
      };
    });

    return NextResponse.json({ ledger: formattedLedger });
  } catch (error: any) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger packages' }, { status: 500 });
  }
}
