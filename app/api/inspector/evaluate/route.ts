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

async function resolveFnskuForSku(sku: string): Promise<string | null> {
  const ret = await prisma.aMZCustomerReturn.findFirst({
    where: { sku },
    select: { fnsku: true }
  });
  if (ret?.fnsku) return ret.fnsku;

  const rem = await prisma.aMZRemovalOrder.findFirst({
    where: { sku },
    select: { fnsku: true }
  });
  if (rem?.fnsku) return rem.fnsku;

  return null;
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
      lpnConditions, // Record of scanned items: { [lpn]: 'good' | 'bad' | 'recovery' }
      lpnRecoveryTypes, // Record of recovery types: { [lpn]: string }
    } = body;

    if (!manifestId) {
      return NextResponse.json({ error: 'Missing manifestId' }, { status: 400 });
    }

    const manifest = await prisma.manifest.findUnique({
      where: { id: manifestId },
      include: {
        orders: {
          include: {
            returnItems: {
              select: { lpn: true, condition: true }
            }
          }
        }
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

    // 1. Fetch expected removal shipments to determine expected quantities per SKU/FNSKU
    const shipments = await prisma.removalShipment.findMany({
      where: { removalOrderId: scopedOrderId }
    });

    const expectedSkuQuantities = new Map<string, number>();
    for (const s of shipments) {
      if (s.sku && s.shippedQuantity) {
        expectedSkuQuantities.set(s.sku, (expectedSkuQuantities.get(s.sku) || 0) + s.shippedQuantity);
      }
    }

    const expectedFnskuQuantities = new Map<string, number>();
    let totalExpectedQty = 0;
    for (const [sku, qty] of expectedSkuQuantities.entries()) {
      const fnsku = await resolveFnskuForSku(sku) || sku;
      expectedFnskuQuantities.set(fnsku, (expectedFnskuQuantities.get(fnsku) || 0) + qty);
      totalExpectedQty += qty;
    }

    const scannedEntries = lpnConditions && typeof lpnConditions === 'object'
      ? Object.entries(lpnConditions as Record<string, unknown>)
      : [];

    await prisma.$transaction(async (tx) => {
      // A. Process all scanned return items
      for (const [lpn, rawCondition] of scannedEntries) {
        const normalizedLpnVal = normalizeLpn(lpn);

        // Retrieve from customer returns report database to get product attributes
        const rawReturn = await tx.aMZCustomerReturn.findUnique({
          where: { lpn: normalizedLpnVal }
        });

        const scannedFnsku = rawReturn?.fnsku || rawReturn?.sku || 'UNKNOWN_FNSKU';
        const resolvedCondition = resolveCondition(rawCondition);

        // Consume FNSKU expected quantity
        const expectedQty = expectedFnskuQuantities.get(scannedFnsku) || 0;
        if (expectedQty > 0) {
          expectedFnskuQuantities.set(scannedFnsku, expectedQty - 1);
        }

        const claimReason = resolvedCondition === 'PRODUCT_DAMAGED' ? 'PRODUCT_DAMAGE' : null;
        const claimSubReason = resolvedCondition === 'PRODUCT_DAMAGED' ? 'Product damaged' : null;

        // Dynamically create or update ReturnItem
        await tx.returnItem.upsert({
          where: { lpn: normalizedLpnVal },
          update: {
            orderId: scopedOrderId,
            sku: rawReturn?.sku || 'UNKNOWN_SKU',
            asin: rawReturn?.asin || null,
            fnsku: rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || 'UNKNOWN'}`,
            returnReason: rawReturn?.reason || 'Removal Order Shipment',
            customerComments: rawReturn?.customerComments || null,
            amazonDisposition: rawReturn?.detailedDisposition || 'SELLABLE',
            customerOrderId: rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER',
            condition: resolvedCondition as any,
          },
          create: {
            lpn: normalizedLpnVal,
            orderId: scopedOrderId,
            sku: rawReturn?.sku || 'UNKNOWN_SKU',
            asin: rawReturn?.asin || null,
            fnsku: rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || 'UNKNOWN'}`,
            returnReason: rawReturn?.reason || 'Removal Order Shipment',
            customerComments: rawReturn?.customerComments || null,
            amazonDisposition: rawReturn?.detailedDisposition || 'SELLABLE',
            customerOrderId: rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER',
            condition: resolvedCondition as any,
          }
        });

        const recoveryType = lpnRecoveryTypes && lpnRecoveryTypes[lpn] ? lpnRecoveryTypes[lpn] : null;

        if (resolvedCondition === 'GOOD_SELLABLE') {
          // 1. Upsert 'GOOD' in ItemStatus
          await tx.itemStatus.upsert({
            where: { lpn: normalizedLpnVal },
            update: { status: 'GOOD', recoveryType: null },
            create: { lpn: normalizedLpnVal, status: 'GOOD', recoveryType: null }
          });
          // 2. Delete Evidence for this LPN if it exists
          await tx.evidence.deleteMany({
            where: { lpn: normalizedLpnVal }
          });
        } else if (resolvedCondition === 'PACKAGING_DAMAGED') {
          // 3. Upsert 'RECOVERY' in ItemStatus
          await tx.itemStatus.upsert({
            where: { lpn: normalizedLpnVal },
            update: { status: 'RECOVERY', recoveryType: recoveryType },
            create: { lpn: normalizedLpnVal, status: 'RECOVERY', recoveryType: recoveryType }
          });
          // 4. Delete Evidence for this LPN if it exists
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
              returnItemId: normalizedLpnVal,
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
              returnItemId: normalizedLpnVal,
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
      
      const latestItems = await tx.returnItem.findMany({
        where: { orderId: scopedOrderId },
        select: { condition: true }
      });

      const hasClaimableItems = latestItems.some(
        item => item.condition && claimableConditions.includes(item.condition)
      );

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
