import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!role || !['INSPECTOR', 'ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized — missing user ID' }, { status: 401 });
    }

    const body = await req.json();
    const { trackingId } = body;

    if (!trackingId) {
      return NextResponse.json({ error: 'Missing trackingId' }, { status: 400 });
    }

    // Find the manifest
    const manifest = await prisma.manifest.findUnique({
      where: { trackingId },
      include: {
        orders: {
          include: {
            returnItems: {
              select: { lpn: true, sku: true }
            }
          }
        }
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: `No manifest found for Tracking ID: ${trackingId}` }, { status: 404 });
    }

    if (manifest.status !== 'AT_DOCK') {
      return NextResponse.json({
        error: `This package cannot be taken over from status "${manifest.status}". Expected AT_DOCK.`,
        manifest: {
          id: manifest.id,
          trackingId: manifest.trackingId,
          status: manifest.status,
        }
      }, { status: 409 });
    }

    const initialReturnItems = (manifest.orders || []).flatMap(o =>
      (o.returnItems || []).map(ri => ({
        id: ri.lpn,
        lpn: ri.lpn,
        sku: ri.sku
      }))
    );

    // Check if already taken over
    if (manifest.inspectedBy) {
      return NextResponse.json({
        error: 'This package has already been taken over by an inspector',
        manifest: {
          id: manifest.id,
          trackingId: manifest.trackingId,
          status: manifest.status,
          itemCount: initialReturnItems.length,
          returnItems: initialReturnItems,
        }
      }, { status: 409 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || 'inspector@cubelelo.com';

    // Transaction: update status and inspectedBy
    const result = await prisma.$transaction(async (tx) => {
      // Update manifest status to IN_INSPECTION and set inspectedBy
      const updated = await tx.manifest.update({
        where: { id: manifest.id },
        data: { 
          status: 'IN_INSPECTION',
          inspectedBy: userEmail
        },
        include: {
          orders: {
            include: {
              returnItems: {
                select: { lpn: true, sku: true }
              }
            }
          }
        }
      });

      return { manifest: updated };
    });

    const updatedReturnItems = (result.manifest.orders || []).flatMap(o =>
      (o.returnItems || []).map(ri => ({
        id: ri.lpn,
        lpn: ri.lpn,
        sku: ri.sku
      }))
    );

    const expectedItemCount = updatedReturnItems.length;

    console.log(`[Inspector Takeover] Inspector ${userId} took custody of Tracking ID: ${trackingId}. Expected items: ${expectedItemCount}`);

    return NextResponse.json({
      success: true,
      message: 'Custody transferred to inspector',
      manifest: {
        id: result.manifest.id,
        trackingId: result.manifest.trackingId,
        status: result.manifest.status,
        itemCount: expectedItemCount,
        returnItems: updatedReturnItems,
      }
    });
  } catch (error: any) {
    console.error('Inspector Takeover Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
