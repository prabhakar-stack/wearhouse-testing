import { NextResponse } from 'next/server';
import { runEscalationsJob } from '@/lib/cron';
import { requireCronAuth } from '@/lib/cronAuth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    void runEscalationsJob().catch((error: any) => {
      console.error('[Cron Escalations] Background job failed:', error);
    });

    return NextResponse.json({
      success: true,
      queued: true,
      message: 'Escalations job started',
    }, { status: 202 });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
