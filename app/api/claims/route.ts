import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const claims = await prisma.manifest.findMany({
      where: { status: 'CLAIMS_STAGING' },
      include: {
        inspection: true
      }
    });
    return NextResponse.json({ claims });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { manifestId } = await req.json();
    await prisma.manifest.update({
      where: { id: manifestId },
      data: { status: 'CLAIM_RESOLVED' }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to resolve claim' }, { status: 500 });
  }
}
