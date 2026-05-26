import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchTrackingSnapshot } from '@/lib/trackcourier';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function resolveManifestStatus(latestStatus: string | null | undefined, scheduledDelivery: string | null | undefined) {
  const normalized = latestStatus?.trim().toLowerCase();

  if (scheduledDelivery) {
    const scheduledDate = new Date(scheduledDelivery);
    const today = new Date();
    if (!Number.isNaN(scheduledDate.getTime()) && scheduledDate.toDateString() === today.toDateString()) {
      return 'EXPECTED';
    }
  }

  if (!normalized) {
    return null;
  }

  if (/delivered|completed|received|proof of delivery|out for delivery|arrived|arriving today|delivery today/.test(normalized)) {
    return 'EXPECTED';
  }

  if (/in transit|in-transit|picked up|inscan|shipment|dispatched|on the way|collected|accepted|processed/.test(normalized)) {
    return 'IN_TRANSIT';
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threshold = new Date(Date.now() + DAY_MS);
    const manifests = await prisma.manifest.findMany({
      where: {
        status: {
          in: ['EXPECTED', 'IN_TRANSIT'],
        },
        expectedDate: { gt: threshold },
      },
      select: {
        id: true,
        trackingId: true,
        courierName: true,
        expectedDate: true,
        orders: {
          select: {
            platformOrderId: true,
            trackingNumber: true,
          },
        },
        trackingSnapshots: {
          select: {
            trackingNumber: true,
            latestStatus: true,
            latestLocation: true,
            scheduledDelivery: true,
            checkpointCount: true,
            fetchedAt: true,
          },
        },
      },
    });

    const refreshed: Array<{ manifestId: string; trackingNumber: string; status: string | null }> = [];
    const errors: Array<{ manifestId: string; trackingNumber: string; error: string }> = [];

    for (const manifest of manifests) {
      const shipmentTrackingNumbers = await prisma.aMZRemovalShipment.findMany({
        where: {
          OR: [
            { orderId: { in: manifest.orders.map((order) => order.platformOrderId) } },
            {
              trackingNumber: {
                in: [
                  manifest.trackingId,
                  manifest.removalOrderId,
                  ...(manifest.orders || []).map((order) => order.trackingNumber),
                ].filter((value): value is string => !!value),
              },
            },
          ],
        },
        select: {
          trackingNumber: true,
        },
      });

      const trackingNumbers = Array.from(
        new Set(
          [
            ...(manifest.orders || []).map((order) => order.trackingNumber),
            ...shipmentTrackingNumbers.map((shipment) => shipment.trackingNumber),
          ].filter((value): value is string => !!value),
        ),
      );

      if (trackingNumbers.length === 0) {
        continue;
      }

      for (const trackingNumber of trackingNumbers) {
        const existingSnapshot = (manifest.trackingSnapshots || []).find((snapshot) => snapshot.trackingNumber === trackingNumber);
        const lastFetchedAt = existingSnapshot?.fetchedAt ? new Date(existingSnapshot.fetchedAt).getTime() : 0;
        const shouldRefresh = !existingSnapshot || Date.now() - lastFetchedAt >= HOUR_MS;

        if (!shouldRefresh) {
          continue;
        }

        try {
          const snapshot = await fetchTrackingSnapshot(trackingNumber, manifest.courierName);

          await prisma.shipmentTracking.upsert({
            where: { trackingNumber },
            update: {
              manifestId: manifest.id,
              courierName: manifest.courierName,
              courierSlug: snapshot.courierSlug,
              latestStatus: snapshot.latestStatus,
              latestLocation: snapshot.latestLocation,
              scheduledDelivery: snapshot.scheduledDelivery ? new Date(snapshot.scheduledDelivery) : null,
              checkpointCount: snapshot.checkpointCount,
              checkpoints: snapshot.checkpoints,
              rawText: snapshot.rawText,
              fetchedAt: new Date(snapshot.fetchedAt),
            },
            create: {
              trackingNumber: order.trackingNumber,
              manifestId: manifest.id,
              courierName: manifest.courierName,
              courierSlug: snapshot.courierSlug,
              latestStatus: snapshot.latestStatus,
              latestLocation: snapshot.latestLocation,
              scheduledDelivery: snapshot.scheduledDelivery ? new Date(snapshot.scheduledDelivery) : null,
              checkpointCount: snapshot.checkpointCount,
              checkpoints: snapshot.checkpoints,
              rawText: snapshot.rawText,
              fetchedAt: new Date(snapshot.fetchedAt),
            },
          });

          const nextStatus = resolveManifestStatus(snapshot.latestStatus, snapshot.scheduledDelivery);
          if (nextStatus && manifest.status !== nextStatus) {
            await prisma.manifest.update({
              where: { id: manifest.id },
              data: { status: nextStatus },
            });
            manifest.status = nextStatus;
          }

          refreshed.push({
            manifestId: manifest.id,
            trackingNumber,
            status: snapshot.latestStatus,
          });
        } catch (error: any) {
          errors.push({
            manifestId: manifest.id,
            trackingNumber,
            error: error?.message || 'Tracking fetch failed',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      refreshedCount: refreshed.length,
      skippedCount: manifests.length - refreshed.length,
      refreshed,
      errors,
    });
  } catch (error: any) {
    console.error('[Cron Expected Tracking] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
