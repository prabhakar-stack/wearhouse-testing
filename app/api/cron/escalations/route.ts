import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALERT_RULE_BY_TYPE } from "@/lib/alertRules";

import { resolveTargetUserIds } from "@/lib/alertTargeting";
import { dispatchAlert } from "@/lib/alertDispatcher";
import { calculateWarehouseWorkingHours } from "@/lib/timeUtils";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET || "secret-cron-token"}`;
    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = {
      deliveryBreaches: 0,
      handshakeAlerts: 0,
      claimStagedAlerts: 0,
      ghostDeliveryT2Alerts: 0,
      receiveUpdatePendingAlerts: 0,
    };

    // Helper: create an alert using a canonical alertRules.ts rule, only if one
    // doesn't already exist (unresolved) for the same manifest + type.
    const createAlertIfNew = async (
      ruleType: string,
      manifestId: string,
      trackingId: string,
    ) => {
      const rule = ALERT_RULE_BY_TYPE[ruleType];
      if (!rule) {
        console.warn(`[Cron Escalations] Unknown rule type: ${ruleType}`);
        return null;
      }

      const existing = await prisma.alert.findFirst({
        where: { type: ruleType, manifestId, resolved: false },
      });
      if (existing) return null; // Already raised — skip

      const targetUserIds = await resolveTargetUserIds(rule.targetRoles);

      const alert = await prisma.alert.create({
        data: {
          level: rule.level,
          type: rule.type,
          title: rule.title,
          description: rule.description.replace("{trackingId}", trackingId),
          manifestId,
          targetUsers: {
            connect: targetUserIds.map(id => ({ id }))
          }
        },
      });

      if (alert) {
        dispatchAlert(alert.id).catch(err => console.error('[Alert Dispatcher Error]', err));
      }
      return alert;
    };

    // ── 1. DELIVERY ETA BREACH ──────────────────────────────────────────────
    // Use ShipmentTracking.scheduledDelivery as the authoritative ETA —
    // manifest.expectedDate is the Amazon removal request date (not a delivery ETA).
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

    const overdueSnapshots = await prisma.shipmentTracking.findMany({
      where: {
        manifest: {
          status: { in: ["EXPECTED", "IN_TRANSIT"] as any },
          removalOrderId: { not: null }, // has an associated removal order
        },
      },
      include: {
        manifest: {
          select: {
            id: true,
            trackingId: true,
            removalOrderId: true,
            status: true,
          },
        },
      },
    });

    const seenManifestIds = new Set<string>();
    for (const snap of overdueSnapshots) {
      if (!snap.manifest) continue;
      if (seenManifestIds.has(snap.manifest.id)) continue;
      seenManifestIds.add(snap.manifest.id);

      // Derive requestDate from the Order table via manifest.removalOrderId
      const orderRecord = snap.manifest.removalOrderId
        ? await prisma.order.findUnique({
            where: { platformOrderId: snap.manifest.removalOrderId },
            select: { requestDate: true },
          })
        : null;
      const orderRequestDate = orderRecord?.requestDate;
      if (!orderRequestDate) continue;

      // Baseline ETA: Order return date + 5 calendar days
      const etaDate = new Date(new Date(orderRequestDate).getTime() + 5 * 24 * 60 * 60 * 1000);
      
      // Skip if the current time has not yet passed the baseline ETA
      if (now.getTime() <= etaDate.getTime()) continue;

      const hoursOverdue = calculateWarehouseWorkingHours(
        etaDate,
        now,
        startTimeStr,
        endTimeStr,
        "Asia/Kolkata"
      );

      let alertType: string | null = null;
      if (hoursOverdue >= 96) alertType = "DELIVERY_ETA_BREACH_96H";
      else if (hoursOverdue >= 72) alertType = "DELIVERY_ETA_BREACH_72H";
      else if (hoursOverdue >= 48) alertType = "DELIVERY_ETA_BREACH_48H";
      // If tracking data missing, raise a tracking unavailable alert
      if (!snap.scheduledDelivery) {
        alertType = "TRACKING_DATA_MISSING";
      }

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        snap.manifest.id,
        snap.manifest.trackingId,
      );
      if (alert) results.deliveryBreaches++;
    }

    // ── 2. RECEIVER–INSPECTOR HANDSHAKE PENDING ─────────────────────────────
    // AT_DOCK packages that haven't been handed to an inspector yet, from a
    // previous day. Escalate based on days overdue and current hour.
    const dockManifests = await prisma.manifest.findMany({
      where: {
        status: "AT_DOCK",
        receivedAt: { not: null, lt: today },
        inspectedBy: null,
      },
    });

    for (const manifest of dockManifests) {
      if (!manifest.receivedAt) continue;
      const daysSinceReceipt = Math.floor(
        (today.getTime() - new Date(manifest.receivedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      let alertType: string | null = null;
      if (daysSinceReceipt >= 2) {
        // Day+2 or beyond — critical
        alertType = "RECV_INSP_HANDSHAKE_NEXT_DAY";
      } else if (daysSinceReceipt === 1) {
        // Yesterday's package — escalate by current time of day (IST hour awareness)
        const currentHour = now.getHours();
        if (currentHour >= 15)
          alertType = "RECV_INSP_HANDSHAKE_3PM"; // L3 ≥15:00
        else if (currentHour >= 12)
          alertType = "RECV_INSP_HANDSHAKE_12PM"; // L2 ≥12:00
        else alertType = "RECV_INSP_HANDSHAKE_10AM"; // L1 <12:00
      }

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        manifest.id,
        manifest.trackingId,
      );
      if (alert) results.handshakeAlerts++;
    }

    // ── 3. CLAIMS STAGING STALLED — CLAIM NOT FILED ─────────────────────────
    // Packages in CLAIMS_STAGING with no claimId set (claim not yet filed).
    // Maps to INSPECTION_QC_FAILED_* rules because the root cause is an
    // unresolved QC failure waiting for a claim. Fire the highest applicable tier.
    const claimsManifests = await prisma.manifest.findMany({
      where: {
        status: "CLAIMS_STAGING",
        claimId: null,
      },
    });

    for (const manifest of claimsManifests) {
      const startTime = manifest.receivedAt ?? manifest.createdAt;
      const hoursInStaging =
        (now.getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);

      let alertType: string | null = null;
      if (hoursInStaging >= 24)
        alertType = "INSPECTION_QC_FAILED_24H"; // L4
      else if (hoursInStaging >= 12)
        alertType = "INSPECTION_QC_FAILED_12H"; // L3
      else if (hoursInStaging >= 6) alertType = "INSPECTION_QC_FAILED_6H"; // L2

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        manifest.id,
        manifest.trackingId,
      );
      if (alert) results.claimStagedAlerts++;
    }

    // ── 4. GHOST DELIVERY TYPE 2 ─────────────────────────────────────────────
    // Package QC failed by Receiver (Evidence of type RECEIVER_REJECTION exists)
    // + No claim created yet (claimId is null)
    // + Courier tracking marks delivered / undelivered
    // + 6h, 12h, or 24h elapsed since the rejection evidence was created.
    const rejectionEvidences = await prisma.evidence.findMany({
      where: {
        type: "RECEIVER_REJECTION",
        manifestId: { not: null },
        manifest: {
          claimId: null, // no claim created yet
        },
      },
      include: {
        manifest: {
          select: {
            id: true,
            trackingId: true,
            status: true,
            trackingSnapshots: {
              select: { latestStatus: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const ev of rejectionEvidences) {
      if (!ev.manifest) continue;
      
      const snapStatus = ev.manifest.trackingSnapshots?.[0]?.latestStatus || "";
      const isDeliveredOrUndelivered = /delivered|completed|received|proof of delivery|undelivered|returned/i.test(snapStatus);
      if (!isDeliveredOrUndelivered) continue;

      const hoursOverdue = calculateWarehouseWorkingHours(
        ev.createdAt,
        now,
        startTimeStr,
        endTimeStr,
        "Asia/Kolkata"
      );

      let alertType: string | null = null;
      if (hoursOverdue >= 24) alertType = "GHOST_DELIVERY_T2_24H";
      else if (hoursOverdue >= 12) alertType = "GHOST_DELIVERY_T2_12H";
      else if (hoursOverdue >= 6) alertType = "GHOST_DELIVERY_T2_6H";

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        ev.manifest.id,
        ev.manifest.trackingId,
      );
      if (alert) results.ghostDeliveryT2Alerts++;
    }

    // ── 5. RECEIVE UPDATE PENDING ────────────────────────────────────────────
    // Manifest has qcCheckedAt not null
    // + Status is still EXPECTED or IN_TRANSIT (acceptance still pending)
    // + 2h or 6h elapsed since qcCheckedAt working hours.
    const pendingManifests = await prisma.manifest.findMany({
      where: {
        qcCheckedAt: { not: null },
        status: { in: ["EXPECTED", "IN_TRANSIT"] as any },
      },
    });

    for (const manifest of pendingManifests) {
      if (!manifest.qcCheckedAt) continue;

      const hoursOverdue = calculateWarehouseWorkingHours(
        manifest.qcCheckedAt,
        now,
        startTimeStr,
        endTimeStr,
        "Asia/Kolkata"
      );

      let alertType: string | null = null;
      if (hoursOverdue >= 6) alertType = "RECEIVE_UPDATE_PENDING_6H";
      else if (hoursOverdue >= 2) alertType = "RECEIVE_UPDATE_PENDING_2H";

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        manifest.id,
        manifest.trackingId,
      );
      if (alert) results.receiveUpdatePendingAlerts++;
    }

    console.log("[Cron Escalations] Results:", results);
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
