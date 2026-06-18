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

    // 1. Check if Manifest exists (Case-Insensitive)
    const manifest = await prisma.manifest.findFirst({
      where: {
        trackingId: {
          equals: trackingId,
          mode: 'insensitive'
        }
      },
    });

    if (manifest) {
      if (manifest.status !== 'EXPECTED' && manifest.status !== 'IN_TRANSIT') {
        if (manifest.status === 'AT_DOCK') {
          return NextResponse.json({
            error: 'This package has already been received at the dock and is visible in the Handover Ledger.'
          }, { status: 400 });
        }
        return NextResponse.json({
          error: `This package cannot be received. It is already in stage "${manifest.status}".`
        }, { status: 400 });
      }
      const marketplace = manifest.marketplace || 'AMAZON';
      const otpRequired = marketplace === 'AMAZON_FBA';
      return NextResponse.json({ success: true, marketplace, otpRequired });
    }

    // 2. Check if AMZRemovalShipment exists (Case-Insensitive)
    const removalShipment = await prisma.aMZRemovalShipment.findFirst({
      where: {
        OR: [
          { trackingNumber: { equals: trackingId, mode: 'insensitive' } },
          { orderId: { equals: trackingId, mode: 'insensitive' } }
        ]
      }
    });

    if (removalShipment) {
      return NextResponse.json({ success: true, marketplace: 'AMAZON', otpRequired: false });
    }

    // 3. Check if Order exists (Case-Insensitive)
    const order = await prisma.order.findFirst({
      where: {
        platformOrderId: {
          equals: trackingId,
          mode: 'insensitive'
        }
      }
    });

    if (order) {
      return NextResponse.json({ success: true, marketplace: order.marketplace || 'AMAZON', otpRequired: false });
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
