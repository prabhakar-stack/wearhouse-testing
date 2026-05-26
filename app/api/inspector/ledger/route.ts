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

    // Transform into the format the UI expects
    // Since ReturnItem is decoupled, we will get the expected items count by looking at the AMZRemovalShipment expected quantities.
    const formattedLedger = await Promise.all(ledger.map(async (item) => {
      const firstOrder = item.orders?.[0];
      const marketplace = firstOrder?.marketplace || 'UNKNOWN';
      const orderId = firstOrder?.platformOrderId || item.trackingId;
      const isInspecting = item.status === 'IN_INSPECTION' && item.inspectedBy === user.email;

      const orderIds = (item.orders || []).map(o => o.platformOrderId);
      const trackingNumbers = (item.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t);

      const shipments = await prisma.aMZRemovalShipment.findMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            { trackingNumber: { in: trackingNumbers } }
          ]
        },
        select: { shippedQuantity: true }
      });

      const itemsExpected = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

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
    }));

    return NextResponse.json({ ledger: formattedLedger });
  } catch (error: any) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger packages' }, { status: 500 });
  }
}
