import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    
    // Resolve one-to-one mapping using AMZRemovalShipment:
    // trackingId can be either trackingNumber (AWB) or orderId (removal order platform ID)
    const shipmentMatch = await prisma.aMZRemovalShipment.findFirst({
      where: {
        OR: [
          { trackingNumber: trackingId },
          { orderId: trackingId }
        ]
      }
    });

    const resolvedOrderId = shipmentMatch?.orderId || trackingId;
    const resolvedTrackingId = shipmentMatch?.trackingNumber || trackingId;

    // Try to find manifest by resolved tracking ID
    let manifest = await prisma.manifest.findFirst({
      where: {
        OR: [
          { trackingId: resolvedTrackingId },
          { trackingId: resolvedOrderId },
          { removalOrderId: resolvedOrderId }
        ]
      },
      include: {
        orders: true
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    // Query expected shipments using manifest orders and tracking numbers for robust lookup
    const orderIds = (manifest.orders || []).map(o => o.platformOrderId);
    const trackingNumbers = [
      trackingId,
      resolvedTrackingId,
      resolvedOrderId,
      ...(manifest.orders || []).map(o => o.trackingNumber)
    ].filter((t): t is string => !!t);

    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { trackingNumber: { in: trackingNumbers } }
        ]
      }
    });

    // Compute expected quantity per fnsku from shipments
    const expectedTotals: Record<string, number> = {};
    for (const s of shipments) {
      if (s.fnsku) {
        expectedTotals[s.fnsku] = (expectedTotals[s.fnsku] || 0) + (s.shippedQuantity || 0);
      }
    }

    // Fetch actual ReturnItem rows that match any expected fnsku
    const fnskuList = Object.keys(expectedTotals);
    const returnItems = await prisma.returnItem.findMany({
      where: { fnsku: { in: fnskuList } },
      select: { fnsku: true, lpn: true }
    });

    const actualTotals: Record<string, number> = {};
    for (const ri of returnItems) {
      if (ri.fnsku) {
        actualTotals[ri.fnsku] = (actualTotals[ri.fnsku] || 0) + 1;
      }
    }

    const fnskuCounts = Object.keys(expectedTotals).map(fnsku => {
      const expected = expectedTotals[fnsku];
      const actual = actualTotals[fnsku] || 0;
      return {
        fnsku,
        expected,
        actual,
        status: actual >= expected ? 'completed' : 'pending'
      };
    });



    // Build product‑level items list for UI (sku, fnsku, shipped qty, name)
    const items: Array<{ sku: string; fnsku: string | null; quantity: number; productName: string }> = [];
    let totalExpectedQuantity = 0;
    for (const s of shipments) {
      if (!s.sku) continue;
      const rawReturn = await prisma.aMZCustomerReturn.findFirst({
        where: { sku: s.sku }
      });
      items.push({
        sku: s.sku,
        fnsku: s.fnsku || null,
        quantity: s.shippedQuantity || 0,
        productName: rawReturn?.productName || 'Unknown Product'
      });
      totalExpectedQuantity += s.shippedQuantity || 0;
    }

    const flattenedReturnItems = returnItems.map(ri => ({
      ...ri,
      id: ri.lpn
    }));

    // Map orders to make sure they have up-to-date totalQuantity and totalAmount
    const rawOrder = await prisma.aMZRemovalOrder.findFirst({
      where: { orderId: resolvedOrderId }
    });

    const formattedOrders = (manifest.orders || []).map(order => ({
      ...order,
      totalQuantity: order.totalQuantity || totalExpectedQuantity,
      totalAmount: order.totalAmount || rawOrder?.removalFee || 0.0,
      trackingNumber: order.trackingNumber || resolvedTrackingId || null
    }));

    const formattedManifest = {
      ...manifest,
      orders: formattedOrders,
      totalExpectedQuantity: Math.max(totalExpectedQuantity, 1),
      expectedFnskus: items,
      fnskuCounts,
      matchedOrderId: resolvedOrderId,
      returnItems: flattenedReturnItems
    };

    return NextResponse.json({ manifest: formattedManifest });
  } catch (error) {
    console.error('Failed to fetch manifest:', error);
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
