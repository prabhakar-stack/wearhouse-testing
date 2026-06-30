import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/logs
// Query params:
//   range: 'today' | 'week' | 'month' | 'year' | 'custom'
//   from: ISO date string (required when range=custom)
//   to: ISO date string (required when range=custom)
//   view: 'packages' | 'items' (default: 'packages')
//   page: number (default: 1)
//   limit: number (default: 50)
//   search: string (optional, filters by trackingId or LPN)

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'ADMIN' && role !== 'SUPER_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range    = searchParams.get('range') || 'today';
    const fromStr  = searchParams.get('from');
    const toStr    = searchParams.get('to');
    const view     = (searchParams.get('view') || 'packages') as 'packages' | 'items';
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const search   = (searchParams.get('search') || '').trim().toLowerCase();

    // ── Build date window ──────────────────────────────────────────────────────
    const now = new Date();
    let from: Date;
    let to: Date = new Date(now);
    to.setHours(23, 59, 59, 999);

    if (range === 'custom' && fromStr && toStr) {
      from = new Date(fromStr);
      to   = new Date(toStr);
      to.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      from = new Date(now);
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (range === 'year') {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else {
      // today (default)
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    }

    const dateFilter = { gte: from, lte: to };

    // ── PACKAGES VIEW ──────────────────────────────────────────────────────────
    if (view === 'packages') {
      const where: any = {};

      // For "packages" we use createdAt or receivedAt within range.
      // We use OR so we capture newly created and recently received manifests.
      where.OR = [
        { createdAt: dateFilter },
        { receivedAt: dateFilter },
        { inspectedAt: dateFilter },
        { qcCheckedAt: dateFilter },
      ];

      if (search) {
        where.trackingId = { contains: search, mode: 'insensitive' };
      }

      const [manifests, total] = await Promise.all([
        prisma.manifest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            evidences: {
              select: {
                id: true,
                lpn: true,
                type: true,
                status: true,
                orderDriveLink: true,
                lpnDriveLink: true,
                claimReason: true,
                claimSubReason: true,
                uploadedByEmail: true,
                createdAt: true,
              },
            },
            alerts: {
              select: {
                id: true,
                level: true,
                type: true,
                title: true,
                resolved: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        prisma.manifest.count({ where }),
      ]);

      // Fetch user names for receiver / inspector
      const emailSet = new Set<string>();
      manifests.forEach(m => {
        if (m.receivedBy)  emailSet.add(m.receivedBy);
        if (m.inspectedBy) emailSet.add(m.inspectedBy);
      });
      const users = await prisma.user.findMany({
        where: { email: { in: Array.from(emailSet) } },
        select: { email: true, name: true },
      });
      const userNameMap: Record<string, string> = {};
      users.forEach(u => { userNameMap[u.email] = u.name || u.email; });

      const packageLogs = manifests.map(m => ({
        id:              m.id,
        trackingId:      m.trackingId,
        status:          m.status,
        marketplace:     m.marketplace,
        removalOrderId:  m.removalOrderId,
        createdAt:       m.createdAt,
        receivedAt:      m.receivedAt,
        receivedBy:      m.receivedBy ? (userNameMap[m.receivedBy] || m.receivedBy) : null,
        inspectedAt:     m.inspectedAt,
        inspectedBy:     m.inspectedBy ? (userNameMap[m.inspectedBy] || m.inspectedBy) : null,
        inspectorHandoverAt: m.inspectorHandoverAt,
        qcCheckedAt:     m.qcCheckedAt,
        claimId:         m.claimId,
        // Evidence & folder links
        evidences:       m.evidences,
        // Related alert count / status
        alerts:          m.alerts,
        alertCount:      m.alerts.length,
        unresolvedAlerts: m.alerts.filter(a => !a.resolved).length,
      }));

      // ── Stats for the selected range ──
      const stats = await prisma.manifest.groupBy({
        by: ['status'],
        where: {
          OR: [
            { createdAt: dateFilter },
            { receivedAt: dateFilter },
          ],
        },
        _count: { status: true },
      });

      const statusCounts: Record<string, number> = {};
      stats.forEach(s => { statusCounts[s.status] = s._count.status; });

      const totalReceived  = (statusCounts['AT_DOCK'] || 0)
                           + (statusCounts['IN_INSPECTION'] || 0)
                           + (statusCounts['INSPECTED'] || 0)
                           + (statusCounts['CLAIMS_STAGING'] || 0)
                           + (statusCounts['CLAIM_RESOLVED'] || 0)
                           + (statusCounts['RECOVERED_TO_INVENTORY'] || 0);

      const totalRejected = await prisma.evidence.count({
        where: {
          type: 'RECEIVER_REJECTION',
          createdAt: dateFilter,
        },
      });

      const totalInspected = (statusCounts['INSPECTED'] || 0)
                           + (statusCounts['CLAIMS_STAGING'] || 0)
                           + (statusCounts['CLAIM_RESOLVED'] || 0)
                           + (statusCounts['RECOVERED_TO_INVENTORY'] || 0);

      return NextResponse.json({
        view:   'packages',
        data:   packageLogs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalPackages:   total,
          totalReceived,
          totalRejected,
          totalInspected,
          statusBreakdown: statusCounts,
        },
      });
    }

    // ── ITEMS VIEW ─────────────────────────────────────────────────────────────
    if (view === 'items') {
      const itemWhere: any = { createdAt: dateFilter };
      if (search) {
        itemWhere.OR = [
          { lpn: { contains: search, mode: 'insensitive' } },
          { orderId: { contains: search, mode: 'insensitive' } },
          { manifestId: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [itemStatuses, totalItems] = await Promise.all([
        prisma.itemStatus.findMany({
          where: itemWhere,
          orderBy: { createdAt: 'desc' },
          skip:  (page - 1) * limit,
          take:  limit,
          include: {
            manifest: {
              select: {
                trackingId: true,
                status: true,
                inspectedBy: true,
              },
            },
          },
        }),
        prisma.itemStatus.count({ where: itemWhere }),
      ]);

      // Fetch missing items in same date range
      const missingWhere: any = { createdAt: dateFilter };
      if (search) {
        missingWhere.OR = [
          { orderId:    { contains: search, mode: 'insensitive' } },
          { trackingId: { contains: search, mode: 'insensitive' } },
        ];
      }

      const missingItems = await prisma.missingItem.findMany({
        where: missingWhere,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          manifest: {
            select: { trackingId: true, status: true },
          },
        },
      });

      // Get evidence for item LPNs (for drive links)
      const lpns = itemStatuses.map(i => i.lpn).filter(Boolean);
      const evidences = await prisma.evidence.findMany({
        where: { lpn: { in: lpns } },
        select: { lpn: true, type: true, lpnDriveLink: true, orderDriveLink: true, status: true },
      });
      const evidenceByLpn: Record<string, typeof evidences[0][]> = {};
      evidences.forEach(e => {
        if (!evidenceByLpn[e.lpn]) evidenceByLpn[e.lpn] = [];
        evidenceByLpn[e.lpn].push(e);
      });

      const itemLogs = itemStatuses.map(item => ({
        lpn:               item.lpn,
        tempId:            item.temp_id,
        status:            item.status,
        recoveryType:      item.recoveryType,
        orderId:           item.orderId,
        lpnDriveLink:      item.lpnDriveLink,
        orderDriveLink:    item.orderDriveLink,
        recoveryHandoverAt: item.recoveryHandoverAt,
        isRefurbished:     item.isRefurbished,
        createdAt:         item.createdAt,
        manifestId:        item.manifestId,
        manifestTrackingId: item.manifest?.trackingId || null,
        manifestStatus:    item.manifest?.status || null,
        inspectedBy:       item.manifest?.inspectedBy || null,
        evidences:         evidenceByLpn[item.lpn] || [],
      }));

      // ── Item stats ──
      const itemStats = await prisma.itemStatus.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter },
        _count: { status: true },
      });
      const itemStatusCounts: Record<string, number> = {};
      itemStats.forEach(s => { itemStatusCounts[s.status] = s._count.status; });

      return NextResponse.json({
        view:    'items',
        data:    itemLogs,
        missing: missingItems.map(m => ({
          id:              m.id,
          orderId:         m.orderId,
          fnsku:           m.fnsku,
          missingQuantity: m.missingQuantity,
          trackingId:      m.trackingId,
          orderDriveLink:  m.orderDriveLink,
          createdAt:       m.createdAt,
          manifestTrackingId: m.manifest?.trackingId || null,
        })),
        total:      totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
        stats: {
          totalItems:      totalItems,
          missingItems:    missingItems.length,
          statusBreakdown: itemStatusCounts,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid view param' }, { status: 400 });

  } catch (err: any) {
    console.error('[Logs API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
