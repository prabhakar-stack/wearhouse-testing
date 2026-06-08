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
        status: true,
        receivedAt: true,
        inspectedBy: true,
        orders: {
          select: {
            marketplace: true,
            platformOrderId: true,
            trackingNumber: true,
          }
        }
      },
      orderBy: { receivedAt: 'desc' }
    });

    // console.log(`[Ledger Audit] Total IN_INSPECTION manifests: ${totalInInspection}, Returned manifests for user ${user.email}: ${ledger.length}`);

    // Batch fetch all removal shipments to solve the N+1 query problem and prevent DB connection exhaustion/timeouts
    const allOrderIds = ledger.flatMap(item => (item.orders || []).map(o => o.platformOrderId).filter((id): id is string => !!id));
    const allTrackingNumbers = ledger.flatMap(item => (item.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t));

    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          { orderId: { in: allOrderIds } },
          { trackingNumber: { in: allTrackingNumbers } }
        ]
      },
      select: {
        id: true,
        orderId: true,
        trackingNumber: true,
        shippedQuantity: true
      }
    });

    // Transform into the format the UI expects
    const formattedLedger = ledger.map((item) => {
      const firstOrder = item.orders?.[0];
      const marketplace = firstOrder?.marketplace || 'UNKNOWN';
      const orderId = firstOrder?.platformOrderId || item.trackingId;
      const isInspecting = item.status === 'IN_INSPECTION' && item.inspectedBy === user.email;

      const itemOrderIds = new Set((item.orders || []).map(o => o.platformOrderId).filter((id): id is string => !!id));
      const itemTrackingNumbers = new Set((item.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t));

      // Filter batch-fetched shipments in memory for this ledger item
      const matchedShipments = shipments.filter(s => 
        (s.orderId && itemOrderIds.has(s.orderId)) ||
        (s.trackingNumber && itemTrackingNumbers.has(s.trackingNumber))
      );

      const itemsExpected = matchedShipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      return {
        id: item.id,
        trackingId: item.trackingId,
        orderId,
        marketplace,
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
