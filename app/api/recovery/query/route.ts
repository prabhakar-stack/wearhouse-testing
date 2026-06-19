import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toUpperCase() ?? '';

    if (!search) {
      return NextResponse.json({ error: 'Missing search parameter' }, { status: 400 });
    }

    // Match by LPN (primary key) or by orderId as a secondary lookup
    const item = await prisma.itemStatus.findFirst({
      where: {
        OR: [
          { lpn: search },
          { orderId: search },
        ],
      },
      include: { manifest: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Derive damageType from recoveryType field
    const recoveryType = (item.recoveryType ?? '').toLowerCase();
    const damageType =
      recoveryType === 'box_damage' || recoveryType === 'packaging_damaged'
        ? 'Packaging Damaged'
        : 'Barcode Damaged';

    return NextResponse.json({
      lpn: item.lpn,
      sku: item.orderId ?? '',
      status: item.status,
      damageType,
      isRefurbished: item.isRefurbished,
      temp_id: item.temp_id ?? null,
    });
  } catch (error: unknown) {
    console.error('[recovery/query]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
