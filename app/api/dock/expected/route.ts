import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const expected = await prisma.manifest.findMany({
      where: {
        status: { in: ['EXPECTED', 'IN_TRANSIT'] },
      },
      select: {
        id: true,
        trackingId: true,
        removalOrderId: true,
        status: true,
        expectedDate: true,
        createdAt: true,
        trackingSnapshots: {
          select: {
            trackingNumber: true,
            latestStatus: true,
            latestLocation: true,
            scheduledDelivery: true,
            checkpointCount: true,
          }
        }
      },
      orderBy: {
        expectedDate: 'asc'
      }
    });

    const formattedExpected = expected.map(m => {
      // In the tracking-first model, order metadata comes from removalOrderId
      const returnItems = m.removalOrderId ? [{
        order: {
          marketplace: 'AMAZON',
          platformOrderId: m.removalOrderId,
          trackingNumber: m.trackingId,
          requestDate: null, // Available via Order table if needed
        }
      }] : [];

      const trackingData = (m.trackingSnapshots || []).map(snapshot => ({
        trackingNumber: snapshot.trackingNumber,
        latestStatus: snapshot.latestStatus,
        latestLocation: snapshot.latestLocation,
        scheduledDelivery: snapshot.scheduledDelivery,
        checkpointCount: snapshot.checkpointCount,
      }));

      return {
        id: m.id,
        trackingId: m.trackingId,
        courierName: "Bluedart",
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
