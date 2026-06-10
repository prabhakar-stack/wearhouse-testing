import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereCondition: any = {
      status: 'AT_DOCK',
    };

    if (user.role !== 'SUPER_ACCESS' && user.role !== 'ADMIN') {
      whereCondition.receivedBy = user.email;
    }

    const ledger = await prisma.manifest.findMany({
      where: whereCondition,
      select: {
        id: true,
        trackingId: true,
        removalOrderId: true,
        receivedAt: true,
      },
      orderBy: {
        receivedAt: 'desc'
      }
    });

    const formattedLedger = ledger.map(m => {
      const returnItems = m.removalOrderId ? [{
        order: {
          marketplace: 'AMAZON',
          platformOrderId: m.removalOrderId,
        }
      }] : [];

      return {
        id: m.id,
        trackingId: m.trackingId,
        receivedAt: m.receivedAt,
        returnItems
      };
    });

    return NextResponse.json({ ledger: formattedLedger });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
