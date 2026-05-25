// app/api/sync/amazon-returns/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runSync } from '@/scripts/syncAmzReturns';

export async function POST(req: NextRequest) {
  // Simple auth – require admin role header (adjust as needed)
  const role = req.headers.get('x-user-role');
  if (!role || !['ADMIN', 'SUPER_ACCESS'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await runSync();
    return NextResponse.json({ success: true, message: 'AMZ_customer_returns sync completed' });
  } catch (error: any) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
