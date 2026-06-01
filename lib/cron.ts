import { prisma } from "@/lib/prisma";
import { PackageState } from "@prisma/client";
import { fetchTrackingSnapshot } from "@/lib/trackcourier";
import * as amazonRawReports from "../scripts/fetch_amz_raw_reports.js";
import { runShopifyReturnsJob } from "@/lib/shopifyReturns";
import { ALERT_RULE_BY_TYPE } from "./alertRules";


// Helper to get carrier name from AMZRemovalShipment by tracking number
async function getCarrierByTracking(trackingNumber: string): Promise<string | null> {
  const rec = await prisma.aMZRemovalShipment.findFirst({
    where: { trackingNumber },
    select: { carrier: true },
  });
  return rec?.carrier ?? null;
}

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

  // authoritative check on expectedDate: if expectedDate > today, it is IN_TRANSIT. If <= today, it is EXPECTED.
  let dateStatus: "EXPECTED" | "IN_TRANSIT" | null = null;
  if (expectedDate) {
    const expDate = new Date(expectedDate);
    expDate.setHours(0, 0, 0, 0);
    if (!Number.isNaN(expDate.getTime())) {
      if (expDate.getTime() > today.getTime()) {
        dateStatus = "IN_TRANSIT";
      } else {
        dateStatus = "EXPECTED";
      }
    }
  }

  // Also check scheduledDelivery from tracking
  if (scheduledDelivery) {
    const scheduledDate = new Date(scheduledDelivery);
    scheduledDate.setHours(0, 0, 0, 0);
    if (!Number.isNaN(scheduledDate.getTime())) {
      if (scheduledDate.getTime() > today.getTime()) {
        dateStatus = "IN_TRANSIT";
      } else {
        dateStatus = "EXPECTED";
      }
    }
  }

  if (dateStatus === "EXPECTED" && !normalized) {
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
    /in transit|in-transit|picked up|inscan|shipment|dispatched|on the way|collected|accepted|processed|connected|delay|pending/.test(
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

  // Update manifest status based on expectedDate and current status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const m of manifests) {
    if (m.expectedDate) {
      const expected = new Date(m.expectedDate);
      expected.setHours(0, 0, 0, 0);
      // Use enum PackageState for status updates
      let newStatus: PackageState | null = null;
      if (expected > today) {
        // Future expected date => IN_TRANSIT
        newStatus = PackageState.IN_TRANSIT;
      } else if (expected <= today && m.status === PackageState.IN_TRANSIT) {
        // Expected today/past and currently IN_TRANSIT => EXPECTED
        newStatus = PackageState.EXPECTED;
      }
      if (newStatus && m.status !== newStatus) {
        await prisma.manifest.update({
          where: { id: m.id },
          data: { status: newStatus },
        });
        m.status = newStatus;
      }
    }
  }

  // Containers for refreshed data and errors
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
              in: (manifest.orders ?? []).map((order: any) => order.platformOrderId),
            },
          },
          {
            trackingNumber: {
              in: [
                manifest.trackingId,
                manifest.removalOrderId,
                ...(manifest.orders ?? []).map((order: any) => order.trackingNumber),
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
          manifest.trackingId,
          ...(manifest.orders || []).map((order) => order.trackingNumber),
          ...shipmentTrackingNumbers.map((shipment) => shipment.trackingNumber),
        ].filter((value): value is string => !!value),
      ),
    );

    for (const trackingNumber of trackingNumbers) {
      const existingSnapshot = (manifest.trackingSnapshots ?? []).find(
        (snapshot: any) => snapshot.trackingNumber === trackingNumber,
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

  const now = new Date();
  const activeGhostAlerts = await prisma.alert.findMany({
    where: {
      manifestId: { in: manifests.map((m) => m.id) },
      type: { startsWith: "GHOST_DELIVERY_T1" },
      resolved: false,
    },
  });

  const activeAlertsByManifest: Record<string, any[]> = {};
  for (const alert of activeGhostAlerts) {
    if (alert.manifestId) {
      if (!activeAlertsByManifest[alert.manifestId]) {
        activeAlertsByManifest[alert.manifestId] = [];
      }
      activeAlertsByManifest[alert.manifestId].push(alert);
    }
  }

  const alertsToCreate: Array<{
    level: "L1" | "L2" | "L3" | "L4";
    type: string;
    title: string;
    description: string;
    manifestId: string;
  }> = [];
  const alertsToResolve: string[] = [];

  function parseDeliveryDate(snap: any): Date {
    if (snap.checkpoints && snap.checkpoints.length > 0) {
      const cp = snap.checkpoints.find((c: any) =>
        /delivered|completed|received|proof of delivery/i.test(c.status || "")
      );
      if (cp && cp.date) {
        const timeStr = cp.time ? ` ${cp.time}` : "";
        const parsed = new Date(`${cp.date}${timeStr}`);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return new Date(snap.fetchedAt || Date.now());
  }

  // 2. Iterate sequentially over the flat tracking array (always refresh when job is run)
  let taskIndex = 0;
  for (const task of trackingTasks) {
    taskIndex++;
    // Obtain carrier from shipment table (fallback to existing courierName)
    const carrierFromShipment = await getCarrierByTracking(task.trackingNumber);
    console.log(`Fetched carrier for ${task.trackingNumber}: ${carrierFromShipment}`);
    const courier = carrierFromShipment ?? task.courierName;
    console.log(`[Tracking Sync] [${taskIndex}/${trackingTasks.length}] Refreshing tracking ID: ${task.trackingNumber} (${courier || 'Unknown Courier'})...`);
    try {
      // Run the Playwright tracking check
      const snapshot = await fetchTrackingSnapshot(
        task.trackingNumber,
        courier,
      );

      // Resolve scheduled delivery from snapshot, with fallback to current date + 5 days if null or invalid (NaN)
      let finalScheduledDelivery: Date | null = null;
      if (snapshot.scheduledDelivery) {
        const parsed = new Date(snapshot.scheduledDelivery);
        if (!Number.isNaN(parsed.getTime())) {
          finalScheduledDelivery = parsed;
        }
      }

      if (!finalScheduledDelivery) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 5); // Fallback: Current Date + 5 days
        finalScheduledDelivery = fallback;
      }

      // A. First update the shipmentTracking table's scheduledDelivery column
      const trackingRecord = await prisma.shipmentTracking.upsert({
        where: { trackingNumber: task.trackingNumber },
        update: {
          manifestId: task.manifestId,
          courierName: task.courierName,
          courierSlug: snapshot.courierSlug,
          latestStatus: snapshot.latestStatus,
          latestLocation: snapshot.latestLocation,
          scheduledDelivery: finalScheduledDelivery,
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
          scheduledDelivery: finalScheduledDelivery,
          checkpointCount: snapshot.checkpointCount,
          checkpoints: snapshot.checkpoints,
          rawText: snapshot.rawText,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
      });

      // A2. Also keep the AMZRemovalShipment (shipment query table) status in sync
      if (snapshot.latestStatus) {
        await prisma.aMZRemovalShipment.updateMany({
          where: { trackingNumber: task.trackingNumber },
          data: { shipmentStatus: snapshot.latestStatus },
        });
      }

      // B. Retrieve the saved scheduledDelivery from the DB and update the Manifest's expectedDate
      let updatedExpectedDate = task.expectedDate;
      if (trackingRecord.scheduledDelivery) {
        const scheduled = new Date(trackingRecord.scheduledDelivery);
        if (!Number.isNaN(scheduled.getTime())) {
          await prisma.manifest.update({
            where: { id: task.manifestId },
            data: { expectedDate: scheduled },
          });
          updatedExpectedDate = scheduled;
        } // else: invalid scheduledDelivery, keep existing expectedDate
      }

      // C. Resolve and update status
      const nextStatus = resolveManifestStatus(
        snapshot.latestStatus,
        snapshot.scheduledDelivery,
        updatedExpectedDate,
      );

      console.log(`[Status Debug] Manifest: ${task.manifestId} | Current: ${task.currentStatus} | Resolved: ${nextStatus} (ETA: ${updatedExpectedDate?.toISOString().slice(0,10)})`);

      if (nextStatus && task.currentStatus !== nextStatus) {
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { status: nextStatus as any },
        });
      }

      // D. Event-driven alert check for Ghost Delivery
      const isDelivered = /delivered|completed|received|proof of delivery/i.test(
        snapshot.latestStatus || "",
      );
      if (
        isDelivered &&
        (task.currentStatus === "EXPECTED" || task.currentStatus === "IN_TRANSIT")
      ) {
        const deliveryDate = parseDeliveryDate(snapshot);
        const hoursSinceDelivery =
          (now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60);

        let targetAlertType: string | null = null;
        if (hoursSinceDelivery >= 24) {
          targetAlertType = "GHOST_DELIVERY_T1_24H";
        } else if (hoursSinceDelivery >= 12) {
          targetAlertType = "GHOST_DELIVERY_T1_12H";
        } else if (hoursSinceDelivery >= 6) {
          targetAlertType = "GHOST_DELIVERY_T1_6H";
        }

        if (targetAlertType) {
          const rule = ALERT_RULE_BY_TYPE[targetAlertType];
          if (rule) {
            const manifestAlerts = activeAlertsByManifest[task.manifestId] || [];
            const exactAlertExists = manifestAlerts.some(
              (a) => a.type === targetAlertType,
            );

            if (!exactAlertExists) {
              const GHOST_TIER_PRIORITY: Record<string, number> = {
                GHOST_DELIVERY_T1_6H: 1,
                GHOST_DELIVERY_T1_12H: 2,
                GHOST_DELIVERY_T1_24H: 3,
              };

              const targetPriority = GHOST_TIER_PRIORITY[targetAlertType] ?? 0;
              let shouldCreate = true;

              for (const activeAlert of manifestAlerts) {
                const activePriority = GHOST_TIER_PRIORITY[activeAlert.type] ?? 0;
                if (activePriority < targetPriority) {
                  alertsToResolve.push(activeAlert.id);
                } else if (activePriority > targetPriority) {
                  shouldCreate = false;
                }
              }

              if (shouldCreate) {
                alertsToCreate.push({
                  level: rule.level as any,
                  type: rule.type,
                  title: rule.title,
                  description: rule.description.replace(
                    "{trackingId}",
                    task.trackingNumber,
                  ),
                  manifestId: task.manifestId,
                });
              }
            }
          }
        }
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

  // 3. Batch execute database changes for event-driven alerts
  if (alertsToResolve.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: alertsToResolve } },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolution: "Automatically resolved due to higher-tier alert escalation.",
      },
    });
    console.log(`[Tracking Sync] Bulk-resolved ${alertsToResolve.length} lower-tier ghost delivery alerts.`);
  }

  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({
      data: alertsToCreate,
    });
    console.log(`[Tracking Sync] Bulk-inserted ${alertsToCreate.length} new ghost delivery alerts.`);
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
