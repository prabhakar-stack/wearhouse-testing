import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || !['RECEIVER', 'ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get('trackingId');

    if (!trackingId) {
      return NextResponse.json({ error: 'Missing trackingId' }, { status: 400 });
    }

    // 1. Check if Manifest exists
    const manifest = await prisma.manifest.findUnique({
      where: { trackingId },
      include: {
        orders: { select: { marketplace: true } }
      }
    });

    if (manifest) {
      const marketplace = manifest.orders?.[0]?.marketplace || 'AMAZON';
      return NextResponse.json({ success: true, marketplace });
    }

        // 2. Check if RemovalShipment exists
    const removalShipment = await prisma.removalShipment.findFirst({
      where: { trackingNumber: trackingId }
    });

    if (removalShipment) {
      return NextResponse.json({ success: true, marketplace: 'AMAZON' });
    }

    // 3. Check if Order exists
    const order = await prisma.order.findUnique({
      where: { platformOrderId: trackingId }
    });

    if (order) {
      return NextResponse.json({ success: true, marketplace: order.marketplace || 'AMAZON' });
    }

    // If not found in any of them, return error
    return NextResponse.json({
      error: 'This package/order is not expected today and does not exist in our shipment removal or order database.'
    }, { status: 404 });
  } catch (error: any) {
    console.error('Dock Verify Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
