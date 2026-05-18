import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expected = await prisma.manifest.findMany({
      where: {
        status: 'EXPECTED',
      },
      select: {
        id: true,
        trackingAwb: true,
        courierName: true,
        status: true,
        expectedDate: true,
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
        expectedDate: 'asc'
      }
    });

    if (expected.length === 0) {
      // Mock data for demo purposes and showing L4 alert
      return NextResponse.json({ expected: [
        {
          id: 'mock-1',
          trackingAwb: 'AMZ-100200300',
          status: 'EXPECTED',
          expectedDate: new Date(Date.now() - 50 * 3600 * 1000).toISOString(), // 50 hours ago = L4 Alert
          returnItems: [{ order: { marketplace: 'AMAZON', platformOrderId: 'ORD-111' } }]
        },
        {
          id: 'mock-2',
          trackingAwb: 'FLP-998877665',
          status: 'EXPECTED',
          expectedDate: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), // 25 hours ago = Delayed
          returnItems: [{ order: { marketplace: 'SHOPIFY', platformOrderId: 'ORD-222' } }]
        },
        {
          id: 'mock-3',
          trackingAwb: 'MYN-445566778',
          status: 'EXPECTED',
          expectedDate: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago = On Time
          returnItems: []
        }
      ]});
    }

    return NextResponse.json({ expected });
  } catch (error) {
    console.error('Expected fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch expected packages' }, { status: 500 });
  }
}
