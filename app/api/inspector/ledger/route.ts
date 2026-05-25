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

    // Fetch manifests that are IN_INSPECTION (taken over by this inspector) or AT_DOCK (available for takeover)
    const ledger = await prisma.manifest.findMany({
      where: {
        OR: [
          {
            status: 'IN_INSPECTION',
            inspectedBy: user.email,
          },
          {
            status: 'AT_DOCK',
          }
        ]
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
            returnItems: {
              select: {
                lpn: true,
                sku: true
              }
            }
          }
        }
      },
      orderBy: { receivedAt: 'desc' }
    });

    // Transform into the format the UI expects
    const formattedLedger = ledger.map(item => {
      const firstOrder = item.orders?.[0];
      const marketplace = firstOrder?.marketplace || 'UNKNOWN';
      const orderId = firstOrder?.platformOrderId || item.trackingId;
      const isInspecting = item.status === 'IN_INSPECTION' && item.inspectedBy === user.email;

      // Flatten return items across all orders
      const flatReturnItems = (item.orders || []).flatMap(o =>
        (o.returnItems || []).map(ri => ({
          lpn: ri.lpn
        }))
      );

      const itemsExpected = flatReturnItems.length;

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
