import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Alert level access policy:
//   ADMIN       → L1 (in-app), L2 (email/push), L3 (banner) — operational issues
//   SUPER_ACCESS → all levels including L4 (critical: phone + WhatsApp to leadership)
const ADMIN_VISIBLE_LEVELS = ['L1', 'L2', 'L3', 'L4'];
const ALL_LEVELS            = ['L1', 'L2', 'L3', 'L4'];

const DEFAULT_SOP_STEPS: Record<string, string[]> = {
  SLA_BREACH: [
    "Verify if the package was physically placed in the dock area.",
    "Contact the receiver of the manifest to confirm package custody.",
    "Force handover the package status to 'IN_INSPECTION' manually if found.",
    "Escalate to operations head if package is missing."
  ],
  CLAIM_STALLED: [
    "Open the Google Drive folder for the order and inspect evidence images.",
    "Locate the corresponding Amazon LPN return reason and customer comments.",
    "Access the Amazon seller central claims portal (IDR) and file the dispute case.",
    "Update the Manifest claimId with the filed Amazon case ID.",
    "Log dispute status as 'Filed' under reimbursement tracker."
  ],
  CLAIM_NUDGE: [
    "Verify that the Google Drive evidence is complete and clear.",
    "Confirm that return item pricing is correct.",
    "Inform the assigned claims specialist to begin filing the claim."
  ],
  GHOST_DELIVERY: [
    "Check tracking status on the courier's public website (UPS/Delhivery/etc.).",
    "Search the receiving dock area physically for any unscanned boxes.",
    "Contact courier support to open an inquiry about missing delivery.",
    "If confirmed lost, file FBA warehouse lost inbound claim."
  ],
  MISSING_ITEMS: [
    "Re-verify the expected item list from AMZRemovalShipments and customer return records.",
    "Search the surrounding inspection table for any misplaced product items.",
    "Review inspection unboxing video to confirm if the box arrived short-shipped.",
    "File a claim on Amazon FBA for short-shipped/missing items, attaching the video link as evidence."
  ],
  INTAKE_REJECTION: [
    "Ensure that the unboxing visual damage photos are clearly uploaded to the Google Drive folder.",
    "Contact the courier driver to report damaged package intake rejection.",
    "File a freight damage or return shipment damage claim with the carrier."
  ]
};

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

    // Construct SOP steps dynamically from hardcoded map
    const alertTypes = [...new Set(alerts.map(a => a.type))];
    const sopMap: Record<string, { id: string; stepOrder: number; instruction: string }[]> = {};
    for (const type of alertTypes) {
      const steps = DEFAULT_SOP_STEPS[type] || [
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

    // ADMIN can resolve L4 alerts as well now.

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
