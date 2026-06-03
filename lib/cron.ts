import { prisma } from "@/lib/prisma";
import { PackageState } from "@prisma/client";
import { fetchTrackingSnapshot } from "@/lib/trackcourier";
import * as amazonRawReports from "../scripts/fetch_amz_raw_reports.js";
import { runShopifyReturnsJob } from "@/lib/shopifyReturns";
import { ALERT_RULE_BY_TYPE } from "./alertRules";
import { calculateWarehouseWorkingHours } from "./timeUtils";
import { resolveTargetUserId } from "./alertTargeting";
import { archiveAndScoreAlerts } from "./alertLogger";
import { dispatchAlert } from "./alertDispatcher";


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
    targetUserId?: string;
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
                const targetUserId = await resolveTargetUserId(rule.targetRoles);
                alertsToCreate.push({
                  level: rule.level as any,
                  type: rule.type,
                  title: rule.title,
                  description: rule.description.replace(
                    "{trackingId}",
                    task.trackingNumber,
                  ),
                  manifestId: task.manifestId,
                  targetUserId: targetUserId || undefined,
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
    
    // Retrieve newly created alerts to dispatch notifications asynchronously
    prisma.alert.findMany({
      where: {
        manifestId: { in: alertsToCreate.map(a => a.manifestId).filter(Boolean) as string[] },
        type: { in: alertsToCreate.map(a => a.type) },
        resolved: false
      },
      select: { id: true }
    }).then(newlyCreated => {
      for (const a of newlyCreated) {
        dispatchAlert(a.id).catch(err => console.error('[Alert Dispatcher Error]', err));
      }
    }).catch(err => console.error('[Alert Query Error]', err));
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
    } catch(e) {}
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

    const alert = await prisma.alert.create({ data });
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
            const targetUserId = await resolveTargetUserId(rule.targetRoles);
            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUserId: targetUserId || undefined,
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
            let finalTargetId: string | null = null;
            if (manifest.inspectedBy) {
              const inspectorUser = await prisma.user.findUnique({ where: { email: manifest.inspectedBy } });
              if (inspectorUser) finalTargetId = inspectorUser.id;
            }
            if (!finalTargetId) {
              finalTargetId = await resolveTargetUserId(rule.targetRoles);
            }

            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUserId: finalTargetId || undefined,
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
            const targetUserId = await resolveTargetUserId(rule.targetRoles);
            const alert = await prisma.alert.create({
              data: {
                level: rule.level as any,
                type: rule.type,
                title: rule.title,
                description: rule.description.replace("{trackingId}", manifest.trackingId),
                manifestId: manifest.id,
                targetUserId: targetUserId || undefined,
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
    let targetUserId: string | null = null;

    if (hoursPending >= 18) {
      targetAlertType = "INSP_RECOVERY_HANDSHAKE_18H";
      targetAlertLevel = "L2";
    } else if (hoursPending >= 12) {
      targetAlertType = "INSP_RECOVERY_HANDSHAKE_12H";
      targetAlertLevel = "L1";
      // L1 targets the inspector
      if (item.manifest.inspectedBy) {
        const inspectorUser = await prisma.user.findFirst({ where: { email: item.manifest.inspectedBy } });
        if (inspectorUser) targetUserId = inspectorUser.id;
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
          const alert = await prisma.alert.create({
            data: {
              level: targetAlertLevel,
              type: rule.type,
              title: rule.title,
              description: rule.description.replace("{trackingId}", item.manifest.trackingId),
              manifestId: item.manifest.id,
              targetUserId: targetUserId || undefined,
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
