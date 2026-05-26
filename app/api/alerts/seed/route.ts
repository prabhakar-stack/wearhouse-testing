/**
 * /api/alerts/seed
 * Creates test alerts covering L1–L4 for system testing.
 * Protected by CRON_SECRET.
 * DELETE removes all test alerts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TEST_ALERTS = [
  {
    level: 'L1' as const,
    type: 'INSPECTION_PENDING_6H',
    title: '[TEST] Inspection Pending — 6 Hours',
    description: 'TEST: Package TRK-TEST-001 handed to inspector 6+ hours ago. Inspection still pending. Visible to: Inspector, Admin, Super-Access.',
  },
  {
    level: 'L2' as const,
    type: 'DELIVERY_ETA_BREACH_48H',
    title: '[TEST] Delivery ETA Breach — 48 Hours',
    description: 'TEST: Package TRK-TEST-002 is 48 hours past expected delivery. Visible to: Admin, Super-Access.',
  },
  {
    level: 'L3' as const,
    type: 'INSPECTION_QC_FAILED_12H',
    title: '[TEST] Inspection QC Failed — 12h No Claim',
    description: 'TEST: Package TRK-TEST-003 failed inspection QC 12 hours ago. No claim filed. Visible to: Admin, Super-Access.',
  },
  {
    level: 'L4' as const,
    type: 'INVENTORISATION_PENDING_48H',
    title: '[TEST] Inventorisation Pending — CRITICAL 48h',
    description: 'TEST: Package TRK-TEST-004 at QC for 48+ hours without inventorisation. Leadership escalated. Visible to: Super-Access, Admin.',
  },
  {
    level: 'L1' as const,
    type: 'RECEIVE_UPDATE_PENDING_2H',
    title: '[TEST] Receive Update Pending — 2 Hours',
    description: 'TEST: Package TRK-TEST-005 QC passed by receiver but acceptance not confirmed. Visible to: Receiver, Admin.',
  },
  {
    level: 'L2' as const,
    type: 'RECV_INSP_HANDSHAKE_12PM',
    title: '[TEST] Receiver→Inspector Handshake Breach — 12 PM',
    description: 'TEST: Previous-day shipments not handed to inspector by 12 PM. Visible to: Receiver, Admin.',
  },
];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const created = [];
    for (const alert of TEST_ALERTS) {
      // Skip if a test alert of this type already exists
      const existing = await prisma.alert.findFirst({
        where: { type: alert.type, title: { startsWith: '[TEST]' }, resolved: false }
      });
      if (existing) { created.push({ skipped: true, type: alert.type }); continue; }

      const record = await prisma.alert.create({ data: alert });
      created.push(record);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${created.filter((c: any) => !c.skipped).length} test alerts (${created.filter((c: any) => c.skipped).length} skipped as already exist).`,
      alerts: created,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await prisma.alert.deleteMany({
      where: { title: { startsWith: '[TEST]' } }
    });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
