import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');

/**
 * GET /api/admin/smarthub-session
 * Returns whether the SmartHub Playwright session cookie file exists and is recent.
 * "Recent" = saved within the last 6 days (SmartHub sessions typically last ~7 days).
 */
export async function GET() {
  try {
    if (!fs.existsSync(COOKIE_PATH)) {
      return NextResponse.json({ valid: false, lastSaved: null });
    }

    const stat = fs.statSync(COOKIE_PATH);
    const lastSaved = stat.mtime.toISOString();

    // Consider the session stale if the cookie file is older than 6 days
    const ageDays = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
    const valid = ageDays < 6;

    return NextResponse.json({ valid, lastSaved, ageDays: Math.round(ageDays * 10) / 10 });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, lastSaved: null, error: err.message },
      { status: 500 }
    );
  }
}
