import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SOP_MAP, ALERT_RULE_BY_TYPE } from '@/lib/alertRules';
import { archiveAndScoreAlerts } from '@/lib/alertLogger';
import { normalizeLanguage, translateInstruction } from '@/lib/i18n';

// Alert level hierarchies
const LEVEL_VALUES: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4 };

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['ADMIN', 'SUPER_ACCESS', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST', 'QC_AGENT', 'RECOVERER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const showResolved = searchParams.get('resolved') === 'true';

    const sessionUserId = req.headers.get('x-user-id');
    const sessionUserEmail = req.headers.get('x-user-email');

    // 1. Resolve user's hierarchical alert level (DB config is checked first; admin/super-access default to L4)
    let userLevel = 'L1';
    let preferredLanguage = normalizeLanguage(req.headers.get('x-user-language'));
    if (sessionUserId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { alertLevel: true }
      });
      if (dbUser?.alertLevel) {
        userLevel = dbUser.alertLevel;
      }
    } else if (role === 'SUPER_ACCESS' || role === 'ADMIN') {
      userLevel = 'L4';
    }

    const dashboard = searchParams.get('dashboard') === 'true';
    const userLevelVal = LEVEL_VALUES[userLevel] || 1;
    const emailLower = sessionUserEmail?.toLowerCase() || '';

    // 2. Build visibility conditions exactly as sets
    // Related items: targeted to user, or received/inspected by them
    const relationConditions = [
      sessionUserId ? { targetUsers: { some: { id: sessionUserId } } } : {},
      { manifest: { receivedBy: emailLower } },
      { manifest: { inspectedBy: emailLower } }
    ];

    const isL4 = userLevel === 'L4';
    const isL3 = userLevel === 'L3';
    const isL2 = userLevel === 'L2';

    const visibilityOrConditions: any[] = [];

    if (dashboard) {
      // Dashboard view: do not show high level alerts to lower level users at all
      if (isL4) {
        visibilityOrConditions.push(
          { level: 'L1' },
          { level: 'L2' },
          { level: 'L3' },
          { level: 'L4' }
        );
      } else if (isL3) {
        visibilityOrConditions.push(
          { level: 'L3' },
          { level: 'L2', OR: relationConditions },
          { level: 'L1', OR: relationConditions }
        );
      } else if (isL2) {
        visibilityOrConditions.push(
          { level: 'L2' },
          { level: 'L1', OR: relationConditions }
        );
      } else {
        // L1 sees L1 only if related
        visibilityOrConditions.push(
          { level: 'L1', OR: relationConditions }
        );
      }
    } else {
      // Notification dropdown (bell) view: let them see related higher level alerts too
      if (isL4) {
        // L4 user sees all levels unconditionally
        visibilityOrConditions.push(
          { level: 'L1' },
          { level: 'L2' },
          { level: 'L3' },
          { level: 'L4' }
        );
      } else if (isL3) {
        // L3 user sees L3 & L4 unconditionally, L1 & L2 only if related
        visibilityOrConditions.push(
          { level: 'L3' },
          { level: 'L4' },
          { level: 'L2', OR: relationConditions },
          { level: 'L1', OR: relationConditions }
        );
      } else if (isL2) {
        // L2 user sees L2, L3, & L4 unconditionally, L1 only if related
        visibilityOrConditions.push(
          { level: 'L2' },
          { level: 'L3' },
          { level: 'L4' },
          { level: 'L1', OR: relationConditions }
        );
      } else {
        // L1 user sees all levels ONLY if related
        visibilityOrConditions.push(
          { level: 'L1', OR: relationConditions },
          { level: 'L2', OR: relationConditions },
          { level: 'L3', OR: relationConditions },
          { level: 'L4', OR: relationConditions }
        );
      }
    }

    // Combine conditions with role-based type exclusions (e.g. Inspectors cannot see Receiver alerts)
    const isInspector = role === 'INSPECTOR';
    const isReceiver = role === 'RECEIVER';
    const receiverAlertTypes = ['RECEIVE_UPDATE_PENDING', 'RECV_INSP_HANDSHAKE'];
    const inspectorAlertTypes = ['INSPECTION_PENDING', 'INSPECTION_QC_FAILED', 'INSP_RECOVERY_HANDSHAKE', 'INSP_QC_HANDSHAKE'];

    const exclusionConditions: any[] = [];
    if (isInspector) {
      receiverAlertTypes.forEach(prefix => {
        exclusionConditions.push({ type: { not: { startsWith: prefix } } });
      });
    } else if (isReceiver) {
      inspectorAlertTypes.forEach(prefix => {
        exclusionConditions.push({ type: { not: { startsWith: prefix } } });
      });
    }

    const whereClause: any = {
      resolved: showResolved,
      AND: exclusionConditions.length > 0 ? exclusionConditions : undefined,
      OR: visibilityOrConditions
    };

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        manifest: {
          select: { trackingId: true, status: true, claimId: true, receivedBy: true, inspectedBy: true }
        },
        targetUsers: {
          select: { email: true, name: true, role: true }
        },
        resolvedBy: {
          select: { email: true, name: true }
        }
      },
      orderBy: [
        { level: 'desc' },  // L4 first
        { createdAt: 'desc' }
      ]
    });

    // Construct SOP steps from central alertRules registry
    const alertTypes = [...new Set(alerts.map(a => a.type))];
    const sopMap: Record<string, { id: string; stepOrder: number; instruction: string }[]> = {};
    for (const type of alertTypes) {
      const steps = SOP_MAP[type] || [
        "Inspect manifest status and check associated evidences.",
        "Take necessary corrective actions to resolve the operational alert."
      ];
      sopMap[type] = steps.map((inst, idx) => ({
        id: `${type}_sop_${idx}`,
        stepOrder: idx + 1,
        instruction: translateInstruction(inst, preferredLanguage)
      }));
    }

    // Count by level (only visible levels)
    const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, total: 0 };
    if (!showResolved) {
      const unresolvedWhere: any = {
        resolved: false,
        AND: exclusionConditions.length > 0 ? exclusionConditions : undefined,
        OR: visibilityOrConditions
      };

      const countResult = await prisma.alert.groupBy({
        by: ['level'],
        where: unresolvedWhere,
        _count: true,
      });
      for (const row of countResult) {
        counts[row.level] = row._count;
        counts.total += row._count;
      }
    }

    // Compute stats for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const logWhere: any = {
      status: "RESOLVED",
      createdAt: { gte: startOfToday },
    };
    if (sessionUserId && !isL4 && !isL3) {
       // Only filter by user ID if they aren't higher level management
       logWhere.targetUserIds = { has: sessionUserId };
    }

    const resolvedTodayCount = await prisma.alertLog.count({
      where: logWhere
    });

    const sopFollowedTodayCount = await prisma.alertLog.count({
      where: { ...logWhere, sopFollowed: true }
    });

    const stats = {
      resolvedToday: resolvedTodayCount,
      sopFollowedToday: sopFollowedTodayCount,
      adherenceRate: resolvedTodayCount > 0 ? Math.round((sopFollowedTodayCount / resolvedTodayCount) * 100) : 100
    };

    return NextResponse.json({ alerts, sopMap, counts, role, stats, userLevel });
  } catch (error: any) {
    console.error('Alerts GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ─── Data-driven resolution check ────────────────────────────────────────────
// Before an alert is marked resolved, we verify the underlying issue is fixed.
function checkResolvable(
  alertType: string,
  manifestStatus: string | null,
  claimId: string | null,
  trackingId: string | null
): { canResolve: boolean; reason?: string } {
  if (!manifestStatus) return { canResolve: true }; // No manifest linked → allow manual resolve

  const t = alertType;
  const id = trackingId || 'this package';

  const PAST_DOCK = ['IN_INSPECTION', 'INSPECTED', 'CLAIMS_STAGING', 'CLAIM_RESOLVED', 'RECOVERED_TO_INVENTORY'];
  const FULLY_PROCESSED = ['INSPECTED', 'CLAIMS_STAGING', 'CLAIM_RESOLVED', 'RECOVERED_TO_INVENTORY'];

  // Delivery breaches / ghost delivery → package must have arrived
  if (t.startsWith('DELIVERY_ETA_BREACH') || t.startsWith('GHOST_DELIVERY')) {
    if (manifestStatus === 'EXPECTED') {
      return { canResolve: false, reason: `${id} is still in 'Expected' status. Ensure the delivery is received or a transit claim is filed first.` };
    }
  }

  // Receive update pending → must be past AT_DOCK
  if (t.startsWith('RECEIVE_UPDATE_PENDING')) {
    if (manifestStatus === 'AT_DOCK') {
      return { canResolve: false, reason: `${id} is still at the dock. Complete receiver acceptance in the system first.` };
    }
  }

  // Receiver→Inspector handshake → must be in inspection or beyond
  if (t.startsWith('RECV_INSP_HANDSHAKE')) {
    if (!PAST_DOCK.includes(manifestStatus)) {
      return { canResolve: false, reason: `${id} has not been handed over to inspection yet (status: ${manifestStatus}). Complete the handover first.` };
    }
  }

  // Inspection pending → must be inspected
  if (t.startsWith('INSPECTION_PENDING')) {
    if (!FULLY_PROCESSED.includes(manifestStatus)) {
      return { canResolve: false, reason: `Inspection for ${id} is not complete yet (status: ${manifestStatus}). Complete the inspection first.` };
    }
  }

  // Inspection QC failed / Recovery rejections / QC rejections / Ghost Delivery T2 → claim must be filed
  if (t.startsWith('INSPECTION_QC_FAILED') || t.includes('REJECTION') || t.startsWith('GHOST_DELIVERY_T2')) {
    if (!claimId) {
      return { canResolve: false, reason: `No claim has been filed for ${id}. File the claim in Amazon Seller Central and add the Claim ID to the manifest before resolving.` };
    }
  }

  // Inventorisation / Recovery-QC / Inspector-QC / Inspector-Recovery handshakes → must be inventorised
  if (
    t.startsWith('INVENTORISATION_PENDING') ||
    t.startsWith('RECOVERY_QC_HANDSHAKE') ||
    t.startsWith('INSP_QC_HANDSHAKE') ||
    t.startsWith('INSP_RECOVERY_HANDSHAKE')
  ) {
    if (manifestStatus !== 'RECOVERED_TO_INVENTORY') {
      return { canResolve: false, reason: `${id} has not been inventorised yet (status: ${manifestStatus}). Complete inventorisation first.` };
    }
  }

  return { canResolve: true };
}

export async function PATCH(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');
    if (!role || !['ADMIN', 'SUPER_ACCESS', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST', 'QC_AGENT', 'RECOVERER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { alertId, resolution, forceResolve, sopAcknowledged } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 });
    }

    // Handle bulk resolves: if alertId is an array, resolve all
    const ids: string[] = Array.isArray(alertId) ? alertId : [alertId];

    // Resolve user's hierarchical alert level to enforce resolution permissions (DB config checked first)
    let userLevel = 'L1';
    let dbUser = null;
    if (userId) {
      dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { alertLevel: true }
      });
    }

    if (dbUser && dbUser.alertLevel) {
      userLevel = dbUser.alertLevel;
    } else if (role === 'SUPER_ACCESS' || role === 'ADMIN') {
      userLevel = 'L4';
    }

    const userLevelVal = LEVEL_VALUES[userLevel] || 1;

    const resolved = [];
    const blocked = [];

    for (const id of ids) {
      // Fetch the alert with manifest for data check
      const alertRecord = await prisma.alert.findUnique({
        where: { id },
        include: {
          manifest: { select: { status: true, claimId: true, trackingId: true } },
          targetUsers: { select: { id: true } }
        }
      });

      if (!alertRecord) { blocked.push({ id, reason: 'Alert not found' }); continue; }
      if (alertRecord.resolved) { resolved.push({ id, skipped: true }); continue; }

      // Enforce permission: can resolve if user is in targetUsers, or an admin/super-access, or the user's role or level is in the targetRoles
      const rule = ALERT_RULE_BY_TYPE[alertRecord.type];
      const targetRoles = rule?.targetRoles || [];
      const isTargetRole = targetRoles.some(tRole => {
        const cleanTRole = tRole.trim().toUpperCase();
        return cleanTRole === role || cleanTRole === userLevel;
      });

      const canResolveAlert =
        role === 'ADMIN' ||
        role === 'SUPER_ACCESS' ||
        alertRecord.targetUsers.some((u: any) => u.id === userId) ||
        isTargetRole;

      if (!canResolveAlert) {
        blocked.push({
          id,
          reason: `Forbidden: You are not targeted for this alert. Only targeted users or administrators can resolve it.`,
          dataIssue: false
        });
        continue;
      }

      // Skip data check if forceResolve=true (super-admin override) or no manifest
      if (!forceResolve) {
        const check = checkResolvable(
          alertRecord.type,
          alertRecord.manifest?.status || null,
          alertRecord.manifest?.claimId || null,
          alertRecord.manifest?.trackingId || null
        );
        if (!check.canResolve) {
          blocked.push({ id, reason: check.reason, dataIssue: true, trackingId: alertRecord.manifest?.trackingId });
          continue;
        }
      }

      const updateData: any = {
        resolved: true,
        resolvedAt: new Date(),
        resolution: resolution || 'Resolved by admin',
        sopAcknowledged: !!sopAcknowledged,
        sopViewedAt: sopAcknowledged ? new Date() : null,
      };

      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true }
        });
        if (dbUser) {
          updateData.resolvedById = dbUser.id;
        } else {
          updateData.resolvedById = null;
        }
      } else {
        updateData.resolvedById = null;
      }

      const sopFollowed = !!sopAcknowledged;

      await archiveAndScoreAlerts([id], "RESOLVED", sopFollowed, updateData.resolvedById);

      resolved.push({ ...alertRecord, resolved: true, resolvedAt: new Date(), resolution: updateData.resolution });
    }

    // Single alert resolve — return the original shape for backwards compat
    if (ids.length === 1) {
      if (blocked.length > 0) {
        return NextResponse.json(
          { error: blocked[0].reason, dataIssue: (blocked[0] as any).dataIssue || false },
          { status: (blocked[0] as any).dataIssue ? 422 : 400 }
        );
      }
      return NextResponse.json({ success: true, alert: resolved[0] });
    }

    // Bulk resolve response
    return NextResponse.json({ success: true, resolved: resolved.length, blocked: blocked.length, blockedDetails: blocked });
  } catch (error: any) {
    console.error('Alerts PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
