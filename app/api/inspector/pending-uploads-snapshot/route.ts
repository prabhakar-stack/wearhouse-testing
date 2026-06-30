import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/inspector/pending-uploads-snapshot
// Called by the inspector's PendingUploadsIndicator every 30s (when uploads exist).
// Body: { uploads: GroupedUploadMeta[] }
// Upserts a single PendingUploadSnapshot row for this inspector.
// When uploads is empty array, deletes the snapshot (nothing pending).
export async function POST(req: NextRequest) {
  const inspectorId = req.headers.get('x-user-id');
  if (!inspectorId) {
    return NextResponse.json({ error: 'Missing x-user-id' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { uploads } = body;

  if (!Array.isArray(uploads)) {
    return NextResponse.json({ error: 'uploads must be an array' }, { status: 400 });
  }

  // If nothing pending, remove snapshot entirely so super-admin sees clean state
  if (uploads.length === 0) {
    await prisma.pendingUploadSnapshot.deleteMany({ where: { inspectorId } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  await prisma.pendingUploadSnapshot.upsert({
    where: { inspectorId },
    update: { uploads },
    create: { inspectorId, uploads },
  });

  return NextResponse.json({ ok: true });
}
