import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TTL_MS = 2 * 60 * 1000; // 2-minute command TTL

// POST /api/admin/upload-retry-command
// Body: { inspectorId, manifestId?, note? }
// Role: SUPER_ACCESS only
export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const issuedById = req.headers.get('x-user-id');

  if (role !== 'SUPER_ACCESS') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!issuedById) {
    return NextResponse.json({ error: 'Missing x-user-id header' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { inspectorId, manifestId, note } = body;

  if (!inspectorId || typeof inspectorId !== 'string') {
    return NextResponse.json({ error: 'inspectorId is required' }, { status: 400 });
  }

  // Verify the target is actually an inspector
  const inspector = await prisma.user.findUnique({
    where: { id: inspectorId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!inspector || inspector.role !== 'INSPECTOR') {
    return NextResponse.json({ error: 'Target user is not an INSPECTOR' }, { status: 404 });
  }

  // Expire any stale PENDING commands for this inspector before creating a new one
  await prisma.uploadRetryCommand.updateMany({
    where: { inspectorId, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });

  const command = await prisma.uploadRetryCommand.create({
    data: {
      inspectorId,
      issuedById,
      manifestId: manifestId || null,
      note: note || null,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  return NextResponse.json({ ok: true, commandId: command.id });
}

// GET /api/admin/upload-retry-command?inspectorId=xxx
// Returns the latest command status for a given inspector (for the super-access UI to poll)
export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  if (role !== 'SUPER_ACCESS') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inspectorId = req.nextUrl.searchParams.get('inspectorId');
  if (!inspectorId) {
    return NextResponse.json({ error: 'inspectorId query param required' }, { status: 400 });
  }

  const command = await prisma.uploadRetryCommand.findFirst({
    where: { inspectorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, note: true, createdAt: true, expiresAt: true, manifestId: true,
    },
  });

  return NextResponse.json({ command: command || null });
}

// PATCH /api/admin/upload-retry-command
// Body: { commandId, status: 'DONE' | 'ACKNOWLEDGED' }
// Called by inspector browser after acting on the command
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { commandId, status } = body;

  if (!commandId || !['ACKNOWLEDGED', 'DONE'].includes(status)) {
    return NextResponse.json({ error: 'commandId and valid status required' }, { status: 400 });
  }

  await prisma.uploadRetryCommand.update({
    where: { id: commandId },
    data: { status },
  });

  return NextResponse.json({ ok: true });
}
