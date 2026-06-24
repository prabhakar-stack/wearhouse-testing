import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');
const SMARTHUB_ORIGIN = 'https://smarthub.amazon.in';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Capture-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/admin/smarthub-session/import
 *
 * Called by the bookmarklet running on smarthub.amazon.in.
 *
 * Auth: X-Capture-Key header or ?key= query param
 *   — Validated against SMARTHUB_CAPTURE_KEY env var (persistent, never changes)
 *   — The bookmarklet is set up ONCE from the Settings page and works every day.
 *
 * On success:
 *   1. Saves Playwright storageState to filesystem + SystemConfig DB
 *   2. Saves the day's OTP (if found on page) to SystemConfig
 *   3. Auto-triggers /api/cron/smarthub-sync so sync happens immediately
 */
export async function POST(req: Request) {
  try {
    // ── 1. Persistent key auth ────────────────────────────────────────────────
    const url = new URL(req.url);
    const providedKey =
      req.headers.get('X-Capture-Key') ||
      url.searchParams.get('key');

    const expectedKey = process.env.SMARTHUB_CAPTURE_KEY;

    if (!expectedKey) {
      console.error('[SmartHub Import] SMARTHUB_CAPTURE_KEY env var not set.');
      return NextResponse.json(
        { error: 'Server misconfigured: SMARTHUB_CAPTURE_KEY not set.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (!providedKey || providedKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid capture key.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      cookies: cookieString = '',
      localStorage: ls = {},
      sessionStorage: ss = {},
      otp: otpFromBookmarklet = null,
    } = body as {
      cookies?: string;
      localStorage?: Record<string, string>;
      sessionStorage?: Record<string, string>;
      otp?: string | null;
    };

    // ── 3. Build Playwright storageState ──────────────────────────────────────
    const parsedCookies = cookieString
      .split(';')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((pair: string) => {
        const eqIdx = pair.indexOf('=');
        const name = eqIdx === -1 ? pair : pair.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : pair.slice(eqIdx + 1).trim();
        return {
          name, value,
          domain: 'smarthub.amazon.in',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'None' as const,
        };
      })
      .filter((c: any) => c.name.length > 0);

    const allLocalEntries = [
      ...Object.entries(ls).map(([name, value]) => ({ name, value: String(value) })),
      ...Object.entries(ss).map(([name, value]) => ({ name, value: String(value) })),
    ];

    const storageState = {
      cookies: parsedCookies,
      origins: [{ origin: SMARTHUB_ORIGIN, localStorage: allLocalEntries }],
    };

    const storageStateJson = JSON.stringify(storageState, null, 2);
    const encoded = Buffer.from(storageStateJson).toString('base64');

    // ── 4. Write to filesystem (only if not on Vercel) ─────────────────────────
    const isVercel = process.env.VERCEL === '1';
    if (!isVercel) {
      try {
        const dir = path.dirname(COOKIE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COOKIE_PATH, storageStateJson, 'utf8');
      } catch (err: any) {
        console.warn(`[SmartHub Import] Failed to write cookie path to filesystem (non-fatal): ${err.message}`);
      }
    }

    // ── 5. Persist session to SystemConfig ────────────────────────────────────
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_session' },
      update: { value: encoded },
      create: { key: 'smarthub_session', value: encoded },
    });

    // ── 6. Save today's OTP if captured ──────────────────────────────────────
    let otpSaved = false;
    if (otpFromBookmarklet && /^\d{4,8}$/.test(otpFromBookmarklet.trim())) {
      const otp = otpFromBookmarklet.trim();
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Also write to uploads/latest_otp.json for the push script (only if not on Vercel)
      if (!isVercel) {
        try {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          fs.writeFileSync(
            path.join(uploadsDir, 'latest_otp.json'),
            JSON.stringify({ otp, timestamp: new Date().toISOString(), date: today }, null, 2),
            'utf8'
          );
        } catch (err: any) {
          console.warn(`[SmartHub Import] Failed to write OTP to filesystem (non-fatal): ${err.message}`);
        }
      }

      // Also store in SystemConfig for visibility in the UI
      await (prisma as any).systemConfig.upsert({
        where: { key: 'smarthub_daily_otp' },
        update: { value: JSON.stringify({ otp, date: today, capturedAt: new Date().toISOString() }) },
        create: { key: 'smarthub_daily_otp', value: JSON.stringify({ otp, date: today, capturedAt: new Date().toISOString() }) },
      });

      otpSaved = true;
      console.log(`[SmartHub Import] OTP captured: ${otp} for ${today}`);
    }

    // ── 7. Update job status ──────────────────────────────────────────────────
    const capturedAt = new Date().toISOString();
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_job' },
      update: {
        value: JSON.stringify({
          status: 'session_captured',
          message: 'Session captured from browser. Auto-syncing...',
          sessionCapturedAt: capturedAt,
          log: [
            `✅ Session captured at ${new Date(capturedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
            otpSaved ? `🔑 OTP captured from page` : '⚠️ OTP not found on page',
            '⏳ Triggering sync...',
          ],
        }),
      },
      create: {
        key: 'smarthub_job',
        value: JSON.stringify({
          status: 'session_captured',
          message: 'Session captured from browser. Auto-syncing...',
          sessionCapturedAt: capturedAt,
          log: [`✅ Session captured`, otpSaved ? '🔑 OTP captured' : '⚠️ OTP not found'],
        }),
      },
    });

    // ── 8. Auto-trigger sync in background ───────────────────────────────────
    // Fire-and-forget: don't await — return success to the bookmarklet immediately
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (req.headers.get('x-forwarded-host')
        ? `https://${req.headers.get('x-forwarded-host')}`
        : new URL(req.url).origin);
    const cronSecret = process.env.CRON_SECRET || 'secret-cron-token';

    fetch(`${appUrl}/api/cron/smarthub-sync`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    }).catch(err => console.error('[SmartHub Import] Auto-sync trigger failed:', err.message));

    console.log('[SmartHub Import] Session saved. Auto-sync triggered.');

    return NextResponse.json(
      {
        success: true,
        message: otpSaved
          ? `✅ Session + OTP captured! Sync triggered automatically.`
          : `✅ Session captured! Sync triggered. (OTP not found on this page — try visiting the returns page first)`,
        cookiesCount: parsedCookies.length,
        localStorageKeys: Object.keys(ls).length,
        otpCaptured: otpSaved,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[SmartHub Import] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
