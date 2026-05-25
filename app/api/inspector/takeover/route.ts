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
        orders: true
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: `No manifest found for Tracking ID: ${trackingId}` }, { status: 404 });
    }

    const allowedTakeoverStatuses = ['AT_DOCK', 'IN_INSPECTION'];
    if (!allowedTakeoverStatuses.includes(manifest.status)) {
      return NextResponse.json({
        error: `This package cannot be taken over from status "${manifest.status}". Expected AT_DOCK or IN_INSPECTION.`,
        manifest: {
          id: manifest.id,
          trackingId: manifest.trackingId,
          status: manifest.status,
        }
      }, { status: 409 });
    }

    // Since ReturnItem is decoupled, load expected return items from AMZRemovalShipment SKUs / FNSKUs matching the manifest/orders
    const orderIds = (manifest.orders || []).map(o => o.platformOrderId);
    const trackingNumbers = (manifest.orders || []).map(o => o.trackingNumber).filter((t): t is string => !!t);

    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { trackingNumber: { in: trackingNumbers } }
        ]
      }
    });

    const totalExpectedQty = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

    const expectedSkus = Array.from(new Set(shipments.map(s => s.sku).filter((s): s is string => !!s)));
    const expectedFnskus = Array.from(new Set(shipments.map(s => s.fnsku).filter((f): f is string => !!f)));

    const returnItems = await prisma.returnItem.findMany({
      where: {
        OR: [
          { sku: { in: expectedSkus } },
          { fnsku: { in: expectedFnskus } },
          // removed orderId filter
        ]
      },
      select: { lpn: true, sku: true }
    });

    const initialReturnItems = returnItems.map(ri => ({
      id: ri.lpn,
      lpn: ri.lpn,
      sku: ri.sku
    }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || 'inspector@cubelelo.com';

    // Check if already taken over by the SAME inspector
    if (manifest.status === 'IN_INSPECTION' && manifest.inspectedBy === userEmail) {
      return NextResponse.json({
        success: true,
        message: 'Custody verified (already in custody)',
        manifest: {
          id: manifest.id,
          trackingId: manifest.trackingId,
          status: manifest.status,
          itemCount: initialReturnItems.length,
          returnItems: initialReturnItems,
        }
      });
    }

    // Warn if already taken over by someone else
    if (manifest.status === 'IN_INSPECTION' && manifest.inspectedBy && manifest.inspectedBy !== userEmail) {
      console.warn(`[Inspector Takeover Warning] Re-assigning manifest ${trackingId} from ${manifest.inspectedBy} to ${userEmail}`);
    }

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
          orders: true
        }
      });

      return { manifest: updated };
    });

    // Reload return items for result
    const updatedReturnItems = await prisma.returnItem.findMany({
      where: {
        OR: [
          { sku: { in: expectedSkus } },
          { fnsku: { in: expectedFnskus } },
          // removed orderId filter
        ]
      },
      select: { lpn: true, sku: true }
    }).then(items => items.map(ri => ({
      id: ri.lpn,
      lpn: ri.lpn,
      sku: ri.sku
    })));

    const expectedItemCount = totalExpectedQty;

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
