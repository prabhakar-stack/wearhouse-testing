"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users, RefreshCw, CheckCircle2, Clock, AlertCircle,
  Loader2, Radio, ShieldCheck, ChevronDown, ChevronUp,
  FileImage, FileVideo, WifiOff, Package,
} from "lucide-react";

interface Inspector {
  id: string;
  name: string | null;
  email: string;
}

interface CommandStatus {
  commandId: string | null;
  phase: "idle" | "sending" | "pending" | "acknowledged" | "done" | "expired" | "error";
  note?: string;
  sentAt?: number;
}

// Metadata of a single file in the snapshot (no blob)
interface SnapshotFile {
  id: string;
  name: string;
  mimeType: string;
  sizeMb: number;
  status: "failed" | "uploading";
  error?: string;
  lpn?: string;
}

// Metadata of a grouped order in the snapshot
interface SnapshotGroup {
  orderId: string;
  type: "RECEIVER_REJECTION" | "INSPECTION_VIDEO";
  status: string;
  error?: string;
  files: SnapshotFile[];
}

interface Snapshot {
  uploads: SnapshotGroup[];
  updatedAt: string;
}

export default function RemoteRetryPanel() {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  // Map: inspectorId → CommandStatus
  const [statuses, setStatuses] = useState<Record<string, CommandStatus>>({});
  // Map: inspectorId → expanded state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Map: inspectorId → Snapshot | null | "loading"
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot | null | "loading">>({});
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const userId   = typeof localStorage !== "undefined" ? localStorage.getItem("userId")   || "" : "";
  const userRole = typeof localStorage !== "undefined" ? localStorage.getItem("userRole") || "" : "";

  // ── Load inspectors ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/users", {
      headers: { "x-user-id": userId, "x-user-role": userRole },
    })
      .then(r => r.json())
      .then(data => {
        const list: Inspector[] = (data.users || []).filter(
          (u: any) => u.role === "INSPECTOR"
        );
        setInspectors(list);
        const init: Record<string, CommandStatus> = {};
        list.forEach(i => { init[i.id] = { commandId: null, phase: "idle" }; });
        setStatuses(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch snapshot for an inspector ──────────────────────────────────────
  const fetchSnapshot = async (inspectorId: string) => {
    setSnapshots(prev => ({ ...prev, [inspectorId]: "loading" }));
    try {
      const res = await fetch(
        `/api/admin/pending-uploads-snapshot?inspectorId=${inspectorId}`,
        { headers: { "x-user-id": userId, "x-user-role": userRole } }
      );
      const data = await res.json();
      setSnapshots(prev => ({ ...prev, [inspectorId]: data.snapshot || null }));
    } catch {
      setSnapshots(prev => ({ ...prev, [inspectorId]: null }));
    }
  };

  // ── Toggle expand — fetch snapshot on open ────────────────────────────────
  const toggleExpand = (inspectorId: string) => {
    const nowOpen = !expanded[inspectorId];
    setExpanded(prev => ({ ...prev, [inspectorId]: nowOpen }));
    if (nowOpen) fetchSnapshot(inspectorId);
  };

  // ── Poll command status for all active (non-idle/done) commands ───────────
  useEffect(() => {
    const poll = async () => {
      const activeIds = Object.entries(statuses)
        .filter(([, s]) => s.phase === "pending" || s.phase === "acknowledged")
        .map(([id]) => id);

      for (const inspectorId of activeIds) {
        try {
          const res = await fetch(
            `/api/admin/upload-retry-command?inspectorId=${inspectorId}`,
            { headers: { "x-user-id": userId, "x-user-role": userRole } }
          );
          if (!res.ok) continue;
          const { command } = await res.json();
          if (!command) continue;

          setStatuses(prev => {
            const current = prev[inspectorId];
            if (!current || current.commandId !== command.id) return prev;

            if (command.status === "EXPIRED" || new Date(command.expiresAt) < new Date()) {
              return { ...prev, [inspectorId]: { ...current, phase: "expired" } };
            }
            const newPhase =
              command.status === "DONE"         ? "done"         :
              command.status === "ACKNOWLEDGED" ? "acknowledged" :
              "pending";

            // If done, refresh snapshot to see cleared state
            if (newPhase === "done") {
              setTimeout(() => fetchSnapshot(inspectorId), 3000);
            }
            return { ...prev, [inspectorId]: { ...current, phase: newPhase } };
          });
        } catch { /* silent */ }
      }
    };

    if (!pollRef.current) {
      pollRef.current = setInterval(poll, 4000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // ── Issue retry command ───────────────────────────────────────────────────
  const triggerRetry = async (inspector: Inspector) => {
    setStatuses(prev => ({
      ...prev,
      [inspector.id]: { commandId: null, phase: "sending" },
    }));

    try {
      const res = await fetch("/api/admin/upload-retry-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-user-role": userRole,
        },
        body: JSON.stringify({ inspectorId: inspector.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const { commandId } = await res.json();
      setStatuses(prev => ({
        ...prev,
        [inspector.id]: { commandId, phase: "pending", sentAt: Date.now() },
      }));
    } catch (e: any) {
      setStatuses(prev => ({
        ...prev,
        [inspector.id]: { commandId: null, phase: "error", note: e.message },
      }));
    }
  };

  const reset = (inspectorId: string) => {
    setStatuses(prev => ({ ...prev, [inspectorId]: { commandId: null, phase: "idle" } }));
  };

  // ── Phase chip ─────────────────────────────────────────────────────────────
  const PhaseChip = ({ phase, note }: { phase: CommandStatus["phase"]; note?: string }) => {
    const map: Record<CommandStatus["phase"], { label: string; cls: string; icon: React.ReactNode }> = {
      idle:         { label: "Ready",        cls: "bg-slate-100 text-slate-500",         icon: <Radio size={10} /> },
      sending:      { label: "Sending…",     cls: "bg-blue-50 text-blue-600",            icon: <Loader2 size={10} className="animate-spin" /> },
      pending:      { label: "Waiting…",     cls: "bg-amber-50 text-amber-700",          icon: <Clock size={10} /> },
      acknowledged: { label: "Received ✓",   cls: "bg-indigo-50 text-indigo-700",        icon: <CheckCircle2 size={10} /> },
      done:         { label: "Done ✓",       cls: "bg-emerald-50 text-emerald-700",      icon: <CheckCircle2 size={10} /> },
      expired:      { label: "Timed Out",    cls: "bg-red-50 text-red-600",              icon: <AlertCircle size={10} /> },
      error:        { label: "Error",        cls: "bg-red-50 text-red-600",              icon: <AlertCircle size={10} /> },
    };
    const m = map[phase];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.cls}`}>
        {m.icon} {m.label}
        {note && phase === "error" && <span className="ml-1 opacity-70 truncate max-w-[120px]">{note}</span>}
      </span>
    );
  };

  // ── Time ago helper ────────────────────────────────────────────────────────
  const timeAgo = (isoString: string) => {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950 to-slate-900 px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#FF6700]/20 border border-[#FF6700]/30 flex items-center justify-center">
          <RefreshCw size={15} className="text-[#FF6700]" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm">Remote Upload Retry</h3>
          <p className="text-slate-400 text-[10px] mt-0.5">
            View failed uploads per inspector and trigger retry remotely
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {loading && (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading inspectors…
          </div>
        )}

        {!loading && inspectors.length === 0 && (
          <div className="py-8 text-center text-slate-400">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No inspector accounts found</p>
          </div>
        )}

        {inspectors.map(inspector => {
          const s = statuses[inspector.id] ?? { commandId: null, phase: "idle" };
          const isBusy = s.phase === "sending" || s.phase === "pending" || s.phase === "acknowledged";
          const isFinished = s.phase === "done" || s.phase === "expired" || s.phase === "error";
          const isExpanded = !!expanded[inspector.id];
          const snap = snapshots[inspector.id];
          const hasUploads = snap && snap !== "loading" && (snap as Snapshot).uploads?.length > 0;

          return (
            <div key={inspector.id} className="flex flex-col">
              {/* Inspector header row */}
              <div className="flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors">
                {/* Expand toggle + inspector info */}
                <button
                  onClick={() => toggleExpand(inspector.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <ShieldCheck size={12} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{inspector.name || inspector.email}</p>
                    {inspector.name && (
                      <p className="text-[10px] text-slate-400 truncate">{inspector.email}</p>
                    )}
                  </div>
                  {/* Pending count badge */}
                  {hasUploads && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded-full shrink-0">
                      {(snap as Snapshot).uploads.reduce((sum, g) => sum + g.files.length, 0)} files
                    </span>
                  )}
                  <span className="text-slate-300 ml-auto shrink-0">
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </span>
                </button>

                {/* Status + Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <PhaseChip phase={s.phase} note={s.note} />

                  {isFinished ? (
                    <button
                      onClick={() => reset(inspector.id)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-700 underline"
                    >
                      Reset
                    </button>
                  ) : (
                    <button
                      disabled={isBusy || !hasUploads}
                      onClick={() => triggerRetry(inspector)}
                      title={!hasUploads ? "No pending uploads on this inspector's device" : ""}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6700] hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBusy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      {isBusy ? "Waiting…" : "Retry All"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded — Snapshot Detail */}
              {isExpanded && (
                <div className="bg-slate-50 border-t border-slate-100 px-5 pb-4 pt-3">
                  {/* Loading state */}
                  {snap === "loading" && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
                      <Loader2 size={12} className="animate-spin" /> Fetching snapshot…
                    </div>
                  )}

                  {/* No snapshot */}
                  {snap !== "loading" && !snap && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
                      <WifiOff size={14} className="opacity-50" />
                      <span>No pending uploads recorded for this inspector</span>
                    </div>
                  )}

                  {/* Snapshot exists but empty */}
                  {snap && snap !== "loading" && (snap as Snapshot).uploads?.length === 0 && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs py-3">
                      <CheckCircle2 size={14} />
                      <span>All uploads cleared — nothing pending</span>
                    </div>
                  )}

                  {/* Snapshot with data */}
                  {snap && snap !== "loading" && (snap as Snapshot).uploads?.length > 0 && (
                    <div className="space-y-3">
                      {/* Freshness + refresh */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          Last synced: <span className="font-bold text-slate-600">{timeAgo((snap as Snapshot).updatedAt)}</span>
                        </span>
                        <button
                          onClick={() => fetchSnapshot(inspector.id)}
                          className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1"
                        >
                          <RefreshCw size={9} /> Refresh
                        </button>
                      </div>

                      {/* Groups */}
                      {(snap as Snapshot).uploads.map((group) => (
                        <div
                          key={`${group.type}_${group.orderId}`}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm"
                        >
                          {/* Group header */}
                          <div className="flex items-start justify-between mb-2.5">
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-wider text-[#FF6700] bg-orange-50 px-2 py-0.5 rounded border border-[#FF6700]/10">
                                {group.type === "RECEIVER_REJECTION" ? "Intake Rejection Proof" : "Inspection Media Proof"}
                              </span>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Package size={11} className="text-[#313079]" />
                                <p className="font-mono text-xs font-black text-[#313079]">AWB: {group.orderId}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              group.status === "failed"
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : group.status === "uploading"
                                ? "bg-blue-50 text-blue-600 border border-blue-100"
                                : "bg-slate-50 text-slate-500 border border-slate-100"
                            }`}>
                              {group.status === "failed" ? "Failed" : group.status === "uploading" ? "Uploading…" : "Pending"}
                            </span>
                          </div>

                          {/* File list */}
                          <div className="space-y-1.5">
                            {group.files.map((file) => {
                              const isVideo = file.mimeType.startsWith("video/");
                              return (
                                <div key={file.id} className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    {isVideo
                                      ? <FileVideo size={11} className="text-[#313079] shrink-0" />
                                      : <FileImage size={11} className="text-[#FF6700] shrink-0" />
                                    }
                                    <span className="font-mono text-[11px] text-slate-700 truncate flex-1">{file.name}</span>
                                    <span className="text-[10px] text-slate-400 shrink-0">{file.sizeMb} MB</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                      file.status === "failed"
                                        ? "bg-red-50 text-red-500"
                                        : "bg-blue-50 text-blue-500"
                                    }`}>
                                      {file.status === "failed" ? "Failed" : "Uploading"}
                                    </span>
                                  </div>
                                  {file.error && (
                                    <p className="text-[10px] text-red-500 pl-5 leading-snug">{file.error}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Group error */}
                          {group.error && (
                            <div className="mt-2 flex items-start gap-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                              <AlertCircle size={11} className="shrink-0 mt-0.5" />
                              <p className="text-[10px] leading-snug">{group.error}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">
          Inspector snapshot syncs every ~30s. Retry button is active only when pending uploads are detected. Command expires after 2 minutes if not received.
        </p>
      </div>
    </div>
  );
}
