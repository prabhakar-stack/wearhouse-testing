import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'SUPER_ACCESS') {
      return NextResponse.json({ error: 'Forbidden. Only SUPER_ACCESS can modify timestamps.' }, { status: 401 });
    }

    const { recordId, recordType, newTimestamp } = await req.json();
    const date = new Date(newTimestamp);

    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp provided.' }, { status: 400 });
    }

    let result;
    if (recordType === 'Manifest_Received') {
      result = await prisma.manifest.update({ where: { id: recordId }, data: { receivedAt: date } });
    } else if (recordType === 'Manifest_Expected') {
      result = await prisma.manifest.update({ where: { id: recordId }, data: { expectedDate: date } });
    } else {
      return NextResponse.json({ error: 'Invalid record type specified.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update timestamp' }, { status: 500 });
  }
}
