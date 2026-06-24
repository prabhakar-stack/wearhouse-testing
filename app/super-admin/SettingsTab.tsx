'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Clock, CheckCircle, RefreshCw, AlertTriangle,
  BookOpen, Zap, CheckCircle2, Loader2, XCircle,
  ChevronRight, Download, Upload, Info, Settings, Package
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Settings sections registry — add new sections here, UI scales automatically
// ─────────────────────────────────────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  { id: 'hours',     label: 'Shift Timing',  icon: Clock,    description: 'Operational hours' },
  { id: 'smarthub', label: 'SmartHub B2C',   icon: Package,  description: 'Daily OTP & sync' },
] as const;

type SectionId = typeof SETTINGS_SECTIONS[number]['id'];

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-slate-100">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3>
      <p className="text-[11px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">{description}</p>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-all cursor-pointer active:scale-95"
    >
      {copied ? <CheckCircle2 size={10} className="text-green-600" /> : <Download size={10} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: Operational Shift Hours
// ─────────────────────────────────────────────────────────────────────────────
function ShiftHoursSection() {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime]     = useState('18:00');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [message, setMessage]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setStartTime(d.config.startTime || '09:00');
          setEndTime(d.config.endTime || '18:00');
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load configuration.' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings.');
      setMessage({ type: 'success', text: 'Operational hours updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 size={14} className="animate-spin text-[#FF6700]" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Operational Shift Timing" description="Define warehouse working hours for SLA calculations and alert suppression" />

      {message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success'
            ? <CheckCircle size={15} className="text-green-600 mt-0.5 shrink-0" />
            : <AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />}
          <p className="text-xs font-bold uppercase tracking-wider">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shift Start</label>
              <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shift End</label>
              <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Overnight Support</p>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide leading-relaxed">
              Shifts past midnight (e.g. 22:00 to 06:00) are auto-split at midnight by the alert processor.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button type="submit" disabled={saving}
            className="bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white px-5 py-2.5 text-xs uppercase tracking-widest font-black rounded shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: SmartHub B2C — Daily OTP capture + auto-sync
// ─────────────────────────────────────────────────────────────────────────────
function SmartHubSection() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDevTools, setShowDevTools] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // bookmarkletRef: set href directly on the DOM to bypass React's javascript: URL block
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  const pollRef        = useRef<NodeJS.Timeout | null>(null);
  const fetchStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const CRON_SECRET    = process.env.NEXT_PUBLIC_CRON_SECRET || 'secret-cron-token';

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/smarthub-session');
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
      setLoading(false);

      const schedule = (ms: number) => {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => fetchStatusRef.current(), ms);
      };

      const active: string[] = ['running', 'downloading', 'pushing', 'session_captured'];
      const terminal: string[] = ['done', 'error'];

      if (active.includes(data.job?.status)) schedule(2500);
      if (terminal.includes(data.job?.status)) setSyncing(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatusRef.current = fetchStatus; });

  // Set bookmarklet href directly on DOM — React blocks javascript: URLs via JSX
  useEffect(() => {
    if (bookmarkletRef.current && status?.bookmarkletHref) {
      bookmarkletRef.current.setAttribute('href', status.bookmarkletHref);
    }
  }, [status?.bookmarkletHref]);
  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    await fetch('/api/cron/smarthub-sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }).catch(() => {});
    fetchStatus();
  };

  const job = status?.job;
  const isActive = job && ['running', 'downloading', 'pushing'].includes(job.status);
  const todayOtp = status?.todayOtp;
  const today = new Date().toISOString().slice(0, 10);
  const otpCapturedToday = todayOtp?.date === today;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 size={14} className="animate-spin text-[#FF6700]" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Amazon SmartHub B2C — Daily Sync"
        description="Admin logs in daily → bookmarklet captures OTP + session → auto-syncs"
      />

      {/* ── Today's OTP — most important card ── */}
      <div className={`p-4 rounded-xl border ${otpCapturedToday ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {otpCapturedToday
              ? <CheckCircle size={18} className="text-green-600 shrink-0" />
              : <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            }
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${otpCapturedToday ? 'text-green-800' : 'text-amber-800'}`}>
                {otpCapturedToday ? "Today's OTP Captured" : "Today's OTP Not Yet Captured"}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${otpCapturedToday ? 'text-green-700' : 'text-amber-700'}`}>
                {otpCapturedToday
                  ? `Captured at ${new Date(todayOtp.capturedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                  : "Log in to SmartHub → click bookmarklet to capture today's OTP"}
              </p>
            </div>
          </div>
          {otpCapturedToday && (
            <span className="text-3xl font-black font-mono text-green-700 tracking-widest">{todayOtp.otp}</span>
          )}
        </div>
      </div>

      {/* ── Sync log ── */}
      {job && job.log && job.log.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4 font-mono">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Last Sync Log</p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {job.log.map((line: string, i: number) => (
              <p key={i} className={`text-[11px] leading-relaxed ${
                line.startsWith('✅') ? 'text-green-400' :
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⏳') ? 'text-amber-400' :
                line.startsWith('🔑') ? 'text-yellow-400' :
                'text-slate-300'
              }`}>{line}</p>
            ))}
            {isActive && <p className="text-[11px] text-amber-400 animate-pulse">⏳ {job.message}</p>}
          </div>
        </div>
      )}

      {/* ── Status banners ── */}
      {job?.status === 'done' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle size={14} className="text-green-600 shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest text-green-800">
            Sync complete{job.finishedAt ? ` · ${new Date(job.finishedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST` : ''}
          </p>
        </div>
      )}
      {job?.status === 'error' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-800">Sync Failed</p>
            <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mt-0.5">{job.lastError || job.message}</p>
          </div>
        </div>
      )}
      {isActive && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Loader2 size={14} className="text-amber-600 animate-spin shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest text-amber-800">{job.message}</p>
        </div>
      )}

      {/* ── Permanent bookmarklet card ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-700">Daily Capture Bookmarklet</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide">Set up once — works every day, no token needed</p>
          </div>
          {status?.bookmarkletReady
            ? <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-700"><CheckCircle2 size={11} className="text-green-600" /> Ready</span>
            : <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-600"><XCircle size={11} /> Key not set</span>
          }
        </div>

        {!status?.bookmarkletReady && (
          <div className="p-4 bg-red-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-800 mb-1">SMARTHUB_CAPTURE_KEY not configured</p>
            <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-2">
              Add SMARTHUB_CAPTURE_KEY to your .env and Render/Vercel dashboard. Generate one:
            </p>
            <code className="text-[10px] font-mono text-red-800 bg-red-100 px-2 py-1 rounded block">
              {'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'}
            </code>
          </div>
        )}

        {status?.bookmarkletReady && (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wide leading-relaxed">
                Log into SmartHub → go to Returns page → click this bookmarklet.
                It captures your session + today&apos;s OTP from the page, saves both, and triggers sync automatically.
              </p>
            </div>

            {/* Drag bookmarklet */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">
                Option A — Drag to bookmarks toolbar (one-time setup)
              </p>
              <a
                ref={bookmarkletRef}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-[#FF6700] text-[#FF6700] text-[11px] font-black uppercase tracking-widest rounded cursor-move hover:bg-orange-50 select-none transition-colors"
                onClick={e => e.preventDefault()}
                title="Drag to bookmarks bar — href set via DOM ref to bypass React security"
                draggable
              >
                <BookOpen size={13} />
                📌 SmartHub Daily Capture
              </a>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide mt-1.5">
                ↑ Drag once to toolbar. Click it every day after logging into SmartHub Returns page.
              </p>
            </div>

            {/* DevTools snippet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Option B — DevTools Console (F12)</p>
                <button onClick={() => setShowDevTools(!showDevTools)}
                  className="text-[9px] font-black uppercase tracking-widest text-[#FF6700] hover:underline cursor-pointer">
                  {showDevTools ? 'Hide' : 'Show Snippet'}
                </button>
              </div>
              {showDevTools && status.devToolsSnippet && (
                <div>
                  <div className="flex justify-end mb-1"><CopyButton text={status.devToolsSnippet} label="Copy Snippet" /></div>
                  <pre className="bg-slate-900 text-green-400 text-[9px] p-3 rounded font-mono overflow-x-auto max-h-36 leading-relaxed whitespace-pre-wrap">
                    {status.devToolsSnippet}
                  </pre>
                </div>
              )}
            </div>

            {/* Daily routine steps */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Daily Routine (2 min)</p>
              {[
                'Open SmartHub → Returns page → log in',
                'Click 📌 SmartHub Daily Capture in toolbar',
                'See "✅ Session + OTP captured" alert popup',
                'Done — sync runs automatically in background',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#FF6700]/10 text-[#FF6700] text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wide">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom actions ── */}
      <div className="flex items-center gap-4 pt-1">
        <button onClick={() => fetchStatus()}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer">
          <RefreshCw size={10} /> Refresh Status
        </button>
        {status?.dbSessionExists && !isActive && (
          <button onClick={triggerSync} disabled={syncing}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FF6700] hover:text-[#FF6700]/80 cursor-pointer disabled:opacity-50">
            {syncing ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
            {syncing ? 'Syncing...' : 'Manual Sync'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsTab — sidebar nav + independently scrollable content pane
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsTab() {
  const [activeSection, setActiveSection] = useState<SectionId>('hours');

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">

      {/* ── Left settings nav ── */}
      <nav className="w-56 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[#FF6700]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Settings</p>
          </div>
        </div>
        <div className="flex-1 p-2 space-y-0.5">
          {SETTINGS_SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all group ${
                  isActive ? 'bg-[#FF6700]/10 text-[#FF6700]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon size={13} className={isActive ? 'text-[#FF6700]' : 'text-slate-400 group-hover:text-slate-600'} />
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest truncate ${isActive ? 'text-[#FF6700]' : ''}`}>
                      {section.label}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide truncate">
                      {section.description}
                    </p>
                  </div>
                </div>
                {isActive && <ChevronRight size={11} className="text-[#FF6700] shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-200">
          <p className="text-[9px] text-slate-300 font-medium uppercase tracking-wide text-center">More settings coming soon</p>
        </div>
      </nav>

      {/* ── Right content pane — independently scrollable ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          {activeSection === 'hours'    && <ShiftHoursSection />}
          {activeSection === 'smarthub' && <SmartHubSection />}
        </div>
      </div>
    </div>
  );
}
