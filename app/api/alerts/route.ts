import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SOP_MAP } from '@/lib/alertRules';

// Alert level access policy:
//   ADMIN       → L1–L4 (all operational levels)
//   SUPER_ACCESS → all levels including L4 (critical: phone + WhatsApp to leadership)
//   RECEIVER    → L1, L2 only
const ADMIN_VISIBLE_LEVELS = ['L1', 'L2', 'L3', 'L4'];
const ALL_LEVELS            = ['L1', 'L2', 'L3', 'L4'];

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['ADMIN', 'SUPER_ACCESS', 'RECEIVER', 'INSPECTOR'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const showResolved = searchParams.get('resolved') === 'true';

    // Determine which levels this role can see
    let visibleLevels = role === 'SUPER_ACCESS' ? ALL_LEVELS : (role === 'RECEIVER' || role === 'INSPECTOR') ? ['L1', 'L2'] : ADMIN_VISIBLE_LEVELS;

    const sessionUserId = req.headers.get('x-user-id');
    const sessionUserEmail = req.headers.get('x-user-email');
    if (sessionUserId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { alertLevel: true }
      });
      if (dbUser && dbUser.alertLevel) {
        visibleLevels = [dbUser.alertLevel];
      }
    }

    // Build the dynamic where clause
    const whereClause: any = {
      resolved: showResolved,
      level: { in: visibleLevels as any },
    };

    // Filter L1 alerts for RECEIVER or INSPECTOR roles to only see their own processed/targeted items
    if (role === 'RECEIVER' || role === 'INSPECTOR') {
      const emailLower = sessionUserEmail?.toLowerCase() || '';
      whereClause.OR = [
        {
          level: { not: 'L1' }
        },
        {
          level: 'L1',
          OR: role === 'RECEIVER' ? [
            { targetUserId: sessionUserId || undefined },
            { manifest: { receivedBy: emailLower } }
          ] : [
            { targetUserId: sessionUserId || undefined },
            { manifest: { inspectedBy: emailLower } }
          ]
        }
      ];
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        manifest: {
          select: { trackingId: true, status: true, claimId: true, receivedBy: true, inspectedBy: true }
        },
        targetUser: {
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

    // Construct SOP steps from central alertRules registry (all 42 types included)
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
        instruction: inst
      }));
    }

    // Count by level (only visible levels)
    const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, total: 0 };
    if (!showResolved) {
      const unresolvedWhere: any = {
        resolved: false,
        level: { in: visibleLevels as any },
      };
      if (role === 'RECEIVER' || role === 'INSPECTOR') {
        const emailLower = sessionUserEmail?.toLowerCase() || '';
        unresolvedWhere.OR = [
          {
            level: { not: 'L1' }
          },
          {
            level: 'L1',
            OR: role === 'RECEIVER' ? [
              { targetUserId: sessionUserId || undefined },
              { manifest: { receivedBy: emailLower } }
            ] : [
              { targetUserId: sessionUserId || undefined },
              { manifest: { inspectedBy: emailLower } }
            ]
          }
        ];
      }

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

    const statsWhere: any = {
      resolved: true,
      resolvedAt: { gte: startOfToday },
      level: { in: visibleLevels as any },
    };
    if (role === 'RECEIVER' || role === 'INSPECTOR') {
      const emailLower = sessionUserEmail?.toLowerCase() || '';
      statsWhere.OR = [
        {
          level: { not: 'L1' }
        },
        {
          level: 'L1',
          OR: role === 'RECEIVER' ? [
            { targetUserId: sessionUserId || undefined },
            { manifest: { receivedBy: emailLower } }
          ] : [
            { targetUserId: sessionUserId || undefined },
            { manifest: { inspectedBy: emailLower } }
          ]
        }
      ];
    }

    const resolvedTodayCount = await prisma.alert.count({
      where: statsWhere
    });

    const sopFollowedTodayCount = await prisma.alert.count({
      where: { ...statsWhere, sopAcknowledged: true }
    });

    const stats = {
      resolvedToday: resolvedTodayCount,
      sopFollowedToday: sopFollowedTodayCount,
      adherenceRate: resolvedTodayCount > 0 ? Math.round((sopFollowedTodayCount / resolvedTodayCount) * 100) : 100
    };

    return NextResponse.json({ alerts, sopMap, counts, role, stats });
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

  const PAST_DOCK       = ['IN_INSPECTION', 'INSPECTED', 'CLAIMS_STAGING', 'CLAIM_RESOLVED', 'RECOVERED_TO_INVENTORY'];
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

  // Inspection QC failed / Recovery rejections / QC rejections → claim must be filed
  if (t.startsWith('INSPECTION_QC_FAILED') || t.includes('REJECTION')) {
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
    if (!role || !['ADMIN', 'SUPER_ACCESS', 'RECEIVER', 'INSPECTOR'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { alertId, resolution, forceResolve, sopAcknowledged } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 });
    }

    // Handle bulk resolves: if alertId is an array, resolve all
    const ids: string[] = Array.isArray(alertId) ? alertId : [alertId];

    const resolved = [];
    const blocked = [];

    for (const id of ids) {
      // Fetch the alert with manifest for data check
      const alertRecord = await prisma.alert.findUnique({
        where: { id },
        include: {
          manifest: { select: { status: true, claimId: true, trackingId: true } }
        }
      });

      if (!alertRecord) { blocked.push({ id, reason: 'Alert not found' }); continue; }
      if (alertRecord.resolved) { resolved.push({ id, skipped: true }); continue; }

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

      const updated = await prisma.alert.update({
        where: { id },
        data: updateData
      });
      resolved.push(updated);
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
