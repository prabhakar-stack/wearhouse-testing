import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const evidenceList = await prisma.evidence.findMany({
      include: {
        manifest: {
          select: {
            trackingId: true,
            marketplace: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Enrich each evidence record with ReturnItem data (joined by LPN).
    // The Evidence model has no direct Prisma relation to ReturnItem, so we do
    // a manual batch lookup and attach the result on the JS side.
    const lpns = evidenceList
      .map((e) => e.lpn)
      .filter((lpn) => !lpn.startsWith('missing_') && !lpn.startsWith('video_'));

    const returnItems = await prisma.returnItem.findMany({
      where: { lpn: { in: lpns } },
      select: { lpn: true, sku: true, fnsku: true, asin: true, productName: true },
    });

    const returnItemMap: Record<string, typeof returnItems[number]> = {};
    for (const item of returnItems) {
      returnItemMap[item.lpn] = item;
    }

    const evidence = evidenceList.map((e) => ({
      ...e,
      returnItem: returnItemMap[e.lpn] ?? null,
    }));

    return NextResponse.json({ evidence });
  } catch (error: any) {
    console.error('Error fetching admin evidence logs:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
