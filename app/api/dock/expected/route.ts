import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expected = await prisma.manifest.findMany({
      where: {
        status: 'EXPECTED',
      },
      select: {
        id: true,
        trackingId: true,
        courierName: true,
        status: true,
        expectedDate: true,
        orders: {
          select: {
            marketplace: true,
            platformOrderId: true
          }
        }
      },
      orderBy: {
        expectedDate: 'asc'
      }
    });

    const formattedExpected = expected.map(m => {
      const returnItems = (m.orders || []).map(o => ({
        order: {
          marketplace: o.marketplace,
          platformOrderId: o.platformOrderId
        }
      }));

      return {
        id: m.id,
        trackingId: m.trackingId,
        courierName: m.courierName,
        status: m.status,
        expectedDate: m.expectedDate,
        returnItems
      };
    });

    return NextResponse.json({ expected: formattedExpected });
  } catch (error) {
    console.error('Expected fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch expected packages' }, { status: 500 });
  }
}
