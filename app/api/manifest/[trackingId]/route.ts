import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    const manifest = await prisma.manifest.findUnique({
      where: { trackingId: trackingId },
      include: {
        handshakes: { orderBy: { timestamp: 'asc' } },
        inspection: true,
        orders: {
          include: {
            returnItems: true
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
        id: ri.lpn
      }))
    );

    const formattedManifest = {
      ...manifest,
      returnItems: flattenedReturnItems
    };

    return NextResponse.json({ manifest: formattedManifest });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
