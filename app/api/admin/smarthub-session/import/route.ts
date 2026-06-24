import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');
const SMARTHUB_ORIGIN = 'https://smarthub.amazon.in';

// Allowed CORS origins for the bookmarklet running on smarthub.amazon.in
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Capture-Token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/admin/smarthub-session/import
 *
 * Called by the bookmarklet running on smarthub.amazon.in.
 * Receives browser session data (cookies, localStorage, sessionStorage),
 * converts it to a Playwright storageState, and persists it:
 *   1. To the filesystem (scripts/bot_state/smarthub_auth.json) for immediate use
 *   2. To the Supabase SystemConfig table (key: smarthub_session) for persistence
 *
 * Auth: X-Capture-Token header or ?token= query param (one-time token from DB)
 */
export async function POST(req: Request) {
  try {
    // ── 1. Validate one-time capture token ──────────────────────────────────
    const url = new URL(req.url);
    const token =
      req.headers.get('X-Capture-Token') ||
      url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing capture token' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Load one-time token from DB
    const tokenRecord = await (prisma as any).systemConfig.findUnique({
      where: { key: 'smarthub_capture_token' },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'No active capture session. Please start a new session from the dashboard.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let tokenData: { token: string; expiresAt: string; used: boolean } | null = null;
    try {
      tokenData = JSON.parse(tokenRecord.value);
    } catch {
      return NextResponse.json(
        { error: 'Invalid token record in database.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid token data in database.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (tokenData.used) {
      return NextResponse.json(
        { error: 'Token already used. Please start a new session.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Token expired. Please start a new session.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (tokenData.token !== token) {
      return NextResponse.json(
        { error: 'Invalid token.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      cookies: rawCookies = '',
      localStorage: ls = {},
      sessionStorage: ss = {},
      pageUrl = SMARTHUB_ORIGIN,
    } = body as {
      cookies?: string | any[];
      localStorage?: Record<string, string>;
      sessionStorage?: Record<string, string>;
      pageUrl?: string;
    };

    // ── 3. Build Playwright storageState JSON ────────────────────────────────
    let parsedCookies = [];

    if (typeof rawCookies === 'string') {
      // Parse "key=value; key2=value2" cookie string into Playwright cookie objects
      parsedCookies = rawCookies
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(pair => {
          const eqIdx = pair.indexOf('=');
          const name = eqIdx === -1 ? pair : pair.slice(0, eqIdx).trim();
          const value = eqIdx === -1 ? '' : pair.slice(eqIdx + 1).trim();
          return {
            name,
            value,
            domain: 'smarthub.amazon.in',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: 'None' as const,
          };
        })
        .filter(c => c.name.length > 0);
    } else if (Array.isArray(rawCookies)) {
      // Process structured cookies from Chrome extension
      parsedCookies = rawCookies.map(c => {
        // Map domain correctly
        let domain = c.domain || 'smarthub.amazon.in';
        if (domain.startsWith('.')) {
          // Playwright handles dot domains but we normalize to remove leading dot if needed, or keep it
        }

        // Map sameSite attribute to Playwright's acceptable strings: 'Lax' | 'Strict' | 'None'
        let sameSite: 'Lax' | 'Strict' | 'None' = 'None';
        if (c.sameSite === 'lax') sameSite = 'Lax';
        else if (c.sameSite === 'strict') sameSite = 'Strict';
        else if (c.sameSite === 'no_restriction') sameSite = 'None';

        return {
          name: c.name,
          value: c.value,
          domain,
          path: c.path || '/',
          expires: typeof c.expirationDate === 'number' ? Math.round(c.expirationDate) : -1,
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
          sameSite,
        };
      });
    }

    // Merge localStorage + sessionStorage for the origin
    const allLocalEntries = [
      ...Object.entries(ls).map(([name, value]) => ({ name, value: String(value) })),
      ...Object.entries(ss).map(([name, value]) => ({ name, value: String(value) })),
    ];

    const storageState = {
      cookies: parsedCookies,
      origins: [
        {
          origin: SMARTHUB_ORIGIN,
          localStorage: allLocalEntries,
        },
      ],
    };

    const storageStateJson = JSON.stringify(storageState, null, 2);

    // ── 4. Write to filesystem (for Render — immediate use) ──────────────────
    const dir = path.dirname(COOKIE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COOKIE_PATH, storageStateJson, 'utf8');

    // ── 5. Persist to Supabase SystemConfig ──────────────────────────────────
    // Stored as base64 to avoid escaping issues with long JSON strings
    const encoded = Buffer.from(storageStateJson).toString('base64');
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_session' },
      update: { value: encoded },
      create: { key: 'smarthub_session', value: encoded },
    });

    // ── 6. Mark token as used ────────────────────────────────────────────────
    if (tokenData) {
      await (prisma as any).systemConfig.update({
        where: { key: 'smarthub_capture_token' },
        data: { value: JSON.stringify({ ...tokenData, used: true }) },
      });
    }

    // ── 7. Update job status ─────────────────────────────────────────────────
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_job' },
      update: {
        value: JSON.stringify({
          status: 'session_captured',
          message: 'Session captured. Ready to sync.',
          sessionCapturedAt: new Date().toISOString(),
          log: ['✅ Session captured from browser/extension'],
        }),
      },
      create: {
        key: 'smarthub_job',
        value: JSON.stringify({
          status: 'session_captured',
          message: 'Session captured. Ready to sync.',
          sessionCapturedAt: new Date().toISOString(),
          log: ['✅ Session captured from browser/extension'],
        }),
      },
    });

    console.log('[SmartHub Import] Session captured and saved successfully.');
    return NextResponse.json(
      {
        success: true,
        message: 'Session captured! Return to the dashboard and click "Sync Now".',
        cookiesCount: parsedCookies.length,
        localStorageKeys: Object.keys(ls).length,
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
