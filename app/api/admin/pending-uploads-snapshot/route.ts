import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/pending-uploads-snapshot?inspectorId=xxx
// Role: SUPER_ACCESS only
// Returns the latest PendingUploadSnapshot for the given inspector so the
// RemoteRetryPanel can display what files are pending/failed on their device.
export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  if (role !== 'SUPER_ACCESS') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inspectorId = req.nextUrl.searchParams.get('inspectorId');
  if (!inspectorId) {
    return NextResponse.json({ error: 'inspectorId query param required' }, { status: 400 });
  }

  const snapshot = await prisma.pendingUploadSnapshot.findUnique({
    where: { inspectorId },
    select: { uploads: true, updatedAt: true },
  });

  return NextResponse.json({ snapshot: snapshot || null });
}
