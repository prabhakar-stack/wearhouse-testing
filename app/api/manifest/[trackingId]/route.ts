import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    let matchedOrderId: string | null = null;
    
    // 1. Try to find by tracking ID
    let manifest = await prisma.manifest.findUnique({
      where: { trackingId: trackingId },
      include: {
        orders: {
          include: {
            returnItems: true
          }
        }
      }
    });

    // 2. If not found, try to search by platformOrderId
    if (!manifest) {
      manifest = await prisma.manifest.findFirst({
        where: {
          orders: {
            some: {
              platformOrderId: trackingId
            }
          }
        },
        include: {
          orders: {
            include: {
              returnItems: true
            }
          }
        }
      });
      matchedOrderId = manifest ? trackingId : null;
    }

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    const removalOrderId = manifest.removalOrderId || matchedOrderId || manifest.orders?.[0]?.platformOrderId;

    // Find all removal shipments for this removalOrderId or trackingId
    const shipments = await prisma.removalShipment.findMany({
      where: {
        OR: [
          { manifestId: manifest.id },
          ...(removalOrderId ? [{ removalOrderId }] : []),
          { trackingNumber: manifest.trackingId }
        ]
      }
    });

    const expectedSkuQuantities = new Map<string, number>();
    for (const s of shipments) {
      if (s.sku && s.shippedQuantity) {
        expectedSkuQuantities.set(s.sku, (expectedSkuQuantities.get(s.sku) || 0) + s.shippedQuantity);
      }
    }

    const expectedFnskusList: { fnsku: string; sku: string; quantity: number; productName: string }[] = [];
    let totalExpectedQuantity = 0;

    for (const [sku, qty] of expectedSkuQuantities.entries()) {
      const rawReturn = await prisma.aMZCustomerReturn.findFirst({
        where: { sku },
        select: { fnsku: true, productName: true }
      });

      let fnsku = rawReturn?.fnsku;
      let productName = rawReturn?.productName;

      if (!fnsku) {
        const rawOrder = await prisma.aMZRemovalOrder.findFirst({
          where: { sku },
          select: { fnsku: true }
        });
        fnsku = rawOrder?.fnsku || sku;
      }

      if (!productName) {
        productName = `SKU: ${sku}`;
      }

      expectedFnskusList.push({
        fnsku,
        sku,
        quantity: qty,
        productName
      });
      totalExpectedQuantity += qty;
    }

    const flattenedReturnItems = (manifest.orders || []).flatMap(order =>
      (order.returnItems || []).map(ri => ({
        ...ri,
        id: ri.lpn
      }))
    );

    if (totalExpectedQuantity === 0) {
      totalExpectedQuantity = flattenedReturnItems.length;
    }

    const formattedManifest = {
      ...manifest,
      totalExpectedQuantity: Math.max(totalExpectedQuantity, 1),
      expectedFnskus: expectedFnskusList,
      matchedOrderId:
        matchedOrderId ||
        manifest.orders.find(order => order.platformOrderId === trackingId)?.platformOrderId ||
        (manifest.orders.length === 1 ? manifest.orders[0].platformOrderId : null),
      returnItems: flattenedReturnItems
    };

    return NextResponse.json({ manifest: formattedManifest });
  } catch (error) {
    console.error('Failed to fetch manifest:', error);
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
