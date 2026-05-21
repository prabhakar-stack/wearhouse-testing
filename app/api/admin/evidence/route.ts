import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const evidence = await prisma.evidence.findMany({
      include: {
        manifest: true,
        returnItem: true,
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ evidence });
  } catch (error: any) {
    console.error('Error fetching admin evidence logs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
