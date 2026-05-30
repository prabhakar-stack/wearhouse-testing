import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
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
        createdAt: true,
        orders: {
          select: {
            marketplace: true,
            platformOrderId: true,
            trackingNumber: true,
          }
        },
        trackingSnapshots: {
          select: {
            trackingNumber: true,
            latestStatus: true,
            latestLocation: true,
            scheduledDelivery: true,
            checkpointCount: true,
            fetchedAt: true,
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
          platformOrderId: o.platformOrderId,
          trackingNumber: o.trackingNumber,
        }
      }));

      const trackingData = (m.trackingSnapshots || []).map(snapshot => ({
        trackingNumber: snapshot.trackingNumber,
        latestStatus: snapshot.latestStatus,
        latestLocation: snapshot.latestLocation,
        scheduledDelivery: snapshot.scheduledDelivery,
        checkpointCount: snapshot.checkpointCount,
        fetchedAt: snapshot.fetchedAt,
      }));

      return {
        id: m.id,
        trackingId: m.trackingId,
        courierName: m.courierName,
        status: m.status,
        expectedDate: m.expectedDate,
        createdAt: m.createdAt,
        returnItems,
        trackingData,
      };
    });

    return NextResponse.json({ expected: formattedExpected });
  } catch (error) {
    console.error('Expected fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch expected packages' }, { status: 500 });
  }
}
