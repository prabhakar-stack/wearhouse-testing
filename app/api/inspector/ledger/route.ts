import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch manifests that are IN_INSPECTION or AT_DOCK with a RECEIVER_TO_INSPECTOR handshake to this inspector
    const ledger = await prisma.manifest.findMany({
      where: {
        OR: [
          {
            // Packages this inspector has taken over
            status: 'IN_INSPECTION',
            handshakes: {
              some: {
                receiverId: userId,
                type: 'RECEIVER_TO_INSPECTOR',
              }
            }
          },
          {
            // Also show packages at dock that haven't been taken over yet (available for takeover)
            status: 'AT_DOCK',
          }
        ]
      },
      select: {
        id: true,
        trackingId: true,
        status: true,
        receivedAt: true,
        orders: {
          select: {
            marketplace: true,
            platformOrderId: true,
            returnItems: {
              select: {
                lpn: true,
                sku: true,
                quantity: true
              }
            }
          }
        },
        handshakes: {
          where: { type: 'RECEIVER_TO_INSPECTOR' },
          select: { receiverId: true, timestamp: true }
        },
        inspection: {
          select: {
            totalItemsScanned: true,
            totalItemsExpected: true,
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
      const isInspecting = item.status === 'IN_INSPECTION' &&
        item.handshakes.some(h => h.receiverId === userId);

      // Flatten return items across all orders
      const flatReturnItems = (item.orders || []).flatMap(o =>
        (o.returnItems || []).map(ri => ({
          lpn: ri.lpn,
          quantity: ri.quantity
        }))
      );

      // Count expected items by LPN count
      const itemsWithLpn = flatReturnItems.filter(ri => ri.lpn);
      const itemsExpected = itemsWithLpn.length > 0
        ? itemsWithLpn.length
        : flatReturnItems.reduce((sum, ri) => sum + ri.quantity, 0);

      return {
        id: item.id,
        trackingId: item.trackingId,
        orderId,
        marketplace,
        status: isInspecting ? 'INSPECTING' : 'PENDING_INSPECTION',
        receivedAt: item.receivedAt?.toISOString() || new Date().toISOString(),
        itemsExpected: item.inspection?.totalItemsExpected || itemsExpected || 0,
        itemsInspected: item.inspection?.totalItemsScanned || 0,
      };
    });

    return NextResponse.json({ ledger: formattedLedger });
  } catch (error: any) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger packages' }, { status: 500 });
  }
}
