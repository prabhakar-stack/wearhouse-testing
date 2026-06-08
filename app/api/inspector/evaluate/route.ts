import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_CONDITIONS = new Set([
  'GOOD_SELLABLE',
  'PACKAGING_DAMAGED',
  'PRODUCT_DAMAGED',
  'WRONG_ITEM',
  'MISSING',
  'BAD_FAKE_PRODUCT',
]);

function normalizeLpn(value: string) {
  return value.trim().toUpperCase();
}

/** Parse lpnCondition string. Returns resolved ItemCondition + extracted claim labels. */
function parseCondition(rawCondition: unknown): {
  resolvedCondition: string;
  claimReason: string | null;
  claimSubReason: string | null;
} {
  const conditionStr = typeof rawCondition === 'string' ? rawCondition.trim() : '';

  // New encoding: bad:REASON::SUBREASON
  if (conditionStr.startsWith('bad:')) {
    const payload = conditionStr.substring(4);
    if (payload.includes('::')) {
      const parts = payload.split('::');
      return {
        resolvedCondition: 'PRODUCT_DAMAGED',
        claimReason: parts[0] || null,
        claimSubReason: parts[1] || null,
      };
    }
    return { resolvedCondition: 'PRODUCT_DAMAGED', claimReason: payload || null, claimSubReason: null };
  }

  // Legacy plain condition strings
  const lower = conditionStr.toLowerCase();
  if (lower === 'good' || lower === 'good_sellable') {
    return { resolvedCondition: 'GOOD_SELLABLE', claimReason: null, claimSubReason: null };
  }
  if (lower === 'recovery' || lower === 'packaging_damaged') {
    return { resolvedCondition: 'PACKAGING_DAMAGED', claimReason: null, claimSubReason: null };
  }
  if (ALLOWED_CONDITIONS.has(conditionStr)) {
    return { resolvedCondition: conditionStr, claimReason: null, claimSubReason: null };
  }
  return { resolvedCondition: 'PRODUCT_DAMAGED', claimReason: null, claimSubReason: null };
}



export async function POST(req: Request) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!role || !['INSPECTOR', 'ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      manifestId,
      orderPlatformId,
      itemsScanned,
      itemsExpected,
      evidenceUrl,
      orderDriveLink, // order-level Google Drive folder URL (same as evidenceUrl, kept explicit)
      lpnConditions, // Record of scanned items: { [lpn]: 'good' | 'bad' | 'recovery' }
      lpnRecoveryTypes, // Record of recovery types: { [lpn]: string }
      lpnFolderLinks, // Record of LPN folder links: { [lpn]: string }
    } = body;

    // Build a case-insensitive lookup for lpnFolderLinks
    const lpnFolderLinksNormalized: Record<string, string> = {};
    if (lpnFolderLinks && typeof lpnFolderLinks === 'object') {
      for (const [k, v] of Object.entries(lpnFolderLinks as Record<string, string>)) {
        lpnFolderLinksNormalized[k.trim().toUpperCase()] = v;
      }
    }

    // Use orderDriveLink if present, fall back to evidenceUrl
    const resolvedOrderDriveLink = orderDriveLink || evidenceUrl || null;

    if (!manifestId) {
      return NextResponse.json({ error: 'Missing manifestId' }, { status: 400 });
    }

    const manifest = await prisma.manifest.findUnique({
      where: { id: manifestId },
      include: {
        orders: true
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    if (manifest.status !== 'IN_INSPECTION') {
      return NextResponse.json({
        error: `Cannot evaluate manifest in status "${manifest.status}". Expected IN_INSPECTION.`
      }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || 'inspector@cubelelo.com';

    if (manifest.inspectedBy !== userEmail) {
      return NextResponse.json(
        { error: 'This manifest is not in your inspector stack.' },
        { status: 403 },
      );
    }

    const manifestOrderIds = manifest.orders.map(order => order.platformOrderId);
    const scopedOrderId =
      typeof orderPlatformId === 'string' && orderPlatformId.trim()
        ? orderPlatformId.trim()
        : manifestOrderIds.length === 1
          ? manifestOrderIds[0]
          : null;

    if (!scopedOrderId) {
      return NextResponse.json(
        { error: 'Missing orderPlatformId for a multi-order manifest.' },
        { status: 400 },
      );
    }

    if (!manifestOrderIds.includes(scopedOrderId)) {
      return NextResponse.json(
        { error: `Order ${scopedOrderId} does not belong to this manifest.` },
        { status: 400 },
      );
    }

    // 1. Fetch expected removal shipments to determine expected quantities per FNSKU robustly
    const orderIds = (manifest.orders || []).map(o => o.platformOrderId);
    const trackingNumbers = [
      manifest.trackingId,
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

    const expectedFnskuQuantities = new Map<string, number>();
    let totalExpectedQty = 0;
    for (const s of shipments) {
      if (s.fnsku && s.shippedQuantity) {
        const fnsku = s.fnsku;
        expectedFnskuQuantities.set(fnsku, (expectedFnskuQuantities.get(fnsku) || 0) + s.shippedQuantity);
        totalExpectedQty += s.shippedQuantity;
      }
    }

    const scannedEntries = lpnConditions && typeof lpnConditions === 'object'
      ? Object.entries(lpnConditions as Record<string, unknown>)
      : [];

    console.log(`[Inspector Evaluate] Manifest ${manifestId}: scannedEntries=${scannedEntries.length}, orderDriveLink=${resolvedOrderDriveLink}, lpnFolderLinks keys=${Object.keys(lpnFolderLinksNormalized).join(',')}`);
    scannedEntries.forEach(([lpn, cond]) => console.log(`  LPN: ${lpn} => ${cond}`));

    await prisma.$transaction(async (tx) => {
      // A. Process all scanned return items
      for (const [lpn, rawCondition] of scannedEntries) {
        const normalizedLpnVal = normalizeLpn(lpn);

        // Retrieve from operational ReturnItem to get product attributes
        const rawReturn = await tx.returnItem.findUnique({
          where: { lpn: normalizedLpnVal }
        });

        if (rawReturn?.isInspected) {
          throw new Error(`LPN ${normalizedLpnVal} has already been inspected.`);
        }

        const scannedFnsku = rawReturn?.fnsku || rawReturn?.sku || 'UNKNOWN_FNSKU';
        const { resolvedCondition, claimReason, claimSubReason } = parseCondition(rawCondition);

        // Consume FNSKU expected quantity
        const expectedQty = expectedFnskuQuantities.get(scannedFnsku) || 0;
        if (expectedQty > 0) {
          expectedFnskuQuantities.set(scannedFnsku, expectedQty - 1);
        }

        // Dynamically upsert ReturnItem without deprecated fields
        await tx.returnItem.upsert({
          where: { lpn: normalizedLpnVal },
          update: {
            isInspected: true
          },
          create: {
            lpn: normalizedLpnVal,
            sku: rawReturn?.sku || "UNKNOWN_SKU",
            asin: rawReturn?.asin || null,
            fnsku: rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || "UNKNOWN"}`,
            customerComments: rawReturn?.customerComments || null,
            isInspected: true
          },
        });

        const recoveryType = lpnRecoveryTypes && lpnRecoveryTypes[lpn] ? lpnRecoveryTypes[lpn] : null;

        if (resolvedCondition === 'GOOD_SELLABLE') {
          // 1. Upsert 'GOOD' in ItemStatus with drive links and order reference
          // @ts-ignore
          await tx.itemStatus.upsert({
              where: { lpn: normalizedLpnVal },
              update: {
                status: 'GOOD',
                recoveryType: null,
                orderId: orderPlatformId,
                lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
                orderDriveLink: resolvedOrderDriveLink,
                manifestId: manifest.id,
              } as any,
              create: {
                lpn: normalizedLpnVal,
                status: 'GOOD',
                recoveryType: null,
                orderId: orderPlatformId,
                lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
                orderDriveLink: resolvedOrderDriveLink,
                manifestId: manifest.id,
              } as any,
            });
          console.log(`  [ItemStatus] Upserted GOOD for ${normalizedLpnVal}`);
          // 2. Delete any Evidence for this LPN (no longer needed for GOOD)
          await tx.evidence.deleteMany({
            where: { lpn: normalizedLpnVal }
          });
        // @ts-ignore
        } else if (resolvedCondition === 'PACKAGING_DAMAGED') {
          // 3. Upsert 'RECOVERY' in ItemStatus with drive links and order reference
          await tx.itemStatus.upsert({
              where: { lpn: normalizedLpnVal },
              update: {
                status: 'RECOVERY',
                recoveryType: recoveryType,
                orderId: orderPlatformId,
                lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
                orderDriveLink: resolvedOrderDriveLink,
                manifestId: manifest.id,
              } as any,
              create: {
                lpn: normalizedLpnVal,
                status: 'RECOVERY',
                recoveryType: recoveryType,
                orderId: orderPlatformId,
                lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
                orderDriveLink: resolvedOrderDriveLink,
                manifestId: manifest.id,
              } as any,
            });
          console.log(`  [ItemStatus] Upserted RECOVERY for ${normalizedLpnVal}`);
          // 4. Delete any Evidence for this LPN (not needed for RECOVERY)
          await tx.evidence.deleteMany({
            where: { lpn: normalizedLpnVal }
          });
        } else {
          // 5. If marked BAD, delete from ItemStatus if exists
          await tx.itemStatus.deleteMany({
            where: { lpn: normalizedLpnVal }
          });

          // Create/update Evidence if visually bad
          await tx.evidence.upsert({
            where: { lpn: normalizedLpnVal },
            update: {
              orderId: scopedOrderId,
              type: 'INSPECTOR_REJECTION',
              claimReason: claimReason || resolvedCondition,
              claimSubReason: claimSubReason || `Product defect for LPN ${normalizedLpnVal}`,
              orderDriveLink: resolvedOrderDriveLink,
              lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            },
            create: {
              lpn: normalizedLpnVal,
              orderId: scopedOrderId,
              type: 'INSPECTOR_REJECTION',
              claimReason: claimReason || resolvedCondition,
              claimSubReason: claimSubReason || `Product defect for LPN ${normalizedLpnVal}`,
              orderDriveLink: resolvedOrderDriveLink,
              lpnDriveLink: lpnFolderLinksNormalized[normalizedLpnVal] || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            }
          });
          console.log(`  [Evidence] Upserted BAD/REJECTED for ${normalizedLpnVal}`);
        }
      }

      // B. Process missing items — ONLY write to MissingItem table, NOT Evidence.
      // The MissingItem table stores fnsku + quantity + orderDriveLink as the evidence reference.
      let missingCount = 0;
      for (const [fnsku, missingQty] of expectedFnskuQuantities.entries()) {
        if (missingQty > 0) {
          missingCount += missingQty;

          await tx.missingItem.upsert({
            where: {
              orderId_fnsku: {
                orderId: scopedOrderId,
                fnsku: fnsku
              }
            },
            update: {
              missingQuantity: missingQty,
              orderDriveLink: evidenceUrl || null,
            },
            create: {
              orderId: scopedOrderId,
              fnsku: fnsku,
              missingQuantity: missingQty,
              orderDriveLink: evidenceUrl || null,
            }
          });
        } else {
          await tx.missingItem.deleteMany({
            where: {
              orderId: scopedOrderId,
              fnsku: fnsku
            }
          });
        }
      }

      // Raise Level L3 Alert for missing items if shortages exist
      if (missingCount > 0) {
        await tx.alert.create({
          data: {
            level: 'L3',
            type: 'MISSING_ITEMS',
            title: `Missing Items Detected`,
            description: `Inspection of tracking ID ${manifest.trackingId} found missing items. Expected: ${itemsExpected || totalExpectedQty}, Scanned: ${itemsScanned || scannedEntries.length}, Missing Shortages: ${missingCount}.`,
            manifestId: manifest.id,
          }
        });
      }

      // Determine manifest status based on return item conditions.
      // Any condition other than GOOD_SELLABLE (including PACKAGING_DAMAGED = product's original
      // box damage, PRODUCT_DAMAGED, WRONG_ITEM, BAD_FAKE_PRODUCT, MISSING) routes to CLAIMS_STAGING.
      // Only a fully clean inspection with all GOOD_SELLABLE items results in INSPECTED.

      let hasClaimableItems = false;
      for (const [lpn, rawCondition] of scannedEntries) {
        const { resolvedCondition } = parseCondition(rawCondition);
        if (resolvedCondition !== 'GOOD_SELLABLE') {
          hasClaimableItems = true;
          break;
        }
      }

      const targetStatus = (hasClaimableItems || missingCount > 0) ? 'CLAIMS_STAGING' : 'INSPECTED';

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { 
          status: targetStatus,
          inspectedAt: new Date()
        }
      });

      // Increment inspector's itemsProcessed count
      await tx.user.update({
        where: { id: userId },
        data: { itemsProcessed: { increment: itemsScanned || scannedEntries.length } }
      });

      console.log(`[Inspector Evaluate] Manifest ${manifest.trackingId} finished → ${targetStatus}. Scanned: ${scannedEntries.length}, Missing: ${missingCount}.`);
    }, {
      maxWait: 15000,
      timeout: 60000,
    });

    return NextResponse.json({ success: true, message: 'Inspection completed successfully' });
  } catch (error: any) {
    console.error('Inspector Evaluate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
