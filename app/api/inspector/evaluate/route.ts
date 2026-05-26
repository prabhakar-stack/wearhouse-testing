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

function resolveCondition(rawCondition: unknown) {
  const condition = typeof rawCondition === 'string' ? rawCondition.trim().toLowerCase() : '';
  if (condition === 'good' || condition === 'good_sellable') return 'GOOD_SELLABLE';
  if (condition === 'recovery' || condition === 'packaging_damaged') return 'PACKAGING_DAMAGED';
  return 'PRODUCT_DAMAGED'; // 'bad' maps to PRODUCT_DAMAGED
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
      orderDriveLink, // optional order‑level Google Drive folder URL
      lpnConditions, // Record of scanned items: { [lpn]: 'good' | 'bad' | 'recovery' }
      lpnRecoveryTypes, // Record of recovery types: { [lpn]: string }
    } = body;

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

    await prisma.$transaction(async (tx) => {
      // A. Process all scanned return items
      for (const [lpn, rawCondition] of scannedEntries) {
        const normalizedLpnVal = normalizeLpn(lpn);

        // Retrieve from operational ReturnItem to get product attributes
        const rawReturn = await tx.returnItem.findUnique({
          where: { lpn: normalizedLpnVal }
        });

        const scannedFnsku = rawReturn?.fnsku || rawReturn?.sku || 'UNKNOWN_FNSKU';
        const resolvedCondition = resolveCondition(rawCondition);

        // Consume FNSKU expected quantity
        const expectedQty = expectedFnskuQuantities.get(scannedFnsku) || 0;
        if (expectedQty > 0) {
          expectedFnskuQuantities.set(scannedFnsku, expectedQty - 1);
        }

        // Dynamically upsert ReturnItem without deprecated fields
        await tx.returnItem.upsert({
          where: { lpn: normalizedLpnVal },
          update: {},
          create: {
            lpn: normalizedLpnVal,
            sku: rawReturn?.sku || "UNKNOWN_SKU",
            asin: rawReturn?.asin || null,
            fnsku: rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || "UNKNOWN"}`,

            customerComments: rawReturn?.customerComments || null,

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
                lpnDriveLink: evidenceUrl || null,
                orderDriveLink: orderDriveLink || null,
              } as any,
              create: {
                lpn: normalizedLpnVal,
                status: 'GOOD',
                recoveryType: null,
                orderId: orderPlatformId,
                lpnDriveLink: evidenceUrl || null,
                orderDriveLink: orderDriveLink || null,
              } as any,
            });
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
                lpnDriveLink: evidenceUrl || null,
                orderDriveLink: orderDriveLink || null,
              } as any,
              create: {
                lpn: normalizedLpnVal,
                status: 'RECOVERY',
                recoveryType: recoveryType,
                orderId: orderPlatformId,
                lpnDriveLink: evidenceUrl || null,
                orderDriveLink: orderDriveLink || null,
              } as any,
            });
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
              claimReason: resolvedCondition,
              claimSubReason: resolvedCondition === 'PRODUCT_DAMAGED' ? 'Product damaged' : 'Packaging damaged',
              orderDriveLink: evidenceUrl || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            },
            create: {
              lpn: normalizedLpnVal,
              orderId: scopedOrderId,
              type: 'INSPECTOR_REJECTION',
              claimReason: resolvedCondition,
              claimSubReason: resolvedCondition === 'PRODUCT_DAMAGED' ? 'Product damaged' : 'Packaging damaged',
              orderDriveLink: evidenceUrl || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            }
          });
        }
      }

      // B. Process missing items (expected FNSKUs remaining unscanned)
      let missingCount = 0;
      for (const [fnsku, missingQty] of expectedFnskuQuantities.entries()) {
        if (missingQty > 0) {
          missingCount += missingQty;

          // Store shortage details in MissingItem table
          await tx.missingItem.upsert({
            where: {
              orderId_fnsku: {
                orderId: scopedOrderId,
                fnsku: fnsku
              }
            },
            update: {
              missingQuantity: missingQty
            },
            create: {
              orderId: scopedOrderId,
              fnsku: fnsku,
              missingQuantity: missingQty
            }
          });

          // Create Evidence for claims for this shortage under a virtual LPN key
          const missingLpn = `missing_${scopedOrderId}_${fnsku}`;
          await tx.evidence.upsert({
            where: { lpn: missingLpn },
            update: {
              orderId: scopedOrderId,
              type: 'INSPECTOR_REJECTION',
              claimReason: 'MISSING',
              claimSubReason: `FNSKU ${fnsku} is missing during inspection (Quantity: ${missingQty})`,
              orderDriveLink: evidenceUrl || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            },
            create: {
              lpn: missingLpn,
              orderId: scopedOrderId,
              type: 'INSPECTOR_REJECTION',
              claimReason: 'MISSING',
              claimSubReason: `FNSKU ${fnsku} is missing during inspection (Quantity: ${missingQty})`,
              orderDriveLink: evidenceUrl || null,
              uploadedByEmail: userEmail,
              manifestId: manifest.id,
            }
          });
        } else {
          // If no longer missing, delete any shortage ledger entry
          await tx.missingItem.deleteMany({
            where: {
              orderId: scopedOrderId,
              fnsku: fnsku
            }
          });

          const missingLpn = `missing_${scopedOrderId}_${fnsku}`;
          await tx.evidence.deleteMany({
            where: { lpn: missingLpn }
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

      // Determine manifest status based on return item conditions
      // If ANY item is BAD or RECOVERY, or if we have missing shortage items → CLAIMS_STAGING. Otherwise → INSPECTED
      const claimableConditions = ['PRODUCT_DAMAGED', 'WRONG_ITEM', 'BAD_FAKE_PRODUCT', 'MISSING', 'PACKAGING_DAMAGED'];

      let hasClaimableItems = false;
      for (const [lpn, rawCondition] of scannedEntries) {
        const resolvedCondition = resolveCondition(rawCondition);
        if (resolvedCondition !== 'GOOD_SELLABLE') {
          hasClaimableItems = true;
          break;
        }
      }

      const targetStatus = (hasClaimableItems || missingCount > 0) ? 'CLAIMS_STAGING' : 'INSPECTED';

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { status: targetStatus }
      });

      // Increment inspector's itemsProcessed count
      await tx.user.update({
        where: { id: userId },
        data: { itemsProcessed: { increment: itemsScanned || scannedEntries.length } }
      });

      console.log(`[Inspector Evaluate] Manifest ${manifest.trackingId} finished → ${targetStatus}. Scanned: ${scannedEntries.length}, Missing: ${missingCount}.`);
    });

    return NextResponse.json({ success: true, message: 'Inspection completed successfully' });
  } catch (error: any) {
    console.error('Inspector Evaluate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
