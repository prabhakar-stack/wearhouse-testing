import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Alert level access policy:
//   ADMIN       → L1 (in-app), L2 (email/push), L3 (banner) — operational issues
//   SUPER_ACCESS → all levels including L4 (critical: phone + WhatsApp to leadership)
const ADMIN_VISIBLE_LEVELS = ['L1', 'L2', 'L3'];
const ALL_LEVELS            = ['L1', 'L2', 'L3', 'L4'];

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const showResolved = searchParams.get('resolved') === 'true';

    // Determine which levels this role can see
    const visibleLevels = role === 'SUPER_ACCESS' ? ALL_LEVELS : ADMIN_VISIBLE_LEVELS;

    const alerts = await prisma.alert.findMany({
      where: {
        resolved: showResolved,
        level: { in: visibleLevels as any },
      },
      include: {
        manifest: {
          select: { trackingId: true, status: true }
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

    // Fetch SOP steps for all unique alert types in the result set
    const alertTypes = [...new Set(alerts.map(a => a.type))];
    const sopSteps = await prisma.alertSopStep.findMany({
      where: { alertType: { in: alertTypes } },
      orderBy: { stepOrder: 'asc' }
    });

    // Group SOP steps by alertType
    const sopMap: Record<string, { id: string; stepOrder: number; instruction: string }[]> = {};
    for (const step of sopSteps) {
      if (!sopMap[step.alertType]) sopMap[step.alertType] = [];
      sopMap[step.alertType].push({ id: step.id, stepOrder: step.stepOrder, instruction: step.instruction });
    }

    // Count by level (only visible levels)
    const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, total: 0 };
    if (!showResolved) {
      const countResult = await prisma.alert.groupBy({
        by: ['level'],
        where: {
          resolved: false,
          level: { in: visibleLevels as any },
        },
        _count: true,
      });
      for (const row of countResult) {
        counts[row.level] = row._count;
        counts.total += row._count;
      }
    }

    return NextResponse.json({ alerts, sopMap, counts, role });
  } catch (error: any) {
    console.error('Alerts GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');
    if (!role || !['ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { alertId, resolution } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 });
    }

    // ADMIN cannot resolve L4 alerts — only SUPER_ACCESS can
    if (role === 'ADMIN') {
      const existing = await prisma.alert.findUnique({ where: { id: alertId }, select: { level: true } });
      if (existing?.level === 'L4') {
        return NextResponse.json(
          { error: 'L4 Critical alerts can only be resolved by Super Access.' },
          { status: 403 }
        );
      }
    }

    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedById: userId || undefined,
        resolvedAt: new Date(),
        resolution: resolution || 'Marked resolved by admin',
      }
    });

    return NextResponse.json({ success: true, alert });
  } catch (error: any) {
    console.error('Alerts PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
