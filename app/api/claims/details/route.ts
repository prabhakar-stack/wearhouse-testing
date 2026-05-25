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
        orders: {
          include: {
            returnItems: {
              include: {
                evidences: {
                  select: {
                    id: true,
                    lpn: true,
                    orderId: true,
                    orderDriveLink: true,
                    lpnDriveLink: true,
                    type: true,
                    claimReason: true,
                    claimSubReason: true,
                    createdAt: true
                  }
                }
              }
            }
          }
        },
        evidences: {
          select: {
            id: true,
            lpn: true,
            orderId: true,
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

    const flattenedReturnItems = (manifest.orders || []).flatMap(order =>
      (order.returnItems || []).map(ri => ({
        ...ri,
        id: ri.lpn,
        order: {
          marketplace: order.marketplace,
          platformOrderId: order.platformOrderId,
          customerOrderId: order.customerOrderId,
        }
      }))
    );

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
        condition: ri.condition,
        returnReason: ri.returnReason,
        customerComments: ri.customerComments,
        marketplace: ri.order?.marketplace,
        platformOrderId: ri.order?.platformOrderId,
        customerOrderId: ri.order?.customerOrderId,
        evidences: ri.evidences,
        claimReason: ri.claimReason,
        claimSubReason: ri.claimSubReason,
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
