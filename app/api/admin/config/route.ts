import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const configRecord = await (prisma as any).systemConfig.findUnique({
      where: { key: 'warehouse_hours' }
    });

    let config = { startTime: '00:00', endTime: '24:00' };
    if (configRecord) {
      try {
        config = JSON.parse(configRecord.value);
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'SUPER_ACCESS') {
      return NextResponse.json({ error: 'Forbidden: Only Super Access can modify system configs.' }, { status: 403 });
    }

    const body = await req.json();
    const { startTime, endTime } = body;

    // Validate format HH:MM
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: 'Invalid time format. Use HH:MM format (24-hour).' }, { status: 400 });
    }

    const value = JSON.stringify({ startTime, endTime });

    const configRecord = await (prisma as any).systemConfig.upsert({
      where: { key: 'warehouse_hours' },
      update: { value },
      create: { key: 'warehouse_hours', value }
    });

    return NextResponse.json({ success: true, config: { startTime, endTime } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
