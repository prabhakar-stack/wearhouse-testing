import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const COOKIE_PATH = path.join(ROOT, 'scripts', 'bot_state', 'smarthub_auth.json');

/**
 * Helper: update the smarthub_job record in SystemConfig
 */
async function updateJob(patch: {
  status?: string;
  message?: string;
  logEntry?: string;
  finishedAt?: string;
  lastError?: string;
  recordsUpserted?: number;
}) {
  const record = await (prisma as any).systemConfig.findUnique({
    where: { key: 'smarthub_job' },
  });

  let current: Record<string, any> = { log: [] };
  if (record) {
    try { current = JSON.parse(record.value); } catch { /* ignore */ }
  }

  if (patch.logEntry) {
    current.log = [...(current.log ?? []), patch.logEntry];
  }
  if (patch.status !== undefined) current.status = patch.status;
  if (patch.message !== undefined) current.message = patch.message;
  if (patch.finishedAt !== undefined) current.finishedAt = patch.finishedAt;
  if (patch.lastError !== undefined) current.lastError = patch.lastError;
  if (patch.recordsUpserted !== undefined) current.recordsUpserted = patch.recordsUpserted;

  await (prisma as any).systemConfig.upsert({
    where: { key: 'smarthub_job' },
    update: { value: JSON.stringify(current) },
    create: { key: 'smarthub_job', value: JSON.stringify(current) },
  });
}

/**
 * POST /api/cron/smarthub-sync
 *
 * Runs the SmartHub B2C pipeline in two steps:
 *   1. Download returns CSV from SmartHub (using saved Playwright session)
 *   2. Push CSV rows to Supabase (AMAZON_B2C_SMARTHUB table)
 *
 * Auth: Bearer <CRON_SECRET> (same pattern as all other cron routes)
 *
 * This endpoint is designed to run on Render (has Playwright + filesystem + Node.js).
 * When called from Vercel, it proxies the request to RENDER_INTERNAL_URL.
 */
export async function POST(req: Request) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. If running on Vercel (no filesystem), proxy to Render ─────────────
  const renderUrl = process.env.RENDER_INTERNAL_URL;
  const isRender = !!process.env.RENDER; // Render sets this env var automatically

  if (!isRender && renderUrl) {
    try {
      const proxyRes = await fetch(`${renderUrl}/api/cron/smarthub-sync`, {
        method: 'POST',
        headers: { authorization: authHeader! },
      });
      const data = await proxyRes.json();
      return NextResponse.json({ proxied: true, renderResponse: data });
    } catch (proxyErr: any) {
      return NextResponse.json(
        { error: `Failed to proxy to Render: ${proxyErr.message}` },
        { status: 502 }
      );
    }
  }

  // ── 3. Load session from DB if file doesn't exist / is stale ─────────────
  const fileExists = fs.existsSync(COOKIE_PATH);
  const fileStale = fileExists
    ? (Date.now() - fs.statSync(COOKIE_PATH).mtime.getTime()) / (1000 * 60 * 60) > 16
    : true;

  if (!fileExists || fileStale) {
    try {
      const sessionRecord = await (prisma as any).systemConfig.findUnique({
        where: { key: 'smarthub_session' },
      });

      if (!sessionRecord) {
        await updateJob({
          status: 'error',
          message: 'No session found. Please capture a SmartHub session first.',
          logEntry: '❌ No session in database. Capture a session from the Settings tab.',
          finishedAt: new Date().toISOString(),
        });
        return NextResponse.json(
          { error: 'No SmartHub session stored. Please capture a session first.' },
          { status: 422 }
        );
      }

      // Decode base64 → JSON → write to disk
      const decoded = Buffer.from(sessionRecord.value, 'base64').toString('utf8');
      const dir = path.dirname(COOKIE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(COOKIE_PATH, decoded, 'utf8');

      await updateJob({ logEntry: '✅ Loaded session from database' });
    } catch (dbErr: any) {
      await updateJob({
        status: 'error',
        message: `Failed to load session: ${dbErr.message}`,
        logEntry: `❌ DB session load failed: ${dbErr.message}`,
        finishedAt: new Date().toISOString(),
      });
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }
  } else {
    await updateJob({ logEntry: '✅ Using existing session file (fresh)' });
  }

  // ── 4. Mark job as running ────────────────────────────────────────────────
  await updateJob({
    status: 'downloading',
    message: 'Downloading returns CSV from SmartHub...',
    logEntry: '⏳ Starting SmartHub CSV download...',
  });

  // ── 5. Step 1 — Download CSV via Playwright ───────────────────────────────
  try {
    const dlStart = Date.now();
    execSync('node scripts/download_smarthub_csv.js', {
      stdio: 'pipe',
      cwd: ROOT,
      timeout: 5 * 60 * 1000, // 5 min timeout
    });
    const dlSecs = ((Date.now() - dlStart) / 1000).toFixed(1);
    await updateJob({
      status: 'pushing',
      message: 'Pushing CSV data to Supabase...',
      logEntry: `✅ CSV downloaded in ${dlSecs}s`,
    });
  } catch (dlErr: any) {
    const stdout = dlErr.stdout ? dlErr.stdout.toString('utf8') : '';
    const stderr = dlErr.stderr ? dlErr.stderr.toString('utf8') : '';
    const errMsg = `❌ Download failed: ${dlErr.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
    console.error('[SmartHub Sync]', errMsg);

    await updateJob({
      status: 'error',
      message: 'CSV download failed. Session may have expired.',
      logEntry: `❌ Download failed: ${dlErr.message}. See error logs.`,
      lastError: errMsg,
      finishedAt: new Date().toISOString(),
    });

    // Update CronJobState
    await (prisma as any).cronJobState.upsert({
      where: { jobKey: 'smarthub_sync' },
      update: { lastRunAt: new Date(), lastError: errMsg },
      create: { jobKey: 'smarthub_sync', lastRunAt: new Date(), lastError: errMsg },
    });

    return NextResponse.json(
      { error: `Download failed: ${dlErr.message}`, stdout, stderr },
      { status: 500 }
    );
  }

  // ── 6. Step 2 — Push CSV to Supabase ─────────────────────────────────────
  try {
    const pushStart = Date.now();
    execSync('node scripts/push_smarthub_csv_to_supabase.js', {
      stdio: 'pipe',
      cwd: ROOT,
      timeout: 5 * 60 * 1000, // 5 min timeout
    });
    const pushSecs = ((Date.now() - pushStart) / 1000).toFixed(1);

    await updateJob({
      status: 'done',
      message: 'Sync complete! Data pushed to Supabase.',
      logEntry: `✅ Data pushed to Supabase in ${pushSecs}s`,
      finishedAt: new Date().toISOString(),
    });

    // Update CronJobState
    await (prisma as any).cronJobState.upsert({
      where: { jobKey: 'smarthub_sync' },
      update: { lastRunAt: new Date(), lastSuccessAt: new Date(), lastError: null },
      create: { jobKey: 'smarthub_sync', lastRunAt: new Date(), lastSuccessAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'SmartHub B2C sync completed.' });
  } catch (pushErr: any) {
    const stdout = pushErr.stdout ? pushErr.stdout.toString('utf8') : '';
    const stderr = pushErr.stderr ? pushErr.stderr.toString('utf8') : '';
    const errMsg = `❌ Push failed: ${pushErr.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
    console.error('[SmartHub Sync]', errMsg);

    await updateJob({
      status: 'error',
      message: 'Push to Supabase failed.',
      logEntry: `❌ Push failed: ${pushErr.message}. See error logs.`,
      lastError: errMsg,
      finishedAt: new Date().toISOString(),
    });

    await (prisma as any).cronJobState.upsert({
      where: { jobKey: 'smarthub_sync' },
      update: { lastRunAt: new Date(), lastError: errMsg },
      create: { jobKey: 'smarthub_sync', lastRunAt: new Date(), lastError: errMsg },
    });

    return NextResponse.json({ error: pushErr.message, stdout, stderr }, { status: 500 });
  }
}

/**
 * GET /api/cron/smarthub-sync
 * Returns the current job status (no auth required — public status poll)
 */
export async function GET() {
  try {
    const record = await (prisma as any).systemConfig.findUnique({
      where: { key: 'smarthub_job' },
    });
    const cronState = await (prisma as any).cronJobState.findUnique({
      where: { jobKey: 'smarthub_sync' },
    });

    let job = { status: 'idle', message: 'No sync has been run yet.', log: [] };
    if (record) {
      try { job = JSON.parse(record.value); } catch { /* ignore */ }
    }

    return NextResponse.json({ job, cronState });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
