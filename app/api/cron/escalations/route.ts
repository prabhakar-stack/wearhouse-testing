import { NextResponse } from 'next/server';
import { runEscalationsJob } from '@/lib/cron';
import { requireCronAuth } from '@/lib/cronAuth';

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    const result = await runEscalationsJob();
    console.log(`[Cron Escalations] Results:`, result.results);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
