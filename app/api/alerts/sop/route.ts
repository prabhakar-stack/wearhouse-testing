import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Manage SOP steps for alert types
// GET: fetch all SOP steps (optionally filtered by ?type=SLA_BREACH)
// POST: create/update SOP steps for an alert type (upsert by alertType + stepOrder)
// DELETE: remove a SOP step by id

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const alertType = searchParams.get('type');

    const where = alertType ? { alertType } : {};
    const steps = await prisma.alertSopStep.findMany({
      where,
      orderBy: [{ alertType: 'asc' }, { stepOrder: 'asc' }]
    });

    return NextResponse.json({ steps });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { alertType, steps } = body;
    // steps: [{ stepOrder: 1, instruction: "..." }, ...]

    if (!alertType || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: 'Missing alertType or steps array' }, { status: 400 });
    }

    // Delete existing steps for this type, then create new ones (replace strategy)
    await prisma.$transaction(async (tx) => {
      await tx.alertSopStep.deleteMany({ where: { alertType } });
      for (const step of steps) {
        await tx.alertSopStep.create({
          data: {
            alertType,
            stepOrder: step.stepOrder,
            instruction: step.instruction,
          }
        });
      }
    });

    const updated = await prisma.alertSopStep.findMany({
      where: { alertType },
      orderBy: { stepOrder: 'asc' }
    });

    return NextResponse.json({ success: true, steps: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.alertSopStep.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
