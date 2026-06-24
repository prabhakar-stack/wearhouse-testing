import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');

interface SmartHubJob {
  status: 'idle' | 'session_captured' | 'running' | 'downloading' | 'pushing' | 'done' | 'error';
  message: string;
  sessionCapturedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  log: string[];
  lastError?: string;
}

/**
 * GET /api/admin/smarthub-session
 * Returns session health, job status, today's OTP, and the permanent bookmarklet.
 */
export async function GET(req: Request) {
  try {
    // ── 1. File session check ─────────────────────────────────────────────────
    let fileValid = false;
    let lastSaved: string | null = null;
    let ageDays: number | null = null;

    if (fs.existsSync(COOKIE_PATH)) {
      const stat = fs.statSync(COOKIE_PATH);
      lastSaved = stat.mtime.toISOString();
      ageDays = Math.round(((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;
      fileValid = ageDays < 6;
    }

    // ── 2. DB session check ───────────────────────────────────────────────────
    const dbSession = await (prisma as any).systemConfig.findUnique({ where: { key: 'smarthub_session' } });
    const dbSessionExists = !!dbSession;
    const dbSessionUpdatedAt = dbSession?.updatedAt?.toISOString() ?? null;

    // ── 3. Job status ─────────────────────────────────────────────────────────
    const jobRecord = await (prisma as any).systemConfig.findUnique({ where: { key: 'smarthub_job' } });
    let job: SmartHubJob = { status: 'idle', message: 'No sync job running.', log: [] };
    if (jobRecord) {
      try { job = JSON.parse(jobRecord.value); } catch { /* ignore */ }
    }

    // ── 4. Today's OTP ────────────────────────────────────────────────────────
    const otpRecord = await (prisma as any).systemConfig.findUnique({ where: { key: 'smarthub_daily_otp' } });
    let todayOtp: { otp: string; date: string; capturedAt: string } | null = null;
    if (otpRecord) {
      try {
        const parsed = JSON.parse(otpRecord.value);
        const today = new Date().toISOString().slice(0, 10);
        // Only show if captured today
        if (parsed.date === today) todayOtp = parsed;
      } catch { /* ignore */ }
    }

    // ── 5. Build permanent bookmarklet (uses SMARTHUB_CAPTURE_KEY) ────────────
    const captureKey = process.env.SMARTHUB_CAPTURE_KEY;

    // Always use the deployed HTTPS URL for the bookmarklet so it works from
    // smarthub.amazon.in (HTTPS) without mixed-content / CORS issues.
    // NEXT_PUBLIC_APP_URL must be set in Vercel/Render env vars.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (req.headers.get('x-forwarded-host')
        ? `https://${req.headers.get('x-forwarded-host')}`
        : new URL(req.url).origin);

    const importUrl = `${appUrl}/api/admin/smarthub-session/import`;

    let bookmarkletHref: string | null = null;
    let devToolsSnippet: string | null = null;

    if (captureKey) {
      // Bookmarklet: captures cookies, localStorage, sessionStorage, AND scrapes OTP from page
      const bookmarkletCode = `(function(){
        var KEY='${captureKey}';
        var URL='${importUrl}';
        var ls={};var ss={};
        try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);ls[k]=localStorage.getItem(k);}}catch(e){}
        try{for(var j=0;j<sessionStorage.length;j++){var k2=sessionStorage.key(j);ss[k2]=sessionStorage.getItem(k2);}}catch(e){}
        var otp=null;
        try{
          var bt=document.body.innerText||'';
          var m=bt.match(/OTP[:\\s]+([0-9]{4,8})/i);
          if(m)otp=m[1];
          if(!otp){var ps=document.querySelectorAll('p,span,div');for(var n=0;n<ps.length;n++){var t=(ps[n].innerText||'').trim();if(/^[0-9]{4,8}$/.test(t)&&ps[n].previousSibling){var prev=(ps[n].previousSibling.textContent||'').toLowerCase();if(prev.includes('otp')){otp=t;break;}}}}
        }catch(e){}
        var payload={cookies:document.cookie,localStorage:ls,sessionStorage:ss,otp:otp};
        fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','X-Capture-Key':KEY},body:JSON.stringify(payload),mode:'cors'})
          .then(function(r){return r.json();})
          .then(function(d){
            if(d.success){alert(d.message);}
            else{alert('Error: '+(d.error||'Unknown'));}
          })
          .catch(function(e){alert('Network error: '+e.message);});
      })()`;

      bookmarkletHref = `javascript:${encodeURIComponent(bookmarkletCode)}`;

      devToolsSnippet = `// SmartHub Daily Capture — paste in DevTools Console on smarthub.amazon.in
(async () => {
  const KEY = '${captureKey}';
  const URL = '${importUrl}';

  const ls = {}, ss = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage.getItem(k); }

  // Scrape OTP from page
  let otp = null;
  const m = (document.body.innerText || '').match(/OTP[:\\s]+([0-9]{4,8})/i);
  if (m) otp = m[1];

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Capture-Key': KEY },
    body: JSON.stringify({ cookies: document.cookie, localStorage: ls, sessionStorage: ss, otp }),
    mode: 'cors',
  });
  const data = await res.json();
  console.log(data);
  if (data.success) alert(data.message);
  else alert('Error: ' + data.error);
})();`;
    }

    return NextResponse.json({
      valid: fileValid,
      lastSaved,
      ageDays,
      dbSessionExists,
      dbSessionUpdatedAt,
      job,
      todayOtp,
      bookmarkletReady: !!captureKey,
      bookmarkletHref,
      devToolsSnippet,
      smarthubUrl: 'https://smarthub.amazon.in/returns',
      importUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ valid: false, lastSaved: null, error: err.message }, { status: 500 });
  }
}
