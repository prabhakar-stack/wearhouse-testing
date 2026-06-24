import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmartHubJob {
  status: 'idle' | 'session_captured' | 'running' | 'downloading' | 'pushing' | 'done' | 'error';
  message: string;
  sessionCapturedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  log: string[];
  recordsUpserted?: number;
  lastError?: string;
}

/**
 * GET /api/admin/smarthub-session
 *
 * Returns:
 * - Session file status (exists + age)
 * - Current sync job status (from SystemConfig)
 * - Capture token availability
 */
export async function GET() {
  try {
    // ── 1. File-based session check ──────────────────────────────────────────
    let fileValid = false;
    let lastSaved: string | null = null;
    let ageDays: number | null = null;

    if (fs.existsSync(COOKIE_PATH)) {
      const stat = fs.statSync(COOKIE_PATH);
      lastSaved = stat.mtime.toISOString();
      ageDays = Math.round(((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;
      fileValid = ageDays < 6;
    }

    // ── 2. DB session check ──────────────────────────────────────────────────
    const dbSession = await (prisma as any).systemConfig.findUnique({
      where: { key: 'smarthub_session' },
    });
    const dbSessionExists = !!dbSession;
    const dbSessionUpdatedAt = dbSession?.updatedAt?.toISOString() ?? null;

    // ── 3. Job status ────────────────────────────────────────────────────────
    const jobRecord = await (prisma as any).systemConfig.findUnique({
      where: { key: 'smarthub_job' },
    });

    let job: SmartHubJob = {
      status: 'idle',
      message: 'No sync job running.',
      log: [],
    };

    if (jobRecord) {
      try {
        job = JSON.parse(jobRecord.value);
      } catch {
        // ignore parse error
      }
    }

    // ── 4. Capture token status ──────────────────────────────────────────────
    const tokenRecord = await (prisma as any).systemConfig.findUnique({
      where: { key: 'smarthub_capture_token' },
    });

    let captureTokenActive = false;
    let captureTokenExpiresAt: string | null = null;

    if (tokenRecord) {
      try {
        const t = JSON.parse(tokenRecord.value);
        captureTokenActive = !t.used && new Date(t.expiresAt) > new Date();
        captureTokenExpiresAt = t.expiresAt;
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      // File session
      valid: fileValid,
      lastSaved,
      ageDays,
      // DB session
      dbSessionExists,
      dbSessionUpdatedAt,
      // Job
      job,
      // Token
      captureTokenActive,
      captureTokenExpiresAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, lastSaved: null, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/smarthub-session
 *
 * Generates a one-time capture token (10 min TTL) and returns:
 * - The token
 * - A bookmarklet href (javascript: URI)
 * - A DevTools console snippet
 *
 * Both the bookmarklet and the snippet POST to /api/admin/smarthub-session/import
 * with the token embedded for auth.
 */
export async function POST(req: Request) {
  try {
    // Verify SUPER_ACCESS role from middleware-injected header
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'SUPER_ACCESS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate a cryptographically random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Save to DB
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_capture_token' },
      update: { value: JSON.stringify({ token, expiresAt, used: false }) },
      create: { key: 'smarthub_capture_token', value: JSON.stringify({ token, expiresAt, used: false }) },
    });

    // Reset job status
    await (prisma as any).systemConfig.upsert({
      where: { key: 'smarthub_job' },
      update: { value: JSON.stringify({ status: 'idle', message: 'Session capture started. Waiting for browser data.', log: [] }) },
      create: { key: 'smarthub_job', value: JSON.stringify({ status: 'idle', message: 'Session capture started. Waiting for browser data.', log: [] }) },
    });

    // Build the import API URL (use the same origin as the request)
    const origin = req.headers.get('x-forwarded-host')
      ? `https://${req.headers.get('x-forwarded-host')}`
      : new URL(req.url).origin;

    const importUrl = `${origin}/api/admin/smarthub-session/import`;

    // ── Build bookmarklet (minified JS that runs on smarthub.amazon.in) ──────
    const bookmarkletCode = `(function(){
      var t='${token}';
      var u='${importUrl}';
      var ls={};var ss={};
      try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);ls[k]=localStorage.getItem(k);}}catch(e){}
      try{for(var j=0;j<sessionStorage.length;j++){var k2=sessionStorage.key(j);ss[k2]=sessionStorage.getItem(k2);}}catch(e){}
      var payload={cookies:document.cookie,localStorage:ls,sessionStorage:ss,pageUrl:location.href};
      fetch(u,{method:'POST',headers:{'Content-Type':'application/json','X-Capture-Token':t},body:JSON.stringify(payload),mode:'cors'})
        .then(function(r){return r.json();})
        .then(function(d){
          if(d.success){alert('✅ SmartHub session captured! Return to the dashboard and click "Sync Now".');}
          else{alert('❌ Error: '+(d.error||'Unknown error'));}
        })
        .catch(function(e){alert('❌ Network error: '+e.message);});
    })()`;

    const bookmarkletHref = `javascript:${encodeURIComponent(bookmarkletCode)}`;

    // ── DevTools console snippet (prettier, for pasting in F12 console) ──────
    const devToolsSnippet = `// SmartHub Session Capture — paste this in DevTools console on smarthub.amazon.in
(async () => {
  const TOKEN = '${token}';
  const IMPORT_URL = '${importUrl}';
  
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    ls[k] = localStorage.getItem(k);
  }
  const ss = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    ss[k] = sessionStorage.getItem(k);
  }

  const res = await fetch(IMPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Capture-Token': TOKEN },
    body: JSON.stringify({ cookies: document.cookie, localStorage: ls, sessionStorage: ss, pageUrl: location.href }),
    mode: 'cors',
  });
  const data = await res.json();
  console.log(data.success ? '✅ Session captured!' : '❌ Error: ' + data.error);
  if (data.success) alert('✅ Session captured! Return to the dashboard.');
})();`;

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      importUrl,
      bookmarkletHref,
      devToolsSnippet,
      smarthubUrl: 'https://smarthub.amazon.in/returns',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
