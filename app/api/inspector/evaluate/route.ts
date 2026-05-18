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
      where: { id: manifestId }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    // Rule - Missing Item (L3 Alert)
    if (isMissingItemFlagged) {
      await prisma.$transaction(async (tx) => {
        // Upsert inspection to ensure it exists
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
        
        await tx.manifest.update({
          where: { id: manifest.id },
          data: {
            status: 'CLAIMS_STAGING' // Usually it goes to CLAIMS_STAGING if it's an L3 alert
          }
        });
      });

      return NextResponse.json({ 
        success: true, 
        message: 'L3 Alert raised for missing items.', 
        l3Alert: true 
      }, { status: 200 }); // Return special alert payload
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

      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: 'INSPECTED'
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Inspection completed successfully' });
  } catch (error: any) {
    console.error('Inspector Evaluate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
