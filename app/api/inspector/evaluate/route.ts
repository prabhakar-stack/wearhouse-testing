import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const { manifestId, itemsScanned, itemsExpected, isMissingItemFlagged, evidenceUrl } = body;

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

    // Status validation: only IN_INSPECTION manifests can be evaluated
    // Also allow AT_DOCK for backwards compatibility during transition
    if (!['IN_INSPECTION', 'AT_DOCK'].includes(manifest.status)) {
      return NextResponse.json({ 
        error: `Cannot evaluate manifest in status "${manifest.status}". Expected IN_INSPECTION.` 
      }, { status: 400 });
    }

    // Rule - Missing Item (L3 Alert)
    if (isMissingItemFlagged) {
      await prisma.$transaction(async (tx) => {
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

        await tx.dispute.create({
          data: {
            manifestId: manifest.id,
            type: 'L3_MISSING_ITEM',
            evidenceUrl: evidenceUrl || null
          }
        });
        
        // Missing items always go to CLAIMS_STAGING
        await tx.manifest.update({
          where: { id: manifest.id },
          data: { status: 'CLAIMS_STAGING' }
        });

        // Create a generic evidence entry for the missing items (no URLs)
        const placeholderLpn = `MISSING-${manifest.trackingId}-${Date.now()}`;
        const firstOrderId = manifest.orders?.[0]?.platformOrderId || null;
        await tx.evidence.create({
          data: {
            lpn: placeholderLpn,
            orderId: firstOrderId,
            reason: 'missing',
            type: 'RECEIVER_REJECTION',
            manifestId: manifest.id,
            // other optional fields remain null
          }
        });

        // Increment inspector's itemsProcessed
        await tx.user.update({
          where: { id: userId },
          data: { itemsProcessed: { increment: itemsScanned || 1 } }
        });
      });

      return NextResponse.json({ 
        success: true, 
        message: 'L3 Alert raised for missing items.', 
        l3Alert: true 
      }, { status: 200 });
    }

    // Default Success Path
    await prisma.$transaction(async (tx) => {
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
      
      // Re-fetch return items to get the latest conditions (may have been updated during inspection)
      const latestItems = await tx.returnItem.findMany({
        where: { order: { manifestId: manifest.id } },
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
      await tx.user.update({
        where: { id: userId },
        data: { itemsProcessed: { increment: itemsScanned || 1 } }
      });

      console.log(`[Inspector Evaluate] Manifest ${manifest.trackingId} → ${targetStatus}. ${hasClaimableItems ? 'BAD items found, routing to claims.' : 'All items OK.'}`);
    });

    return NextResponse.json({ success: true, message: 'Inspection completed successfully' });
  } catch (error: any) {
    console.error('Inspector Evaluate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
