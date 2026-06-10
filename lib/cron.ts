import { prisma } from "./prisma.ts";
import { PackageState } from "@prisma/client";
import { fetchTrackingSnapshot } from "./trackcourier.ts";
import * as amazonRawReports from "../scripts/fetch_amz_raw_reports.js";
import { runShopifyReturnsJob } from "./shopifyReturns.ts";
import { ALERT_RULE_BY_TYPE } from "./alertRules.ts";
import { calculateWarehouseWorkingHours } from "./timeUtils.ts";
import { resolveTargetUserIds } from "./alertTargeting.ts";
import { archiveAndScoreAlerts } from "./alertLogger.ts";
import { dispatchAlert } from "./alertDispatcher.ts";
import { randomUUID } from "crypto";


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

export async function generateOrdersFromShipments() {
  console.log("[generateOrdersFromShipments] Fetching removal shipments...");
  const shipments = await prisma.aMZRemovalShipment.findMany({
    where: { orderId: { not: null } }
  });

  console.log(`[generateOrdersFromShipments] Found ${shipments.length} shipments. Grouping by order ID...`);

  // Group in memory
  const grouped: Record<string, {
    orderId: string;
    shippedQuantity: number;
    requestDate: Date | null;
    trackingNumber: string | null;
  }> = {};
  
  for (const s of shipments) {
    const orderId = s.orderId;
    if (!orderId) continue;
    if (!grouped[orderId]) {
      grouped[orderId] = {
        orderId,
        shippedQuantity: 0,
        requestDate: null,
        trackingNumber: null,
      };
    }
    
    grouped[orderId].shippedQuantity += s.shippedQuantity ?? 0;
    
    if (s.requestDate) {
      const sDate = new Date(s.requestDate);
      if (!grouped[orderId].requestDate || sDate < (grouped[orderId].requestDate as Date)) {
        grouped[orderId].requestDate = sDate;
      }
    }
    
    if (!grouped[orderId].trackingNumber && s.trackingNumber) {
      grouped[orderId].trackingNumber = s.trackingNumber;
    }
  }

  const groupedArray = Object.values(grouped);
  console.log(`[generateOrdersFromShipments] Grouped into ${groupedArray.length} unique orders. Processing...`);

  for (const g of groupedArray) {
    const orderId = g.orderId;

    // Check if manifest already exists for this removalOrderId
    let manifest = await prisma.manifest.findFirst({
      where: { removalOrderId: orderId }
    });

    if (!manifest) {
      // Find a tracking ID, fallback to random UUID if none
      const trackingId = g.trackingNumber || randomUUID();

      // Check if trackingId is already used to avoid unique constraint violations
      let existingManifestWithTracking = await prisma.manifest.findUnique({
        where: { trackingId }
      });

      if (existingManifestWithTracking) {
        manifest = existingManifestWithTracking;
        // Optionally update it to link the removalOrderId
        if (!manifest.removalOrderId) {
          manifest = await prisma.manifest.update({
            where: { id: manifest.id },
            data: { removalOrderId: orderId }
          });
        }
      } else {
        manifest = await prisma.manifest.create({
          data: {
            trackingId,
            status: PackageState.EXPECTED,
            removalOrderId: orderId,
          },
        });
      }
    }

    // Upsert the Order (metadata only — trackingNumber and manifestId live on Manifest now)
    await prisma.order.upsert({
      where: { platformOrderId: orderId },
      update: {
        requestDate: g.requestDate,
        totalQuantity: g.shippedQuantity || undefined,
        fulfillmentId: orderId,
      },
      create: {
        platformOrderId: orderId,
        marketplace: "AMAZON",
        requestDate: g.requestDate,
        totalQuantity: g.shippedQuantity || undefined,
        fulfillmentId: orderId,
      },
    });


    console.log(`[generateOrdersFromShipments] Processed Order ${orderId}`);
  }
  console.log("[generateOrdersFromShipments] All orders and manifests successfully populated.");
}

export async function runAmazonReturnsJob() {
  console.log("[Amazon Returns Job] Step 1: Fetching and staging Amazon returns raw reports...");
  await runAmazonRawSync();

  console.log("[Amazon Returns Job] Step 2: Populating core Order and Manifest tables from shipments...");
  await generateOrdersFromShipments();

  console.log("[Amazon Returns Job] Step 3: Running tracking update for expected packages...");
  await runExpectedTrackingJob();

  return {
    message: "Amazon returns pipeline (fetch, stage, generate orders/manifests, and track) completed successfully.",
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

  // If the resolved dateStatus is EXPECTED, prioritize it and return EXPECTED directly
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
      status: true,
      expectedDate: true,
      createdAt: true,
      qcCheckedAt: true, // null = receiver has not QC'd the package yet
      trackingSnapshots: {
        select: {
          trackingNumber: true,
          latestStatus: true,
          latestLocation: true,
          scheduledDelivery: true,
          checkpointCount: true,
        },
      },
    },
  });

  // Update manifest status based on expectedDate and current status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const m of manifests) {
    let currentExpectedDate = m.expectedDate;
    if (currentExpectedDate) {
      const expected = new Date(currentExpectedDate);
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

  // Build a lookup of manifestId → qcCheckedAt to use in Ghost Delivery T1 check.
  // qcCheckedAt is null until the receiver completes their visual QC on the dock.
  const qcCheckedAtByManifest: Record<string, Date | null> = {};
  for (const m of manifests) {
    qcCheckedAtByManifest[m.id] = (m as any).qcCheckedAt ?? null;
  }

  // 1. Gather all tracking numbers sequentially mapped to their parent manifest metadata
  const trackingTasks: Array<{
    manifestId: string;
    trackingNumber: string;
    expectedDate: Date | null;
    currentStatus: string;
    existingSnapshot: any | null;
  }> = [];

  for (const manifest of manifests) {
    // Shipment-centric: fetch shipments scoped to this manifest's trackingId only.
    // Tracking numbers from manifest.orders are no longer needed — one manifest = one tracking.
    const shipmentTrackingNumbers = await prisma.aMZRemovalShipment.findMany({
      where: { trackingNumber: manifest.trackingId },
      select: { trackingNumber: true },
    });

    const trackingNumbers = Array.from(
      new Set(
        [
          manifest.trackingId,
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
        expectedDate: manifest.expectedDate,
        currentStatus: manifest.status,
        existingSnapshot,
      });
    }
  }

  const now = new Date();

  // Fetch warehouse operational hours settings from system config
  const configRecord = await (prisma as any).systemConfig.findUnique({
    where: { key: "warehouse_hours" },
  });
  let startTimeStr: string | null = null;
  let endTimeStr: string | null = null;
  if (configRecord) {
    try {
      const config = JSON.parse(configRecord.value);
      startTimeStr = config.startTime;
      endTimeStr = config.endTime;
    } catch (e) {
      // Ignored
    }
  }
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
    targetUserIds: string[];
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
    // Obtain carrier from shipment table (fallback to Bluedart)
    const carrierFromShipment = await getCarrierByTracking(task.trackingNumber);
    console.log(`Fetched carrier for ${task.trackingNumber}: ${carrierFromShipment}`);
    const courier = carrierFromShipment ?? "Bluedart";
    console.log(`[Tracking Sync] [${taskIndex}/${trackingTasks.length}] Refreshing tracking ID: ${task.trackingNumber} (${courier})...`);
    try {
      // Run the Playwright tracking check
      const snapshot = await fetchTrackingSnapshot(
        task.trackingNumber,
        courier,
      );

      // Resolve scheduled delivery from snapshot
      let resolvedCarrierDelivery: Date | null = null;
      if (snapshot.scheduledDelivery) {
        const parsed = new Date(snapshot.scheduledDelivery);
        if (!Number.isNaN(parsed.getTime())) {
          parsed.setHours(12, 0, 0, 0); // Force to noon local time to avoid timezone subtraction rolling it back
          resolvedCarrierDelivery = parsed;
        }
      }

      // A. First update the shipmentTracking table's scheduledDelivery column (without fallback, can be null)
      const trackingRecord = await prisma.shipmentTracking.upsert({
        where: { trackingNumber: task.trackingNumber },
        update: {
          manifestId: task.manifestId,
          latestStatus: snapshot.latestStatus,
          latestLocation: snapshot.latestLocation,
          scheduledDelivery: resolvedCarrierDelivery,
          checkpointCount: snapshot.checkpointCount,
          checkpoints: snapshot.checkpoints,
        },
        create: {
          trackingNumber: task.trackingNumber,
          manifestId: task.manifestId,
          latestStatus: snapshot.latestStatus,
          latestLocation: snapshot.latestLocation,
          scheduledDelivery: resolvedCarrierDelivery,
          checkpointCount: snapshot.checkpointCount,
          checkpoints: snapshot.checkpoints,
        },
      });

      // A2. Also keep the AMZRemovalShipment (shipment query table) status in sync
      if (snapshot.latestStatus) {
        await prisma.aMZRemovalShipment.updateMany({
          where: { trackingNumber: task.trackingNumber },
          data: { shipmentStatus: snapshot.latestStatus },
        });
      }

      // B. Retrieve and update Manifest's expectedDate (source of truth)
      let updatedExpectedDate = task.expectedDate; // Current expectedDate from manifest
      if (resolvedCarrierDelivery) {
        // If carrier tracking returned a valid date, we use it to update the manifest
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { expectedDate: resolvedCarrierDelivery },
        });
        updatedExpectedDate = resolvedCarrierDelivery;
      } else if (!updatedExpectedDate) {
        // If tracking returned NA/null AND manifest's current expectedDate is null, update to current date + 5 days
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 5);
        fallback.setHours(12, 0, 0, 0); // Force to noon local time
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { expectedDate: fallback },
        });
        updatedExpectedDate = fallback;
      }

      // C. Resolve and update status
      const nextStatus = resolveManifestStatus(
        snapshot.latestStatus,
        snapshot.scheduledDelivery,
        updatedExpectedDate,
      );

      console.log(`[Status Debug] Manifest: ${task.manifestId} | Current: ${task.currentStatus} | Resolved: ${nextStatus} (ETA: ${updatedExpectedDate?.toISOString().slice(0, 10)})`);

      if (nextStatus && task.currentStatus !== nextStatus) {
        await prisma.manifest.update({
          where: { id: task.manifestId },
          data: { status: nextStatus as any },
        });
      }

      // D. Event-driven alert check for Ghost Delivery
      // Trigger if courier says "delivered" but receiver has NOT yet completed QC
      // (qcCheckedAt === null means the receiver never scanned/accepted this package).
      const isDelivered = /delivered|completed|received|proof of delivery/i.test(
        snapshot.latestStatus || "",
      );
      const receiverHasNotQCd = qcCheckedAtByManifest[task.manifestId] === null;
      if (isDelivered && receiverHasNotQCd) {
        const deliveryDate = parseDeliveryDate(snapshot);
        const hoursSinceDelivery = calculateWarehouseWorkingHours(
          deliveryDate,
          now,
          startTimeStr,
          endTimeStr,
          "Asia/Kolkata"
        );

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

              const activeAlertsToArchive: string[] = [];
              for (const activeAlert of manifestAlerts) {
                const activePriority = GHOST_TIER_PRIORITY[activeAlert.type] ?? 0;
                if (activePriority < targetPriority) {
                  activeAlertsToArchive.push(activeAlert.id);
                } else if (activePriority > targetPriority) {
                  shouldCreate = false;
                }
              }

              if (activeAlertsToArchive.length > 0) {
                await archiveAndScoreAlerts(activeAlertsToArchive, "ESCALATED");
              }

              if (shouldCreate) {
                const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
                alertsToCreate.push({
                  level: rule.level as any,
                  type: rule.type,
                  title: rule.title,
                  description: rule.description.replace(
                    "{trackingId}",
                    task.trackingNumber,
                  ),
                  manifestId: task.manifestId,
                  targetUserIds,
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
    for (const a of alertsToCreate) {
      try {
        const alert = await prisma.alert.create({
          data: {
            level: a.level,
            type: a.type,
            title: a.title,
            description: a.description,
            manifestId: a.manifestId,
            targetUsers: {
              connect: a.targetUserIds.map(id => ({ id }))
            }
          }
        });
        dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher Error]', err));
      } catch (err: any) {
        console.error('[Tracking Sync] Failed to create alert:', err.message || err);
      }
    }
    console.log(`[Tracking Sync] Created ${alertsToCreate.length} new ghost delivery alerts.`);
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

  const configRecord = await (prisma as any).systemConfig.findUnique({
    where: { key: "warehouse_hours" },
  });
  let startTimeStr = '09:00';
  let endTimeStr = '18:00';
  const timezoneStr = 'Asia/Kolkata'; // Default

  if (configRecord) {
    try {
      const config = JSON.parse(configRecord.value);
      if (config.startTime) startTimeStr = config.startTime;
      if (config.endTime) endTimeStr = config.endTime;
    } catch (e) { }
  }

  const results = {
    l2Alerts: 0,
    l3Alerts: 0,
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
    targetUserIds?: string[];
  }) => {
    const existing = await prisma.alert.findFirst({
      where: {
        type: data.type,
        manifestId: data.manifestId || undefined,
        resolved: false,
      },
    });
    if (existing) return null;

    const { targetUserIds, ...rest } = data;
    const alert = await prisma.alert.create({
      data: {
        ...rest,
        targetUsers: targetUserIds && targetUserIds.length > 0 ? {
          connect: targetUserIds.map(id => ({ id }))
        } : undefined
      }
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher Error]', err));
    }
    return alert;
  };

  // ── GROUP 5: RECEIVER-INSPECTOR HANDSHAKE PENDING ──
  const currentHourIST = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );

  const startOfYesterday = new Date(today);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const atDockManifests = await prisma.manifest.findMany({
    where: {
      status: "AT_DOCK",
      receivedAt: { lt: today },
      inspectedBy: null,
    },
    include: {
      alerts: {
        where: { resolved: false, type: { startsWith: 'RECV_INSP_HANDSHAKE' } }
      }
    }
  });

  for (const manifest of atDockManifests) {
    if (!manifest.receivedAt) continue;

    let targetAlertType: string | null = null;

    if (manifest.receivedAt < startOfYesterday && currentHourIST >= 10) {
      targetAlertType = "RECV_INSP_HANDSHAKE_NEXT_DAY";
    } else if (manifest.receivedAt >= startOfYesterday) { // Received exactly yesterday
      if (currentHourIST >= 15) {
        targetAlertType = "RECV_INSP_HANDSHAKE_3PM";
      } else if (currentHourIST >= 12) {
        targetAlertType = "RECV_INSP_HANDSHAKE_12PM";
      } else if (currentHourIST >= 10) {
        targetAlertType = "RECV_INSP_HANDSHAKE_10AM";
      }
    }

    if (targetAlertType) {
      const rule = ALERT_RULE_BY_TYPE[targetAlertType];
      if (rule) {
        const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);

        if (!exactAlertExists) {
          const TIER_PRIORITY: Record<string, number> = {
            RECV_INSP_HANDSHAKE_10AM: 1,
            RECV_INSP_HANDSHAKE_12PM: 2,
            RECV_INSP_HANDSHAKE_3PM: 3,
            RECV_INSP_HANDSHAKE_NEXT_DAY: 4
          };

          const targetPriority = TIER_PRIORITY[targetAlertType] ?? 0;
          let shouldCreate = true;

          const activeAlertsToArchive: string[] = [];
          for (const activeAlert of manifest.alerts) {
            const activePriority = TIER_PRIORITY[activeAlert.type] ?? 0;
            if (activePriority < targetPriority) {
              activeAlertsToArchive.push(activeAlert.id);
            } else if (activePriority > targetPriority) {
              shouldCreate = false;
            }
          }

          if (activeAlertsToArchive.length > 0) {
            await archiveAndScoreAlerts(activeAlertsToArchive, "ESCALATED");
          }

          if (shouldCreate) {
            const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUsers: {
                  connect: targetUserIds.map(id => ({ id }))
                }
              }
            });
            if (alert) {
              dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
              if (targetAlertType === "RECV_INSP_HANDSHAKE_12PM") results.l2Alerts++;
              else if (targetAlertType === "RECV_INSP_HANDSHAKE_NEXT_DAY") results.l4Alerts++;
              else results.escalations++;
            }
          }
        }
      }
    }
  }

  // ── GROUP 6: INSPECTION PENDING ──
  const inspectingManifests = await prisma.manifest.findMany({
    where: {
      status: "IN_INSPECTION",
      inspectorHandoverAt: { not: null }
    },
    include: {
      alerts: {
        where: { resolved: false, type: { startsWith: 'INSPECTION_PENDING' } }
      }
    }
  });

  for (const manifest of inspectingManifests) {
    if (!manifest.inspectorHandoverAt) continue;

    const workingHoursElapsed = calculateWarehouseWorkingHours(manifest.inspectorHandoverAt, now, startTimeStr, endTimeStr, timezoneStr);
    let targetAlertType: string | null = null;

    if (workingHoursElapsed >= 24) {
      targetAlertType = "INSPECTION_PENDING_24H";
    } else if (workingHoursElapsed >= 18) {
      targetAlertType = "INSPECTION_PENDING_18H";
    } else if (workingHoursElapsed >= 12) {
      targetAlertType = "INSPECTION_PENDING_12H";
    } else if (workingHoursElapsed >= 6) {
      targetAlertType = "INSPECTION_PENDING_6H";
    }

    if (targetAlertType) {
      const rule = ALERT_RULE_BY_TYPE[targetAlertType];
      if (rule) {
        const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);

        if (!exactAlertExists) {
          const TIER_PRIORITY: Record<string, number> = {
            INSPECTION_PENDING_6H: 1,
            INSPECTION_PENDING_12H: 2,
            INSPECTION_PENDING_18H: 3,
            INSPECTION_PENDING_24H: 4
          };

          const targetPriority = TIER_PRIORITY[targetAlertType] ?? 0;
          let shouldCreate = true;

          const activeAlertsToArchive: string[] = [];
          for (const activeAlert of manifest.alerts) {
            const activePriority = TIER_PRIORITY[activeAlert.type] ?? 0;
            if (activePriority < targetPriority) {
              activeAlertsToArchive.push(activeAlert.id);
            } else if (activePriority > targetPriority) {
              shouldCreate = false;
            }
          }

          if (activeAlertsToArchive.length > 0) {
            await archiveAndScoreAlerts(activeAlertsToArchive, "ESCALATED");
          }

          if (shouldCreate) {
            let finalTargetIds: string[] = [];
            if (manifest.inspectedBy) {
              const inspectorUser = await prisma.user.findUnique({ where: { email: manifest.inspectedBy } });
              if (inspectorUser) finalTargetIds.push(inspectorUser.id);
            }
            if (finalTargetIds.length === 0) {
              finalTargetIds = await resolveTargetUserIds(rule.targetRoles);
            }

            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUsers: {
                  connect: finalTargetIds.map(id => ({ id }))
                }
              }
            });
            if (alert) {
              dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
              if (targetAlertType === "INSPECTION_PENDING_12H") results.l2Alerts++;
              else if (targetAlertType === "INSPECTION_PENDING_24H") results.l4Alerts++;
              else results.escalations++;
            }
          }
        }
      }
    }
  }

  // ── GROUP 7: INSPECTION QC FAILED (CLAIMS STAGING) ──
  const claimsManifests = await prisma.manifest.findMany({
    where: {
      status: "CLAIMS_STAGING",
      claimId: null,
      inspectedAt: { not: null }
    },
    include: {
      alerts: {
        where: { resolved: false, type: { startsWith: 'INSPECTION_QC_FAILED' } }
      }
    }
  });

  for (const manifest of claimsManifests) {
    if (!manifest.inspectedAt) continue;

    const workingHoursElapsed = calculateWarehouseWorkingHours(manifest.inspectedAt, now, startTimeStr, endTimeStr, timezoneStr);
    let targetAlertType: string | null = null;

    if (workingHoursElapsed >= 24) {
      targetAlertType = "INSPECTION_QC_FAILED_24H";
    } else if (workingHoursElapsed >= 12) {
      targetAlertType = "INSPECTION_QC_FAILED_12H";
    } else if (workingHoursElapsed >= 6) {
      targetAlertType = "INSPECTION_QC_FAILED_6H";
    }

    if (targetAlertType) {
      const rule = ALERT_RULE_BY_TYPE[targetAlertType];
      if (rule) {
        const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);

        if (!exactAlertExists) {
          const TIER_PRIORITY: Record<string, number> = {
            INSPECTION_QC_FAILED_6H: 1,
            INSPECTION_QC_FAILED_12H: 2,
            INSPECTION_QC_FAILED_24H: 3,
          };

          const targetPriority = TIER_PRIORITY[targetAlertType] ?? 0;
          let shouldCreate = true;

          const activeAlertsToArchive: string[] = [];
          for (const activeAlert of manifest.alerts) {
            const activePriority = TIER_PRIORITY[activeAlert.type] ?? 0;
            if (activePriority < targetPriority) {
              activeAlertsToArchive.push(activeAlert.id);
            } else if (activePriority > targetPriority) {
              shouldCreate = false;
            }
          }

          if (activeAlertsToArchive.length > 0) {
            await archiveAndScoreAlerts(activeAlertsToArchive, "ESCALATED");
          }

          if (shouldCreate) {
            const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUsers: {
                  connect: targetUserIds.map(id => ({ id }))
                }
              }
            });
            if (alert) {
              dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
              if (targetAlertType === "INSPECTION_QC_FAILED_12H") results.l3Alerts++;
              else if (targetAlertType === "INSPECTION_QC_FAILED_24H") results.l4Alerts++;
              else results.escalations++;
            }
          }
        }
      }
    }
  }

  // --- GROUP 8: Inspector-Recovery Handshake Pending ---
  // Query ItemStatus where status === 'RECOVERY' and recoveryHandoverAt is null
  const pendingRecoveryItems = await prisma.itemStatus.findMany({
    where: {
      status: 'RECOVERY',
      recoveryHandoverAt: null,
      manifestId: { not: null }
    },
    include: { manifest: true }
  });

  for (const item of pendingRecoveryItems) {
    if (!item.manifest) continue;

    // Use warehouse working hours to measure time elapsed since it was marked for recovery (createdAt)
    const hoursPending = calculateWarehouseWorkingHours(
      item.createdAt,
      now,
      startTimeStr,
      endTimeStr,
      "Asia/Kolkata"
    );

    let targetAlertType: "INSP_RECOVERY_HANDSHAKE_18H" | "INSP_RECOVERY_HANDSHAKE_12H" | null = null;
    let targetAlertLevel: "L2" | "L1" | null = null;
    let targetUserIds: string[] = [];

    if (hoursPending >= 18) {
      targetAlertType = "INSP_RECOVERY_HANDSHAKE_18H";
      targetAlertLevel = "L2";
    } else if (hoursPending >= 12) {
      targetAlertType = "INSP_RECOVERY_HANDSHAKE_12H";
      targetAlertLevel = "L1";
      // L1 targets the inspector
      if (item.manifest.inspectedBy) {
        const inspectorUser = await prisma.user.findFirst({ where: { email: item.manifest.inspectedBy } });
        if (inspectorUser) targetUserIds.push(inspectorUser.id);
      }
    }

    if (targetAlertType && targetAlertLevel) {
      const rule = ALERT_RULE_BY_TYPE[targetAlertType];
      if (rule) {
        // Find if this alert already exists and is unresolved
        const existingAlert = await prisma.alert.findFirst({
          where: {
            manifestId: item.manifest.id,
            type: targetAlertType,
            resolved: false
          }
        });

        if (!existingAlert) {
          if (targetUserIds.length === 0) {
            targetUserIds = await resolveTargetUserIds(rule.targetRoles);
          }

          const alert = await prisma.alert.create({
            data: {
              level: targetAlertLevel,
              type: rule.type,
              title: rule.title,
              description: rule.description.replace("{trackingId}", item.manifest.trackingId),
              manifestId: item.manifest.id,
              targetUsers: {
                connect: targetUserIds.map(id => ({ id }))
              }
            }
          });
          if (alert) {
            dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
            if (targetAlertLevel === 'L1') results.nudges++;
            else if (targetAlertLevel === 'L2') results.l2Alerts++;
          }
        }
      }
    }
  }

  const hours48 = 48 * 60 * 60 * 1000;
  const hours48Ago = new Date(now.getTime() - hours48);

  const ghostDeliveries = await prisma.manifest.findMany({
    where: {
      status: { in: ["EXPECTED", "IN_TRANSIT"] as any },
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
      targetUserIds: await resolveTargetUserIds(["L4"]),
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
        targetUserIds: await resolveTargetUserIds(["L3"]),
      });
    }
  }


  // ── GROUP 10: AMAZON NON-DISPATCH (Reimbursement Window Monitoring) ──────────
  // Requirement: if requestDate is older than 5 days AND the shipment is NOT yet
  // in IN_TRANSIT or beyond (i.e., Amazon has not dispatched the order), raise alert.
  //
  // Logic:
  //   1. Find all Orders with requestDate older than 5 days
  //   2. For each, check if any Manifest for that order has status != EXPECTED
  //      (IN_TRANSIT, AT_DOCK, IN_INSPECTION, etc. = Amazon dispatched)
  //   3. If ALL manifests are still EXPECTED — or no manifest at all — alert fires.
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const oldOrders = await prisma.order.findMany({
    where: {
      requestDate: { lt: fiveDaysAgo },
      marketplace: 'AMAZON',
    },
    select: { platformOrderId: true, requestDate: true },
  });

  for (const order of oldOrders) {
    if (!order.requestDate) continue;

    // Check if ANY manifest for this order has moved past EXPECTED
    // (IN_TRANSIT, AT_DOCK, IN_INSPECTION, INSPECTED, CLAIMS_STAGING, RECOVERED_TO_INVENTORY)
    const dispatchedManifest = await prisma.manifest.findFirst({
      where: {
        removalOrderId: order.platformOrderId,
        status: { not: 'EXPECTED' },
      },
    });

    // If at least one manifest is past EXPECTED, Amazon has dispatched — skip
    if (dispatchedManifest) continue;

    const daysSinceRequest = (now.getTime() - order.requestDate.getTime()) / (24 * 60 * 60 * 1000);
    const adminUsers = await resolveTargetUserIds(['L2', 'L3']);
    const requestDateStr = order.requestDate.toISOString().slice(0, 10);
    const daysRounded = Math.floor(daysSinceRequest);
    const windowLeft = Math.max(0, 15 - daysRounded);

    if (daysSinceRequest >= 10) {
      // ── 10D CRITICAL: reimbursement window closing in ~4–5 days ──────────
      // Upgrade: if a 5D alert already exists for this order, auto-archive it
      const existing5D = await prisma.alert.findFirst({
        where: { type: 'ORDER_NOT_SHIPPED_5D', description: { contains: order.platformOrderId }, resolved: false },
      });
      if (existing5D) {
        await archiveAndScoreAlerts([existing5D.id], 'ESCALATED');
      }

      const existing10D = await prisma.alert.findFirst({
        where: { type: 'ORDER_NOT_SHIPPED_10D', description: { contains: order.platformOrderId }, resolved: false },
      });
      if (!existing10D) {
        const alert = await prisma.alert.create({
          data: {
            level: 'L3',
            type: 'ORDER_NOT_SHIPPED_10D',
            title: `Amazon Order Not Dispatched — ${daysRounded} Days (CRITICAL WINDOW)`,
            description: `Removal Order ${order.platformOrderId} was requested on ${requestDateStr} but Amazon has NOT dispatched this shipment after ${daysRounded} days. No manifest is IN_TRANSIT or beyond. Reimbursement window closes in ~${windowLeft} days. Immediate action required.`,
            targetUsers: { connect: adminUsers.map(id => ({ id })) },
          },
        });
        if (alert) {
          dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
          results.l3Alerts++;
        }
      }

    } else if (daysSinceRequest >= 5) {
      // ── 5D WARNING: shipment not dispatched, approaching reimbursement window ──
      const existing5D = await prisma.alert.findFirst({
        where: { type: 'ORDER_NOT_SHIPPED_5D', description: { contains: order.platformOrderId }, resolved: false },
      });
      if (!existing5D) {
        const alert = await prisma.alert.create({
          data: {
            level: 'L2',
            type: 'ORDER_NOT_SHIPPED_5D',
            title: `Amazon Order Not Dispatched — ${daysRounded} Days`,
            description: `Removal Order ${order.platformOrderId} was requested on ${requestDateStr} but Amazon has NOT dispatched this shipment after ${daysRounded} days. No manifest is IN_TRANSIT or beyond. Reimbursement window closes in ~${windowLeft} days.`,
            targetUsers: { connect: adminUsers.map(id => ({ id })) },
          },
        });
        if (alert) {
          dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
          results.l2Alerts++;
        }
      }
    }
  }



  // ── GROUP 1: DELIVERY ETA BREACH ──────────────────────────────────────────────
  // Fire when a manifest (EXPECTED or IN_TRANSIT) has an ETA (from ShipmentTracking.scheduledDelivery,
  // OR fallback: Order.requestDate + 5 days) that is overdue by 48/72/96 hours.
  const etaBreachManifests = await prisma.manifest.findMany({
    where: {
      status: { in: ['EXPECTED', 'IN_TRANSIT'] },
    },
    include: {
      trackingSnapshots: { select: { scheduledDelivery: true } },
      alerts: { where: { resolved: false, type: { startsWith: 'DELIVERY_ETA_BREACH' } } },
    },
  });

  for (const manifest of etaBreachManifests) {
    // Prefer the carrier-provided ETA; fall back to Order.requestDate + 5 days
    let eta: Date | null = manifest.trackingSnapshots[0]?.scheduledDelivery ?? null;
    if (!eta && manifest.removalOrderId) {
      const order = await prisma.order.findUnique({
        where: { platformOrderId: manifest.removalOrderId },
        select: { requestDate: true },
      });
      if (order?.requestDate) {
        eta = new Date(order.requestDate.getTime() + 5 * 24 * 60 * 60 * 1000);
      }
    }
    if (!eta || eta > now) continue; // ETA not yet passed

    const workingHoursOverdue = calculateWarehouseWorkingHours(eta, now, startTimeStr, endTimeStr, timezoneStr);

    let targetAlertType: string | null = null;
    if (workingHoursOverdue >= 96) {
      targetAlertType = 'DELIVERY_ETA_BREACH_96H';
    } else if (workingHoursOverdue >= 72) {
      targetAlertType = 'DELIVERY_ETA_BREACH_72H';
    } else if (workingHoursOverdue >= 48) {
      targetAlertType = 'DELIVERY_ETA_BREACH_48H';
    }
    if (!targetAlertType) continue;

    const rule = ALERT_RULE_BY_TYPE[targetAlertType];
    if (!rule) continue;

    const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);
    if (exactAlertExists) continue;

    const ETA_TIER_PRIORITY: Record<string, number> = {
      DELIVERY_ETA_BREACH_48H: 1,
      DELIVERY_ETA_BREACH_72H: 2,
      DELIVERY_ETA_BREACH_96H: 3,
    };
    const targetPriority = ETA_TIER_PRIORITY[targetAlertType] ?? 0;
    const activeAlertsToArchive: string[] = [];
    let shouldCreate = true;
    for (const active of manifest.alerts) {
      const activePriority = ETA_TIER_PRIORITY[active.type] ?? 0;
      if (activePriority < targetPriority) activeAlertsToArchive.push(active.id);
      else if (activePriority > targetPriority) shouldCreate = false;
    }
    if (activeAlertsToArchive.length > 0) await archiveAndScoreAlerts(activeAlertsToArchive, 'ESCALATED');
    if (!shouldCreate) continue;

    const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
    const alert = await prisma.alert.create({
      data: {
        level: rule.level as any,
        type: rule.type,
        title: rule.title,
        description: rule.description.replace('{trackingId}', manifest.trackingId),
        manifestId: manifest.id,
        targetUsers: { connect: targetUserIds.map(id => ({ id })) },
      },
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
      if (rule.level === 'L2') results.l2Alerts++;
      else if (rule.level === 'L3') results.l3Alerts++;
      else if (rule.level === 'L4') results.l4Alerts++;
    }
  }

  // ── GROUP 3: GHOST DELIVERY TYPE 2 (Receiver QC Rejection, No Claim) ─────────
  // RECEIVER_REJECTION Evidence exists on a manifest that still has no claimId.
  // Fire at 6H / 12H / 24H working hours since the Evidence was created.
  const rejectionEvidences = await prisma.evidence.findMany({
    where: {
      type: 'RECEIVER_REJECTION',
      manifest: { claimId: null },
      manifestId: { not: null },
    },
    include: {
      manifest: {
        include: {
          alerts: { where: { resolved: false, type: { startsWith: 'GHOST_DELIVERY_T2' } } },
        },
      },
    },
  });

  for (const ev of rejectionEvidences) {
    if (!ev.manifest) continue;
    const manifest = ev.manifest;

    const workingHrsElapsed = calculateWarehouseWorkingHours(ev.createdAt, now, startTimeStr, endTimeStr, timezoneStr);
    let targetAlertType: string | null = null;
    if (workingHrsElapsed >= 24) {
      targetAlertType = 'GHOST_DELIVERY_T2_24H';
    } else if (workingHrsElapsed >= 12) {
      targetAlertType = 'GHOST_DELIVERY_T2_12H';
    } else if (workingHrsElapsed >= 6) {
      targetAlertType = 'GHOST_DELIVERY_T2_6H';
    }
    if (!targetAlertType) continue;

    const rule = ALERT_RULE_BY_TYPE[targetAlertType];
    if (!rule) continue;

    const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);
    if (exactAlertExists) continue;

    const T2_TIER_PRIORITY: Record<string, number> = {
      GHOST_DELIVERY_T2_6H: 1,
      GHOST_DELIVERY_T2_12H: 2,
      GHOST_DELIVERY_T2_24H: 3,
    };
    const targetPriority = T2_TIER_PRIORITY[targetAlertType] ?? 0;
    const activeAlertsToArchive: string[] = [];
    let shouldCreate = true;
    for (const active of manifest.alerts) {
      const activePriority = T2_TIER_PRIORITY[active.type] ?? 0;
      if (activePriority < targetPriority) activeAlertsToArchive.push(active.id);
      else if (activePriority > targetPriority) shouldCreate = false;
    }
    if (activeAlertsToArchive.length > 0) await archiveAndScoreAlerts(activeAlertsToArchive, 'ESCALATED');
    if (!shouldCreate) continue;

    const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
    const alert = await prisma.alert.create({
      data: {
        level: rule.level as any,
        type: rule.type,
        title: rule.title,
        description: rule.description.replace('{trackingId}', manifest.trackingId),
        manifestId: manifest.id,
        targetUsers: { connect: targetUserIds.map(id => ({ id })) },
      },
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
      if (rule.level === 'L2') results.l2Alerts++;
      else if (rule.level === 'L3') results.l3Alerts++;
      else if (rule.level === 'L4') results.l4Alerts++;
    }
  }

  // ── GROUP 4: RECEIVE UPDATE PENDING ───────────────────────────────────────────
  // Manifest.qcCheckedAt is set (receiver physically checked the package) but the
  // manifest status is still EXPECTED or IN_TRANSIT — i.e., the acceptance was not
  // confirmed in the system. Fire at 2H (L1) and 6H (L2) working hours.
  const qcCheckedPendingManifests = await prisma.manifest.findMany({
    where: {
      qcCheckedAt: { not: null },
      status: { in: ['EXPECTED', 'IN_TRANSIT'] },
    },
    include: {
      alerts: { where: { resolved: false, type: { startsWith: 'RECEIVE_UPDATE_PENDING' } } },
    },
  });

  for (const manifest of qcCheckedPendingManifests) {
    if (!manifest.qcCheckedAt) continue;
    const workingHrsElapsed = calculateWarehouseWorkingHours(manifest.qcCheckedAt, now, startTimeStr, endTimeStr, timezoneStr);

    let targetAlertType: string | null = null;
    if (workingHrsElapsed >= 6) {
      targetAlertType = 'RECEIVE_UPDATE_PENDING_6H';
    } else if (workingHrsElapsed >= 2) {
      targetAlertType = 'RECEIVE_UPDATE_PENDING_2H';
    }
    if (!targetAlertType) continue;

    const rule = ALERT_RULE_BY_TYPE[targetAlertType];
    if (!rule) continue;

    const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);
    if (exactAlertExists) continue;

    const RUP_TIER_PRIORITY: Record<string, number> = {
      RECEIVE_UPDATE_PENDING_2H: 1,
      RECEIVE_UPDATE_PENDING_6H: 2,
    };
    const targetPriority = RUP_TIER_PRIORITY[targetAlertType] ?? 0;
    const activeAlertsToArchive: string[] = [];
    let shouldCreate = true;
    for (const active of manifest.alerts) {
      const activePriority = RUP_TIER_PRIORITY[active.type] ?? 0;
      if (activePriority < targetPriority) activeAlertsToArchive.push(active.id);
      else if (activePriority > targetPriority) shouldCreate = false;
    }
    if (activeAlertsToArchive.length > 0) await archiveAndScoreAlerts(activeAlertsToArchive, 'ESCALATED');
    if (!shouldCreate) continue;

    // Target the specific receiver if known, else resolve by role
    let targetUserIds: string[] = [];
    if (manifest.receivedBy) {
      const receiver = await prisma.user.findUnique({ where: { email: manifest.receivedBy }, select: { id: true } });
      if (receiver) targetUserIds.push(receiver.id);
    }
    if (targetUserIds.length === 0) {
      targetUserIds = await resolveTargetUserIds(rule.targetRoles);
    }

    const alert = await prisma.alert.create({
      data: {
        level: rule.level as any,
        type: rule.type,
        title: rule.title,
        description: rule.description.replace('{trackingId}', manifest.trackingId),
        manifestId: manifest.id,
        targetUsers: { connect: targetUserIds.map(id => ({ id })) },
      },
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
      if (rule.level === 'L1') results.nudges++;
      else if (rule.level === 'L2') results.l2Alerts++;
    }
  }

  // ── GROUP 15: INVENTORISATION PENDING ─────────────────────────────────────────
  // ItemStatus with status='QC' (handed to QC team for inventorisation but not yet
  // completed). Fire at 12H / 18H / 24H / 48H working hours since the item arrived at QC.
  // "Completed" means isRefurbished = true OR the manifest is RECOVERED_TO_INVENTORY.
  const qcPendingItems = await prisma.itemStatus.findMany({
    where: {
      status: 'QC',
      isRefurbished: false,           // still not processed
      manifestId: { not: null },
      manifest: {
        status: { not: 'RECOVERED_TO_INVENTORY' },  // manifest not fully done
      },
    },
    include: {
      manifest: {
        include: {
          alerts: { where: { resolved: false, type: { startsWith: 'INVENTORISATION_PENDING' } } },
        },
      },
    },
  });

  for (const item of qcPendingItems) {
    if (!item.manifest) continue;
    const manifest = item.manifest;

    const workingHrsElapsed = calculateWarehouseWorkingHours(item.createdAt, now, startTimeStr, endTimeStr, timezoneStr);
    let targetAlertType: string | null = null;
    if (workingHrsElapsed >= 48) {
      targetAlertType = 'INVENTORISATION_PENDING_48H';
    } else if (workingHrsElapsed >= 24) {
      targetAlertType = 'INVENTORISATION_PENDING_24H';
    } else if (workingHrsElapsed >= 18) {
      targetAlertType = 'INVENTORISATION_PENDING_18H';
    } else if (workingHrsElapsed >= 12) {
      targetAlertType = 'INVENTORISATION_PENDING_12H';
    }
    if (!targetAlertType) continue;

    const rule = ALERT_RULE_BY_TYPE[targetAlertType];
    if (!rule) continue;

    const exactAlertExists = manifest.alerts.some(a => a.type === targetAlertType);
    if (exactAlertExists) continue;

    const INV_TIER_PRIORITY: Record<string, number> = {
      INVENTORISATION_PENDING_12H: 1,
      INVENTORISATION_PENDING_18H: 2,
      INVENTORISATION_PENDING_24H: 3,
      INVENTORISATION_PENDING_48H: 4,
    };
    const targetPriority = INV_TIER_PRIORITY[targetAlertType] ?? 0;
    const activeAlertsToArchive: string[] = [];
    let shouldCreate = true;
    for (const active of manifest.alerts) {
      const activePriority = INV_TIER_PRIORITY[active.type] ?? 0;
      if (activePriority < targetPriority) activeAlertsToArchive.push(active.id);
      else if (activePriority > targetPriority) shouldCreate = false;
    }
    if (activeAlertsToArchive.length > 0) await archiveAndScoreAlerts(activeAlertsToArchive, 'ESCALATED');
    if (!shouldCreate) continue;

    const targetUserIds = await resolveTargetUserIds(rule.targetRoles);
    const alert = await prisma.alert.create({
      data: {
        level: rule.level as any,
        type: rule.type,
        title: rule.title,
        description: rule.description.replace('{trackingId}', manifest.trackingId),
        manifestId: manifest.id,
        targetUsers: { connect: targetUserIds.map(id => ({ id })) },
      },
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
      if (rule.level === 'L1') results.nudges++;
      else if (rule.level === 'L2') results.l2Alerts++;
      else if (rule.level === 'L3') results.l3Alerts++;
      else if (rule.level === 'L4') results.l4Alerts++;
    }
  }

  // ── GROUP 17: MISSING TRACKING NUMBER ─────────────────────────────────────────
  // AMZRemovalShipment rows where trackingNumber IS NULL — Amazon has a shipment record
  // but has not assigned a tracking number. Dashboard-only nudge (L2, no email).
  // Suppress if already have an active alert for this orderId.
  const noTrackingShipments = await prisma.aMZRemovalShipment.findMany({
    where: { trackingNumber: null, orderId: { not: null } },
    select: { orderId: true },
    distinct: ['orderId'],
  });

  for (const row of noTrackingShipments) {
    if (!row.orderId) continue;
    const existing = await prisma.alert.findFirst({
      where: { type: 'ORDER_NO_TRACKING_ID', description: { contains: row.orderId }, resolved: false },
    });
    if (existing) continue;

    const adminUsers = await resolveTargetUserIds(['L2']);
    const alert = await prisma.alert.create({
      data: {
        level: 'L2',
        type: 'ORDER_NO_TRACKING_ID',
        title: 'Shipment Row Has No Tracking Number',
        description: `Removal Order ${row.orderId} has a shipment record in Amazon data but no tracking number is assigned. This may resolve automatically on the next Amazon report sync.`,
        targetUsers: { connect: adminUsers.map(id => ({ id })) },
      },
    });
    if (alert) {
      dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher]', err));
      results.l2Alerts++;
    }
  }

  // ── ARCHIVE PRUNING ──

  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  await prisma.alertLog.deleteMany({
    where: { createdAt: { lt: oneYearAgo } }
  });

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
