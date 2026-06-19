import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scannedLpns: string[] = Array.isArray(body?.scannedLpns)
      ? body.scannedLpns.map((l: unknown) => String(l).trim().toUpperCase())
      : [];

    // Count items in the inspected/missing-at-recovery pool not yet scanned
    const unscannedCount = await prisma.itemStatus.count({
      where: {
        status: { in: ['inspected', 'missing at recovery'] },
        lpn: { notIn: scannedLpns },
      },
    });

    return NextResponse.json({ unscannedCount });
  } catch (error: unknown) {
    console.error('[recovery/reconcile-check]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
