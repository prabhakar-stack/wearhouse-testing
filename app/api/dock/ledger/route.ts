import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ledger = await prisma.manifest.findMany({
      where: {
        status: 'AT_DOCK',
        handshakes: {
          some: {
            receiverId: userId,
            type: 'COURIER_TO_RECEIVER'
          }
        }
      },
      select: {
        id: true,
        trackingAwb: true,
        receivedAt: true,
        returnItems: {
          select: {
            order: {
              select: {
                marketplace: true,
                platformOrderId: true
              }
            }
          }
        }
      },
      orderBy: {
        receivedAt: 'desc'
      }
    });

    return NextResponse.json({ ledger });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
