import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ awb: string }> }) {
  try {
    const { awb } = await params;
    const manifest = await prisma.manifest.findUnique({
      where: { trackingAwb: awb },
      include: {
        handshakes: { orderBy: { timestamp: 'asc' } },
        inspection: true,
        returnItems: true,
      }
    });

    if (!manifest) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    return NextResponse.json({ manifest });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
