import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALERT_RULE_BY_TYPE } from "@/lib/alertRules";

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

      return prisma.alert.create({
        data: {
          level: rule.level,
          type: rule.type,
          title: rule.title,
          description: rule.description.replace("{trackingId}", trackingId),
          manifestId,
        },
      });
    };

    // ── 1. DELIVERY ETA BREACH ──────────────────────────────────────────────
    // Packages still EXPECTED/IN_TRANSIT after their expected delivery date.
    // Fire the highest applicable breach tier (96h > 72h > 48h).
    const overdueManifests = await prisma.manifest.findMany({
      where: {
        status: { in: ["EXPECTED", "IN_TRANSIT"] as any },
        expectedDate: { not: null, lt: now },
      },
    });

    for (const manifest of overdueManifests) {
      if (!manifest.expectedDate) continue;
      const hoursOverdue =
        (now.getTime() - new Date(manifest.expectedDate).getTime()) /
        (1000 * 60 * 60);

      let alertType: string | null = null;
      if (hoursOverdue >= 96) alertType = "DELIVERY_ETA_BREACH_96H";
      else if (hoursOverdue >= 72) alertType = "DELIVERY_ETA_BREACH_72H";
      else if (hoursOverdue >= 48) alertType = "DELIVERY_ETA_BREACH_48H";

      if (!alertType) continue;

      const alert = await createAlertIfNew(
        alertType,
        manifest.id,
        manifest.trackingId,
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
