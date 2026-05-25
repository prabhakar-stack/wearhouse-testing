import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Aggregates all data needed for filing a claim for a given manifest
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manifestId = searchParams.get('manifestId');
    const trackingId = searchParams.get('trackingId') || searchParams.get('awb'); // Support both trackingId and legacy awb param

    if (!manifestId && !trackingId) {
      return NextResponse.json({ error: 'Provide manifestId or trackingId query param' }, { status: 400 });
    }

    const manifest = await prisma.manifest.findFirst({
      where: manifestId
        ? { id: manifestId }
        : { trackingId: trackingId! },
      include: {
        orders: true,
        evidences: {
          select: {
            id: true,
            lpn: true,

            orderDriveLink: true,
            lpnDriveLink: true,
            type: true,
            claimReason: true,
            claimSubReason: true,
            createdAt: true
          }
        }
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    // Since ReturnItem is decoupled from Order, let's find the relevant return items.
    // We can fetch ReturnItem rows matching orderId = order.platformOrderId for backwards compatibility,
    // or by matching the SKUs/FNSKUs expected in these Orders from AMZRemovalShipment.
    // Let's get the tracking numbers / order IDs first.
    const orderIds = (manifest.orders || []).map(o => o.platformOrderId);
    const trackingNumbers = (manifest.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t);

    // Fetch the raw removal shipments to know which SKUs/FNSKUs were expected in this manifest/order
    const removalShipments = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          { trackingNumber: { in: trackingNumbers } }
        ]
      }
    });

    const expectedSkus = Array.from(new Set(removalShipments.map(s => s.sku).filter((s): s is string => !!s)));
    const expectedFnskus = Array.from(new Set(removalShipments.map(s => s.fnsku).filter((f): f is string => !!f)));

        // Fetch return data directly from AMZ_customer_returns
const returnItems = await prisma.returnItem.findMany({
  where: {
    OR: [
      { sku: { in: expectedSkus } },
      { fnsku: { in: expectedFnskus } },
    ],
  },
});

// Pull associated evidences by LPN (foreign key)
const evidences = await prisma.evidence.findMany({
  where: { lpn: { in: returnItems.map((ri) => ri.lpn) } },
});
const evidenceMap = Object.fromEntries(
  evidences.map((ev) => [ev.lpn, ev])
);

    // Map AMZ_customer_returns rows to expected structure (no order mapping needed)
    const flattenedReturnItems = returnItems.map(ri => ({
      ...ri,
      id: ri.lpn
    }));

    const manifestWithFlattenedItems = {
      ...manifest,
      returnItems: flattenedReturnItems,
    };

    // Build a structured claim data payload
    const claimData = {
      manifest: {
        id: manifest.id,
        trackingId: manifest.trackingId,
        status: manifest.status,
        courierName: manifest.courierName,
        expectedDate: manifest.expectedDate,
        receivedAt: manifest.receivedAt,
        receivedBy: manifest.receivedBy,
        inspectedBy: manifest.inspectedBy,
      },
      returnItems: flattenedReturnItems.map(ri => ({
        id: ri.id,
        lpn: ri.lpn,
        sku: ri.sku,
        quantity: 1, // Quantity is always 1 per LPN row
        condition: ri.detailedDisposition,
        returnReason: ri.reason,
        customerComments: ri.customerComments,
        marketplace: ri.marketplace,
        evidences: evidenceMap[ri.lpn] ? [evidenceMap[ri.lpn]] : [],
        claimReason: evidenceMap[ri.lpn]?.claimReason || null,
        claimSubReason: evidenceMap[ri.lpn]?.claimSubReason || null,
      })),
      orderEvidences: manifest.evidences,
      // Pre-built text for clipboard copy
      claimSummary: buildClaimSummary(manifestWithFlattenedItems),
    };

    return NextResponse.json({ claimData });
  } catch (error: any) {
    console.error('Claims Details Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function buildClaimSummary(manifest: any): string {
  const lines: string[] = [];
  lines.push(`=== CLAIM DATA ===`);
  lines.push(`Tracking ID: ${manifest.trackingId}`);
  lines.push(`Status: ${manifest.status}`);
  lines.push(`Courier: ${manifest.courierName || 'Unknown'}`);
  lines.push(`Received By: ${manifest.receivedBy || 'N/A'}`);
  lines.push(`Received At: ${manifest.receivedAt ? new Date(manifest.receivedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : 'N/A'}`);
  lines.push(`Inspected By: ${manifest.inspectedBy || 'N/A'}`);
  lines.push('');

  if (manifest.returnItems?.length > 0) {
    lines.push(`--- RETURN ITEMS (${manifest.returnItems.length}) ---`);
    for (const ri of manifest.returnItems) {
      lines.push(`  LPN: ${ri.lpn || 'N/A'} | SKU: ${ri.sku} | Condition: ${ri.condition || 'N/A'} | Reason: ${ri.returnReason}`);
      if (ri.claimReason) {
        lines.push(`    - Claim Reasons: ${ri.claimReason} > ${ri.claimSubReason || 'None'}`);
      }
      const lpnEv = ri.evidences?.[0];
      if (lpnEv) {
        if (lpnEv.lpnDriveLink) lines.push(`    - LPN Drive Folder: ${lpnEv.lpnDriveLink}`);
        if (lpnEv.orderDriveLink) lines.push(`    - Order Drive Folder: ${lpnEv.orderDriveLink}`);
      }
    }
    lines.push('');
  }

  const otherEvs = manifest.evidences?.filter((ev: any) => !ev.returnItemId) || [];
  if (otherEvs.length > 0) {
    lines.push(`--- OTHER EVIDENCE LINKS ---`);
    for (const ev of otherEvs) {
      lines.push(`  [${ev.type}] ${ev.orderDriveLink || ev.lpnDriveLink || 'N/A'}`);
    }
  }

  return lines.join('\n');
}
