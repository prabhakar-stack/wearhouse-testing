import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;

    // Resolve by trackingNumber in AMZRemovalShipment — the input can be either
    // a tracking number (AWB) or an orderId (removal order platform ID).
    // After the tracking-first migration, manifests are always keyed by trackingNumber.
    const shipmentMatch = await prisma.aMZRemovalShipment.findFirst({
      where: {
        OR: [
          { trackingNumber: trackingId },
          { orderId: trackingId }
        ]
      }
    });

    const resolvedTrackingId = shipmentMatch?.trackingNumber || trackingId;
    const resolvedOrderId = shipmentMatch?.orderId || null;

    // Look up Manifest strictly by trackingId — no removalOrderId fallback.
    // All manifests are now scoped to a single tracking number.
    const manifest = await prisma.manifest.findUnique({
      where: { trackingId: resolvedTrackingId }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    // Fetch shipments scoped to this tracking number only.
    // This is the core shipment-centric query: we only care about SKUs in this specific box.
    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: { trackingNumber: manifest.trackingId }
    });

    // Compute expected quantity per fnsku from this tracking's shipment rows
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

    // Build product-level items list for UI (sku, fnsku, shipped qty, name)
    const uniqueSkus = Array.from(new Set(shipments.map(s => s.sku).filter((s): s is string => !!s)));
    const customerReturnRows = await prisma.aMZCustomerReturn.findMany({
      where: { sku: { in: uniqueSkus } },
      select: { sku: true, productName: true }
    });
    const customerReturnBySkuMap = new Map(customerReturnRows.map(r => [r.sku, r]));

    const items: Array<{ sku: string; fnsku: string | null; quantity: number; productName: string }> = [];
    let totalExpectedQuantity = 0;
    for (const s of shipments) {
      if (!s.sku) continue;
      const rawReturn = customerReturnBySkuMap.get(s.sku ?? '');
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

    // Fetch order metadata from operational Order table for display context.
    // orderId comes from manifest.removalOrderId (metadata reference, not FK).
    const effectiveOrderId = resolvedOrderId || manifest.removalOrderId;
    const rawOrder = effectiveOrderId
      ? await prisma.aMZRemovalOrder.findFirst({ where: { orderId: effectiveOrderId } })
      : null;

    // Fetch the operational Order record for this removal order
    const operationalOrder = effectiveOrderId
      ? await prisma.order.findUnique({ where: { platformOrderId: effectiveOrderId } })
      : null;

    // Build a synthetic order summary for the response (replaces the old manifest.orders array)
    const orderSummary = operationalOrder
      ? {
          ...operationalOrder,
          totalQuantity: operationalOrder.totalQuantity || totalExpectedQuantity,
          totalAmount: operationalOrder.totalAmount || rawOrder?.removalFee || 0.0,
          trackingNumber: manifest.trackingId, // tracking is the manifest's own trackingId
        }
      : null;

    const formattedManifest = {
      ...manifest,
      orders: orderSummary ? [orderSummary] : [],
      totalExpectedQuantity: Math.max(totalExpectedQuantity, 1),
      expectedFnskus: items,
      fnskuCounts,
      matchedOrderId: effectiveOrderId,
      returnItems: flattenedReturnItems,
    };

    return NextResponse.json({ manifest: formattedManifest });
  } catch (error) {
    console.error('Failed to fetch manifest:', error);
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
