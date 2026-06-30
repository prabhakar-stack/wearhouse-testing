import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/inspector/pending-retry-command
// Called every 5s by the inspector's PendingUploadsIndicator.
// Returns the oldest PENDING, non-expired command for this inspector.
// If found, immediately marks it ACKNOWLEDGED so it is not returned again.
export async function GET(req: NextRequest) {
  const inspectorId = req.headers.get('x-user-id');
  if (!inspectorId) {
    return NextResponse.json({ command: null });
  }

  const now = new Date();

  // First, expire any timed-out commands silently
  await prisma.uploadRetryCommand.updateMany({
    where: { inspectorId, status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  // Pick the oldest live PENDING command
  const command = await prisma.uploadRetryCommand.findFirst({
    where: { inspectorId, status: 'PENDING', expiresAt: { gte: now } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, note: true, manifestId: true, createdAt: true },
  });

  if (!command) {
    return NextResponse.json({ command: null });
  }

  // Immediately acknowledge so it won't be returned on the next poll
  await prisma.uploadRetryCommand.update({
    where: { id: command.id },
    data: { status: 'ACKNOWLEDGED' },
  });

  return NextResponse.json({ command });
}
