import { NextResponse } from 'next/server';
import { runEscalationsJob } from '@/lib/cron';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runEscalationsJob();
    console.log(`[Cron Escalations] Results:`, result.results);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
