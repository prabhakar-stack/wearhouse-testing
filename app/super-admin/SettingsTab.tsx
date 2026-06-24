'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Clock, ShieldAlert, CheckCircle, RefreshCw, Wifi, WifiOff,
  AlertTriangle, ExternalLink, Copy, BookOpen, Zap, CheckCircle2,
  Loader2, XCircle, Database, Download, Upload, Info, Settings,
  Package, ChevronRight
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SmartHubJob {
  status: 'idle' | 'session_captured' | 'running' | 'downloading' | 'pushing' | 'done' | 'error';
  message: string;
  sessionCapturedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  log: string[];
  lastError?: string;
}

interface SessionStatus {
  valid: boolean;
  lastSaved: string | null;
  ageDays: number | null;
  dbSessionExists: boolean;
  dbSessionUpdatedAt: string | null;
  job: SmartHubJob;
  captureTokenActive: boolean;
  captureTokenExpiresAt: string | null;
  permanentSecretConfigured?: boolean;
  permanentSecret?: string | null;
}

interface CaptureSession {
  token: string;
  expiresAt: string;
  bookmarkletHref: string;
  devToolsSnippet: string;
  smarthubUrl: string;
  importUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings sections registry — add new sections here, UI scales automatically
// ─────────────────────────────────────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  { id: 'hours',     label: 'Shift Timing',   icon: Clock,    description: 'Operational hours' },
  { id: 'smarthub', label: 'SmartHub B2C',    icon: Package,  description: 'B2C auto-sync' },
  // Add more sections here as needed — they appear automatically in the sidebar
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

function JobStatusBadge({ status }: { status: SmartHubJob['status'] }) {
  const map: Record<SmartHubJob['status'], { label: string; cls: string; icon: React.ReactNode }> = {
    idle:             { label: 'Idle',               cls: 'bg-slate-100 text-slate-600 border-slate-200',     icon: <Clock size={10} /> },
    session_captured: { label: 'Session Ready',      cls: 'bg-blue-50 text-blue-700 border-blue-200',         icon: <CheckCircle2 size={10} /> },
    running:          { label: 'Running',             cls: 'bg-amber-50 text-amber-700 border-amber-200',      icon: <Loader2 size={10} className="animate-spin" /> },
    downloading:      { label: 'Downloading CSV',     cls: 'bg-amber-50 text-amber-700 border-amber-200',      icon: <Download size={10} className="animate-pulse" /> },
    pushing:          { label: 'Pushing to Supabase', cls: 'bg-violet-50 text-violet-700 border-violet-200',   icon: <Upload size={10} className="animate-pulse" /> },
    done:             { label: 'Sync Complete',       cls: 'bg-green-50 text-green-700 border-green-200',      icon: <CheckCircle size={10} /> },
    error:            { label: 'Error',               cls: 'bg-red-50 text-red-700 border-red-200',            icon: <XCircle size={10} /> },
  };
  const { label, cls, icon } = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${cls}`}>
      {icon}{label}
    </span>
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
      {copied ? <CheckCircle2 size={10} className="text-green-600" /> : <Copy size={10} />}
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
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success'
            ? <CheckCircle size={15} className="text-green-600 mt-0.5 shrink-0" />
            : <ShieldAlert size={15} className="text-red-600 mt-0.5 shrink-0" />}
          <p className="text-xs font-bold uppercase tracking-wider">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shift Start</label>
              <input
                type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Shift End</label>
              <input
                type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded"
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Overnight Support</p>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide leading-relaxed">
              Shifts past midnight (e.g. 22:00 to 06:00) are auto-split at midnight by the alert processor to prevent drift.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="submit" disabled={saving}
            className="bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white px-5 py-2.5 text-xs uppercase tracking-widest font-black rounded shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: SmartHub B2C Auto-Sync
// ─────────────────────────────────────────────────────────────────────────────
function SmartHubSection() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [startingCapture, setStartingCapture] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  const pollRef       = useRef<NodeJS.Timeout | null>(null);
  const fetchStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const CRON_SECRET   = process.env.NEXT_PUBLIC_CRON_SECRET || 'secret-cron-token';

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/smarthub-session');
      if (!res.ok) return;
      const data = await res.json();
      setSessionStatus(data);
      setLoading(false);

      const schedule = (ms: number) => {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => fetchStatusRef.current(), ms);
      };

      const activeStatuses: SmartHubJob['status'][] = ['running', 'downloading', 'pushing'];
      const terminalStatuses: SmartHubJob['status'][] = ['done', 'error'];

      if (activeStatuses.includes(data.job?.status)) {
        schedule(2500);
      } else if (data.captureTokenActive && data.job?.status === 'idle') {
        schedule(3000);
      } else if (data.job?.status === 'session_captured') {
        schedule(3000);
      }

      if (terminalStatuses.includes(data.job?.status)) {
        setSyncing(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatusRef.current = fetchStatus; });
  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncing) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => fetchStatusRef.current(), 2500);
  }, [syncing]);

  const startCapture = async () => {
    setStartingCapture(true);
    try {
      const res = await fetch('/api/admin/smarthub-session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start capture session');
      setCaptureSession(data);
      fetchStatus();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setStartingCapture(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/cron/smarthub-sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      fetchStatus();
    } catch (err: any) {
      alert(`Error triggering sync: ${err.message}`);
      setSyncing(false);
    }
  };

  const job              = sessionStatus?.job;
  const isActiveJob      = job && ['running', 'downloading', 'pushing'].includes(job.status);
  const sessionCaptured  = job?.status === 'session_captured';
  const syncDone         = job?.status === 'done';
  const syncError        = job?.status === 'error';
  const hasDbSession     = sessionStatus?.dbSessionExists;
  const captureTokenActive = sessionStatus?.captureTokenActive;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 size={14} className="animate-spin text-[#FF6700]" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading B2C Status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Amazon SmartHub B2C — Auto Sync"
        description="One-click session capture + headless CSV download + Supabase push"
      />

      {/* Session health strip */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2">
          {sessionStatus?.valid
            ? <><Wifi size={13} className="text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-green-700">File Session Active</span></>
            : hasDbSession
            ? <><Database size={13} className="text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-amber-700">DB Session Available</span></>
            : <><WifiOff size={13} className="text-red-400" /><span className="text-[10px] font-black uppercase tracking-widest text-red-600">No Session</span></>
          }
          {job && <JobStatusBadge status={job.status} />}
        </div>
        {sessionStatus?.dbSessionUpdatedAt && (
          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">
            Last capture: {new Date(sessionStatus.dbSessionUpdatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Live job log */}
      {job && job.log && job.log.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4 font-mono">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Sync Log</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {job.log.map((line, i) => (
              <p key={i} className={`text-[11px] leading-relaxed ${
                line.startsWith('✅') ? 'text-green-400' :
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⏳') ? 'text-amber-400' : 'text-slate-300'
              }`}>{line}</p>
            ))}
            {isActiveJob && (
              <p className="text-[11px] text-amber-400 animate-pulse">⏳ {job.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Success / Error banners */}
      {syncDone && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-green-800">Sync Complete</p>
            <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mt-0.5">
              Data pushed to Supabase.{job?.finishedAt && ` Finished at ${new Date(job.finishedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`}
            </p>
          </div>
        </div>
      )}
      {syncError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-800">Sync Failed</p>
            <p className="text-[10px] text-red-700 font-bold uppercase tracking-wide mt-0.5">{job?.lastError || job?.message}</p>
          </div>
        </div>
      )}

      {/* Active sync progress */}
      {isActiveJob && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Loader2 size={14} className="text-amber-600 shrink-0 animate-spin" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-800">{job?.message}</p>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide mt-0.5">Polling for updates...</p>
          </div>
        </div>
      )}

      {/* Action area */}
      {!isActiveJob && (
        <div className="space-y-4">

          {/* Quick Sync if session exists */}
          {hasDbSession && !captureSession && !sessionCaptured && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 mb-3">Session Ready — Sync or Refresh</p>
              <div className="flex gap-2">
                <button onClick={triggerSync} disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm transition-all cursor-pointer active:scale-95">
                  {syncing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  {syncing ? 'Starting...' : 'Sync Now'}
                </button>
                <button onClick={startCapture} disabled={startingCapture}
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-50 transition-all cursor-pointer active:scale-95">
                  {startingCapture ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Refresh Session
                </button>
              </div>
            </div>
          )}

          {/* Session just captured */}
          {sessionCaptured && !captureSession && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-3">Session Captured! Ready to Sync.</p>
              <button onClick={triggerSync} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm transition-all cursor-pointer active:scale-95">
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {syncing ? 'Starting Sync...' : 'Start Sync Now'}
              </button>
            </div>
          )}

          {/* No session */}
          {!hasDbSession && !captureSession && !sessionCaptured && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-amber-800">No Session Found</p>
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide mt-0.5">
                    Capture a SmartHub session to enable B2C auto-sync.
                  </p>
                </div>
              </div>
              <button onClick={startCapture} disabled={startingCapture}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm transition-all cursor-pointer active:scale-95">
                {startingCapture ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {startingCapture ? 'Generating...' : 'Capture Session'}
              </button>
            </div>
          )}

          {/* Guided capture flow */}
          {captureSession && !sessionCaptured && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">3-Step Session Capture</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium uppercase tracking-wide">
                  Token valid for 10 minutes{captureSession.expiresAt ? ` · expires ${new Date(captureSession.expiresAt).toLocaleTimeString('en-IN')}` : ''}
                </p>
              </div>
              <div className="p-5 space-y-5">

                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FF6700] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 mb-1">Open SmartHub & Log In</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-2">
                      Open SmartHub in a new tab and complete login (password + OTP).
                    </p>
                    <a href={captureSession.smarthubUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded transition-all">
                      <ExternalLink size={11} /> Open Amazon SmartHub
                    </a>
                  </div>
                </div>

                <div className="border-l-2 border-dashed border-slate-200 ml-3 h-3" />

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FF6700] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 mb-1">Run Capture Script</p>

                    {/* Bookmarklet */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Option A — Bookmarklet</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-2">
                        Drag to bookmarks bar → click it on the SmartHub page after login.
                      </p>
                      <a href={captureSession.bookmarkletHref}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-dashed border-[#FF6700] text-[#FF6700] text-[10px] font-black uppercase tracking-widest rounded cursor-move hover:bg-orange-50 select-none"
                        onClick={e => e.preventDefault()} title="Drag to bookmarks bar" draggable>
                        <BookOpen size={11} /> 📌 SmartHub Capture
                      </a>
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide mt-1">↑ Drag to toolbar, then click on SmartHub page</p>
                    </div>

                    {/* DevTools */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Option B — DevTools Console</p>
                        <button onClick={() => setShowDevTools(!showDevTools)}
                          className="text-[9px] font-black uppercase tracking-widest text-[#FF6700] hover:underline cursor-pointer">
                          {showDevTools ? 'Hide' : 'Show Snippet'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">F12 → Console → paste → Enter</p>
                      {showDevTools && (
                        <div className="mt-3">
                          <div className="flex justify-end mb-1"><CopyButton text={captureSession.devToolsSnippet} label="Copy Snippet" /></div>
                          <pre className="bg-slate-900 text-green-400 text-[9px] p-3 rounded font-mono overflow-x-auto max-h-40 leading-relaxed">
                            {captureSession.devToolsSnippet}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-l-2 border-dashed border-slate-200 ml-3 h-3" />

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${captureTokenActive ? 'bg-slate-200 text-slate-500' : 'bg-green-500 text-white'}`}>
                    {captureTokenActive ? '3' : <CheckCircle2 size={13} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 mb-1">
                      {captureTokenActive ? 'Waiting for capture...' : 'Captured ✅'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                      {captureTokenActive
                        ? 'This updates automatically after you run the script.'
                        : 'Session captured! Click Sync Now.'}
                    </p>
                    {captureTokenActive && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 size={10} className="animate-spin text-[#FF6700]" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Polling...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
                <button onClick={() => setCaptureSession(null)}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
                {!captureTokenActive && (
                  <button onClick={triggerSync} disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm transition-all cursor-pointer active:scale-95">
                    {syncing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {syncing ? 'Starting...' : 'Sync Now'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chrome Extension Auto Sync Info Card */}
          {sessionStatus?.permanentSecretConfigured ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-[#FF6700]" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-700">🚀 Chrome Extension Capture (Automatic)</p>
                </div>
                <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Active</span>
              </div>
              
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                A custom Chrome Extension has been created inside your project directory at <code className="bg-slate-100 text-[#FF6700] px-1 rounded font-mono lowercase">scripts/smarthub-extension/</code>.
                Install it in Chrome to automatically capture the session in the background when you visit SmartHub!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Server URL</label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2.5 py-1.5 justify-between">
                    <code className="text-[10px] font-mono text-slate-700 truncate select-all">{typeof window !== 'undefined' ? window.location.origin : ''}</code>
                    <CopyButton text={typeof window !== 'undefined' ? window.location.origin : ''} label="Copy" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Secret Key</label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2.5 py-1.5 justify-between">
                    <code className="text-[10px] font-mono text-slate-700 truncate select-all">{sessionStatus?.permanentSecret || '••••••••••••••••'}</code>
                    <CopyButton text={sessionStatus?.permanentSecret || ''} label="Copy" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Installation Steps:</p>
                <ol className="list-decimal pl-4 text-[9px] text-slate-500 font-bold uppercase tracking-wide space-y-1.5">
                  <li>Open Chrome and navigate to <code className="bg-slate-50 px-1 rounded font-mono text-slate-700 lowercase">chrome://extensions/</code></li>
                  <li>Enable <b>Developer mode</b> using the toggle in the top-right corner.</li>
                  <li>Click <b>Load unpacked</b> in the top-left and select the <code className="bg-slate-50 px-1 rounded font-mono text-slate-700 lowercase">scripts/smarthub-extension</code> folder in your project directory.</li>
                  <li>Click the Extension icon on your Chrome toolbar, paste the <b>Server URL</b> and <b>Secret Key</b> above, and click <b>Save Config</b>.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">🚀 Chrome Extension Capture (Automatic)</p>
                </div>
                <span className="bg-slate-100 border border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Not Configured</span>
              </div>
              
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                You can automatically capture session cookies (including secure <code className="bg-slate-100 px-1 rounded font-mono text-slate-600 lowercase">HttpOnly</code> cookies) silently in the background using a custom Chrome extension.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">Setup Required:</p>
                <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wide leading-relaxed">
                  Set the <code className="bg-white px-1 rounded font-mono text-slate-700 lowercase">SMARTHUB_PERMANENT_SECRET</code> environment variable in your Render backend settings. Once set, refresh this page to access your Chrome extension files and key.
                </p>
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div className="flex items-center gap-4 pt-1">
            <button onClick={() => fetchStatus()}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <RefreshCw size={10} /> Re-check Status
            </button>
            {(syncDone || syncError) && hasDbSession && (
              <button onClick={triggerSync} disabled={syncing}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FF6700] hover:text-[#FF6700]/80 cursor-pointer transition-colors disabled:opacity-50">
                <Zap size={10} /> {syncing ? 'Syncing...' : 'Sync Again'}
              </button>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <Info size={11} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide leading-relaxed">
              SmartHub sessions last ~7 days. Re-capture weekly. Sessions are stored securely in Supabase SystemConfig.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsTab — sidebar nav + scrollable content pane
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsTab() {
  const [activeSection, setActiveSection] = useState<SectionId>('hours');

  return (
    // Full-height flex layout. The parent (<main>) already has overflow-hidden,
    // so we explicitly fill it and handle scroll ourselves here.
    <div className="flex h-full w-full overflow-hidden bg-white">

      {/* ── Left settings nav ─────────────────────────────────────────────── */}
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
                  isActive
                    ? 'bg-[#FF6700]/10 text-[#FF6700]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
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
        {/* Future sections hint */}
        <div className="p-4 border-t border-slate-200">
          <p className="text-[9px] text-slate-300 font-medium uppercase tracking-wide text-center">
            More settings coming soon
          </p>
        </div>
      </nav>

      {/* ── Right content pane — independently scrollable ─────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          {activeSection === 'hours'     && <ShiftHoursSection />}
          {activeSection === 'smarthub' && <SmartHubSection />}
        </div>
      </div>
    </div>
  );
}
