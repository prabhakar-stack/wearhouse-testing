import { prisma } from "@/lib/prisma";
import { fetchTrackingSnapshot } from "@/lib/trackcourier";
import * as amazonRawReports from "../scripts/fetch_amz_raw_reports.js";
import { runShopifyReturnsJob } from "@/lib/shopifyReturns";

export const HOUR_MS = 60 * 60 * 1000;
export const HALF_DAY_MS = 12 * HOUR_MS;
export const FIVE_DAYS_MS = 5 * 24 * HOUR_MS;

const runAmazonRawSync = amazonRawReports.main as () => Promise<void>;

export type CronJobKey =
  | "amazon-returns"
  | "shopify-returns"
  | "expected-tracking"
  | "escalations";

export async function runAmazonReturnsJob() {
  await runAmazonRawSync();

  return {
    message: "Amazon raw report fetch and sync completed",
  };
}

export async function runShopifyReturnsSyncJob() {
  const results = await runShopifyReturnsJob();

  return {
    message: "Shopify returns sync completed",
    results,
  };
}

export function resolveManifestStatus(
  latestStatus: string | null | undefined,
  scheduledDelivery: string | null | undefined,
  expectedDate?: Date | null,
) {
  const normalized = latestStatus?.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  // authorative check on expectedDate: if expectedDate >= today, it should be EXPECTED. Otherwise if in transit, it stays IN_TRANSIT.
  let dateStatus: "EXPECTED" | "IN_TRANSIT" | null = null;
  if (expectedDate) {
    const expDate = new Date(expectedDate);
    expDate.setHours(0, 0, 0, 0);
    if (!Number.isNaN(expDate.getTime()) && expDate.getTime() >= today.getTime()) {
      dateStatus = "EXPECTED";
    }
  }

  // Also check scheduledDelivery from tracking
  if (scheduledDelivery) {
    const scheduledDate = new Date(scheduledDelivery);
    scheduledDate.setHours(0, 0, 0, 0);
    if (!Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() >= today.getTime()) {
      dateStatus = "EXPECTED";
    }
  }

  if (dateStatus === "EXPECTED") {
    return "EXPECTED";
  }

  if (!normalized) {
    return dateStatus;
  }

  if (
    /delivered|completed|received|proof of delivery|out for delivery|arrived|arriving today|delivery today/.test(
      normalized,
    )
  ) {
    return "EXPECTED";
  }

  if (
    /in transit|in-transit|picked up|inscan|shipment|dispatched|on the way|collected|accepted|processed/.test(
      normalized,
    )
  ) {
    return "IN_TRANSIT";
  }

  return dateStatus;
}

export async function runExpectedTrackingJob() {
  const manifests = await prisma.manifest.findMany({
    where: {
      status: {
        in: ["EXPECTED", "IN_TRANSIT"],
      },
    },
    select: {
      id: true,
      trackingId: true,
      removalOrderId: true,
      courierName: true,
      status: true,
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

  const refreshed: Array<{
    manifestId: string;
    trackingNumber: string;
    status: string | null;
  }> = [];
  const errors: Array<{
    manifestId: string;
    trackingNumber: string;
    error: string;
  }> = [];

  // 1. Gather all tracking numbers sequentially mapped to their parent manifest metadata
  const trackingTasks: Array<{
    manifestId: string;
    trackingNumber: string;
    courierName: string | null;
    expectedDate: Date | null;
    currentStatus: string;
    existingSnapshot: any | null;
  }> = [];

  for (const manifest of manifests) {
    const shipmentTrackingNumbers = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          {
            orderId: {
              in: manifest.orders.map((order) => order.platformOrderId),
            },
          },
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

    for (const trackingNumber of trackingNumbers) {
      const existingSnapshot = (manifest.trackingSnapshots || []).find(
        (snapshot) => snapshot.trackingNumber === trackingNumber,
      );
      trackingTasks.push({
        manifestId: manifest.id,
        trackingNumber,
        courierName: manifest.courierName,
        expectedDate: manifest.expectedDate,
        currentStatus: manifest.status,
        existingSnapshot,
      });
    }
  }

  // 2. Iterate sequentially over the flat tracking array (always refresh when job is run)
  let taskIndex = 0;
  for (const task of trackingTasks) {
    taskIndex++;
    console.log(`[Tracking Sync] [${taskIndex}/${trackingTasks.length}] Refreshing tracking ID: ${task.trackingNumber} (${task.courierName || 'Unknown Courier'})...`);
    try {
      
      // Run the Playwright tracking check
      const snapshot = await fetchTrackingSnapshot(
        task.trackingNumber,
        task.courierName,
      );

      // A. First update the shipmentTracking table's scheduledDelivery column
      const trackingRecord = await prisma.shipmentTracking.upsert({
        where: { trackingNumber: task.trackingNumber },
        update: {
          manifestId: task.manifestId,
          courierName: task.courierName,
          courierSlug: snapshot.courierSlug,
          latestStatus: snapshot.latestStatus,
          latestLocation: snapshot.latestLocation,
          scheduledDelivery: snapshot.scheduledDelivery
            ? new Date(snapshot.scheduledDelivery)
            : null,
          checkpointCount: snapshot.checkpointCount,
          checkpoints: snapshot.checkpoints,
          rawText: snapshot.rawText,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
        create: {
          trackingNumber: task.trackingNumber,
          manifestId: task.manifestId,
          courierName: task.courierName,
          courierSlug: snapshot.courierSlug,
          latestStatus: snapshot.latestStatus,
          latestLocation: snapshot.latestLocation,
          scheduledDelivery: snapshot.scheduledDelivery
            ? new Date(snapshot.scheduledDelivery)
            : null,
          checkpointCount: snapshot.checkpointCount,
          checkpoints: snapshot.checkpoints,
          rawText: snapshot.rawText,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
      });

      // B. Retrieve the saved scheduledDelivery from the DB and update the Manifest's expectedDate
      let updatedExpectedDate = task.expectedDate;
      if (trackingRecord.scheduledDelivery) {
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { expectedDate: trackingRecord.scheduledDelivery },
        });
        updatedExpectedDate = trackingRecord.scheduledDelivery;
      }

      // C. Resolve and update status
      const nextStatus = resolveManifestStatus(
        snapshot.latestStatus,
        snapshot.scheduledDelivery,
        updatedExpectedDate,
      );

      if (nextStatus && task.currentStatus !== nextStatus) {
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { status: nextStatus },
        });
      }

      refreshed.push({
        manifestId: task.manifestId,
        trackingNumber: task.trackingNumber,
        status: snapshot.latestStatus,
      });
      console.log(`[Tracking Sync] [${taskIndex}/${trackingTasks.length}] ✅ Successfully updated tracking ID ${task.trackingNumber}. Status: ${snapshot.latestStatus}, ETA: ${snapshot.scheduledDelivery || 'N/A'}`);
    } catch (error: any) {
      errors.push({
        manifestId: task.manifestId,
        trackingNumber: task.trackingNumber,
        error: error?.message || "Tracking fetch failed",
      });
      console.error(`[Tracking Sync] [${taskIndex}/${trackingTasks.length}] ❌ Failed to refresh tracking ID ${task.trackingNumber}: ${error.message || error}`);
    }
  }

  return {
    refreshedCount: refreshed.length,
    skippedCount: manifests.length - refreshed.length,
    refreshed,
    errors,
  };
}

export async function runEscalationsJob() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const results = {
    l2Alerts: 0,
    nudges: 0,
    escalations: 0,
    l4Alerts: 0,
  };

  const createAlertIfNew = async (data: {
    level: "L1" | "L2" | "L3" | "L4";
    type: string;
    title: string;
    description: string;
    manifestId?: string;
    targetUserId?: string;
  }) => {
    const existing = await prisma.alert.findFirst({
      where: {
        type: data.type,
        manifestId: data.manifestId || undefined,
        resolved: false,
      },
    });
    if (existing) return null;

    return prisma.alert.create({ data });
  };

  const l2Manifests = await prisma.manifest.findMany({
    where: {
      status: "AT_DOCK",
      receivedAt: { lt: today },
      inspectedBy: null,
    },
  });

  for (const manifest of l2Manifests) {
    const alert = await createAlertIfNew({
      level: "L2",
      type: "SLA_BREACH",
      title: `10:30 AM Handover SLA Breach`,
      description: `Package ${manifest.trackingId} received yesterday has not been handed over to an inspector. Received at: ${manifest.receivedAt ? new Date(manifest.receivedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown"}.`,
      manifestId: manifest.id,
    });
    if (alert) results.l2Alerts++;
  }

  const claimsManifests = await prisma.manifest.findMany({
    where: { status: "CLAIMS_STAGING" },
  });

  const hours48 = 48 * 60 * 60 * 1000;
  const hours72 = 72 * 60 * 60 * 1000;

  for (const manifest of claimsManifests) {
    const startTime = manifest.receivedAt || manifest.createdAt;
    if (!startTime) continue;
    const timeStaged = now.getTime() - new Date(startTime).getTime();

    if (timeStaged > hours72) {
      const alert = await createAlertIfNew({
        level: "L3",
        type: "CLAIM_STALLED",
        title: `Claim Stalled Over 72 Hours`,
        description: `Claim for tracking ID ${manifest.trackingId} has been in staging for over 72 hours without action. Staging started at: ${new Date(startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
        manifestId: manifest.id,
      });
      if (alert) results.escalations++;
    } else if (timeStaged > hours48) {
      const alert = await createAlertIfNew({
        level: "L1",
        type: "CLAIM_NUDGE",
        title: `Claim Pending — 48 Hour Nudge`,
        description: `Claim for tracking ID ${manifest.trackingId} has been pending for 48+ hours. Claims specialist should begin filing.`,
        manifestId: manifest.id,
      });
      if (alert) results.nudges++;
    }
  }

  const hours48Ago = new Date(now.getTime() - hours48);

  const ghostDeliveries = await prisma.manifest.findMany({
    where: {
      status: "EXPECTED",
      trackingSnapshots: {
        some: {
          scheduledDelivery: { lt: hours48Ago, not: null },
        },
      },
    },
    include: {
      trackingSnapshots: true,
    },
  });

  for (const ghost of ghostDeliveries) {
    const snap = ghost.trackingSnapshots.find((s) => s.scheduledDelivery);
    const etaDate = snap?.scheduledDelivery ? new Date(snap.scheduledDelivery) : null;
    const alert = await createAlertIfNew({
      level: "L4",
      type: "GHOST_DELIVERY",
      title: `Ghost Delivery — Courier Says Delivered`,
      description: `Package ${ghost.trackingId} expected ${etaDate ? etaDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown"} has not been scanned at the warehouse after 48+ hours. Possible missing delivery.`,
      manifestId: ghost.id,
    });
    if (alert) results.l4Alerts++;
  }

  const missingEvidence = await prisma.evidence.findMany({
    where: {
      claimReason: "MISSING",
      manifest: {
        alerts: {
          none: { type: "MISSING_ITEMS", resolved: false },
        },
      },
    },
    include: { manifest: true },
  });

  for (const ev of missingEvidence) {
    if (ev.manifest) {
      await createAlertIfNew({
        level: "L3",
        type: "MISSING_ITEMS",
        title: `Missing Items Detected in Inspection`,
        description: `Inspection of tracking ID ${ev.manifest.trackingId} found missing items.`,
        manifestId: ev.manifestId!,
      });
    }
  }

  return { results };
}

export const cronJobs = [
  {
    key: "amazon-returns" as const,
    label: "Amazon Returns",
    intervalMs: FIVE_DAYS_MS,
    run: runAmazonReturnsJob,
  },
  {
    key: "shopify-returns" as const,
    label: "Shopify Returns",
    intervalMs: HALF_DAY_MS,
    run: runShopifyReturnsSyncJob,
  },
  {
    key: "expected-tracking" as const,
    label: "Expected Tracking",
    intervalMs: HOUR_MS,
    run: runExpectedTrackingJob,
  },
  {
    key: "escalations" as const,
    label: "Escalations",
    intervalMs: HOUR_MS,
    run: runEscalationsJob,
  },
] as const;
