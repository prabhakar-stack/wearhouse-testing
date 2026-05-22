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
  const condition = typeof rawCondition === 'string' ? rawCondition.trim() : '';
  if (ALLOWED_CONDITIONS.has(condition)) return condition;
  if (condition === 'good') return 'GOOD_SELLABLE';
  if (condition === 'recovery') return 'PACKAGING_DAMAGED';
  if (condition === 'bad' || condition.startsWith('bad:')) return 'PRODUCT_DAMAGED';
  return 'PRODUCT_DAMAGED';
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
      isMissingItemFlagged,
      evidenceUrl,
      lpnConditions,
    } = body;

    if (!manifestId) {
      return NextResponse.json({ error: 'Missing manifestId' }, { status: 400 });
    }

    const manifest = await prisma.manifest.findUnique({
      where: { id: manifestId },
      include: {
        handshakes: {
          where: { type: 'RECEIVER_TO_INSPECTOR' },
          orderBy: { timestamp: 'desc' },
          select: { receiverId: true, timestamp: true },
        },
        inspection: {
          select: { id: true, completedAt: true },
        },
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

    const latestInspectorHandshake = manifest.handshakes[0];
    if (!latestInspectorHandshake || latestInspectorHandshake.receiverId !== userId) {
      return NextResponse.json(
        { error: 'This manifest is not in your inspector stack.' },
        { status: 403 },
      );
    }

    if (manifest.inspection?.completedAt) {
      return NextResponse.json(
        { error: 'This manifest has already been inspected.' },
        { status: 409 },
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

    const expectedReturnItems = manifest.orders
      .filter(order => order.platformOrderId === scopedOrderId)
      .flatMap(order =>
        (order.returnItems || []).map(item => ({
          ...item,
          orderId: order.platformOrderId,
        })),
      );
    const expectedByLpn = new Map(
      expectedReturnItems
        .filter(item => item.lpn)
        .map(item => [normalizeLpn(item.lpn), item]),
    );
    const scannedEntries = lpnConditions && typeof lpnConditions === 'object'
      ? Object.entries(lpnConditions as Record<string, unknown>)
      : [];
    const invalidLpns = scannedEntries
      .map(([lpn]) => lpn)
      .filter(lpn => !expectedByLpn.has(normalizeLpn(lpn)));

    if (invalidLpns.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more scanned LPNs do not belong to this order.',
          invalidLpns,
          orderId: scopedOrderId,
        },
        { status: 400 },
      );
    }

    const scannedLpnSet = new Set(scannedEntries.map(([lpn]) => normalizeLpn(lpn)));
    const missingReturnItems = expectedReturnItems.filter(
      item => item.lpn && !scannedLpnSet.has(normalizeLpn(item.lpn)),
    );

    // Rule - Missing Item (L3 Alert)
    if (isMissingItemFlagged) {
      await prisma.$transaction(async (tx) => {
        const existingInspection = await tx.inspection.findUnique({
          where: { manifestId: manifest.id },
          select: { id: true },
        });

        for (const [lpn, rawCondition] of scannedEntries) {
          const expectedItem = expectedByLpn.get(normalizeLpn(lpn));
          if (!expectedItem) continue;
          await tx.returnItem.update({
            where: { lpn: expectedItem.lpn },
            data: { condition: resolveCondition(rawCondition) as any },
          });
        }

        for (const item of missingReturnItems) {
          await tx.returnItem.update({
            where: { lpn: item.lpn },
            data: { condition: 'MISSING' },
          });
        }

        await tx.inspection.upsert({
          where: { manifestId: manifest.id },
          update: {
            isMissingItems: true,
            totalItemsScanned: itemsScanned || 0,
            evidenceUrl: evidenceUrl || null,
            completedAt: new Date()
          },
          create: {
            manifestId: manifest.id,
            inspectorId: userId,
            totalItemsExpected: itemsExpected || 0,
            totalItemsScanned: itemsScanned || 0,
            isMissingItems: true,
            evidenceUrl: evidenceUrl || null,
            completedAt: new Date()
          }
        });

        const existingDispute = await tx.dispute.findFirst({
          where: {
            manifestId: manifest.id,
            type: 'L3_MISSING_ITEM',
            resolved: false,
          },
        });
        if (!existingDispute) {
          await tx.dispute.create({
            data: {
              manifestId: manifest.id,
              type: 'L3_MISSING_ITEM',
              evidenceUrl: evidenceUrl || null
            }
          });
        }

        // Missing items always go to CLAIMS_STAGING
        await tx.manifest.update({
          where: { id: manifest.id },
          data: { status: 'CLAIMS_STAGING' }
        });

        // Increment inspector's itemsProcessed
        if (!existingInspection) {
          await tx.user.update({
            where: { id: userId },
            data: { itemsProcessed: { increment: itemsScanned || 1 } }
          });
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'L3 Alert raised for missing items.', 
        l3Alert: true 
      }, { status: 200 });
    }

    // Default Success Path
    await prisma.$transaction(async (tx) => {
      const existingInspection = await tx.inspection.findUnique({
        where: { manifestId: manifest.id },
        select: { id: true },
      });

      for (const [lpn, rawCondition] of scannedEntries) {
        const expectedItem = expectedByLpn.get(normalizeLpn(lpn));
        if (!expectedItem) continue;
        await tx.returnItem.update({
          where: { lpn: expectedItem.lpn },
          data: { condition: resolveCondition(rawCondition) as any },
        });
      }

      await tx.inspection.upsert({
        where: { manifestId: manifest.id },
        update: {
          isMissingItems: false,
          totalItemsScanned: itemsScanned || 0,
          evidenceUrl: evidenceUrl || null,
          completedAt: new Date()
        },
        create: {
          manifestId: manifest.id,
          inspectorId: userId,
          totalItemsExpected: itemsExpected || 0,
          totalItemsScanned: itemsScanned || 0,
          isMissingItems: false,
          evidenceUrl: evidenceUrl || null,
          completedAt: new Date()
        }
      });

      // Determine target status based on return item conditions
      // If ANY item is BAD (PRODUCT_DAMAGED, WRONG_ITEM, BAD_FAKE_PRODUCT) → CLAIMS_STAGING
      // Otherwise → INSPECTED (can go to RECOVERED_TO_INVENTORY)
      const claimableConditions = ['PRODUCT_DAMAGED', 'WRONG_ITEM', 'BAD_FAKE_PRODUCT', 'MISSING'];
      
      // Re-fetch scoped return items to get the latest conditions updated above.
      const latestItems = await tx.returnItem.findMany({
        where: { orderId: scopedOrderId },
        select: { condition: true }
      });

      const hasClaimableItems = latestItems.some(
        item => item.condition && claimableConditions.includes(item.condition)
      );

      const targetStatus = hasClaimableItems ? 'CLAIMS_STAGING' : 'INSPECTED';

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { status: targetStatus }
      });

      // Increment inspector's itemsProcessed
      if (!existingInspection) {
        await tx.user.update({
          where: { id: userId },
          data: { itemsProcessed: { increment: itemsScanned || 1 } }
        });
      }

      console.log(`[Inspector Evaluate] Manifest ${manifest.trackingId} → ${targetStatus}. ${hasClaimableItems ? 'BAD items found, routing to claims.' : 'All items OK.'}`);
    });

    return NextResponse.json({ success: true, message: 'Inspection completed successfully' });
  } catch (error: any) {
    console.error('Inspector Evaluate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
