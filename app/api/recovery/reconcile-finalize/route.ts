import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scannedLpns: string[] = Array.isArray(body?.scannedLpns)
      ? body.scannedLpns.map((l: unknown) => String(l).trim().toUpperCase())
      : [];

    // Flip unscanned inspected items to 'missing at recovery'
    await prisma.itemStatus.updateMany({
      where: {
        status: 'inspected',
        lpn: { notIn: scannedLpns },
      },
      data: { status: 'missing at recovery' },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[recovery/reconcile-finalize]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
