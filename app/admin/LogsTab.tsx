"use client";

import { useState, useEffect, useRef } from "react";
import {
  ClipboardList, Package, Box, AlertTriangle, FileImage,
  Wrench, Calendar, Search, Download, ChevronDown, ChevronLeft,
  ChevronRight, RefreshCw, ExternalLink, CheckCircle2, XCircle,
  Clock, Layers, AlertCircle, TrendingUp, BarChart2, Filter,
  FolderOpen, ShieldAlert, PackageCheck, PackageX, Minus
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type RangeOption = "today" | "week" | "month" | "year" | "custom";
type SubView = "packages" | "items";

interface PackageLog {
  id: string;
  trackingId: string;
  status: string;
  marketplace: string;
  removalOrderId: string | null;
  createdAt: string;
  receivedAt: string | null;
  receivedBy: string | null;
  inspectedAt: string | null;
  inspectedBy: string | null;
  inspectorHandoverAt: string | null;
  qcCheckedAt: string | null;
  claimId: string | null;
  alertCount: number;
  unresolvedAlerts: number;
  evidences: Array<{
    id: string;
    lpn: string;
    type: string;
    status: string | null;
    orderDriveLink: string | null;
    lpnDriveLink: string | null;
    claimReason: string | null;
    claimSubReason: string | null;
    uploadedByEmail: string | null;
    createdAt: string;
  }>;
  alerts: Array<{
    id: string;
    level: string;
    type: string;
    title: string;
    resolved: boolean;
    createdAt: string;
  }>;
}

interface ItemLog {
  lpn: string;
  tempId: string | null;
  status: string;
  recoveryType: string | null;
  orderId: string | null;
  lpnDriveLink: string | null;
  orderDriveLink: string | null;
  recoveryHandoverAt: string | null;
  isRefurbished: boolean;
  createdAt: string;
  manifestId: string | null;
  manifestTrackingId: string | null;
  manifestStatus: string | null;
  inspectedBy: string | null;
  evidences: Array<{
    lpn: string;
    type: string;
    lpnDriveLink: string | null;
    orderDriveLink: string | null;
    status: string | null;
  }>;
}

interface MissingItem {
  id: string;
  orderId: string;
  fnsku: string;
  missingQuantity: number;
  trackingId: string | null;
  orderDriveLink: string | null;
  createdAt: string;
  manifestTrackingId: string | null;
}

interface PackageStats {
  totalPackages: number;
  totalReceived: number;
  totalRejected: number;
  totalInspected: number;
  statusBreakdown: Record<string, number>;
}

interface ItemStats {
  totalItems: number;
  missingItems: number;
  statusBreakdown: Record<string, number>;
}

// ── Helper: status labels and colours ─────────────────────────────────────────

const PACKAGE_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  EXPECTED:              { label: "Expected",              color: "text-slate-400",  bg: "bg-slate-100",   icon: <Clock size={12} /> },
  IN_TRANSIT:            { label: "In Transit",            color: "text-blue-600",   bg: "bg-blue-50",     icon: <Package size={12} /> },
  LOST_IN_TRANSIT:       { label: "Lost in Transit",       color: "text-red-600",    bg: "bg-red-50",      icon: <AlertTriangle size={12} /> },
  AT_DOCK:               { label: "At Dock",               color: "text-amber-600",  bg: "bg-amber-50",    icon: <PackageCheck size={12} /> },
  IN_INSPECTION:         { label: "In Inspection",         color: "text-violet-600", bg: "bg-violet-50",   icon: <Search size={12} /> },
  INSPECTED:             { label: "Inspected",             color: "text-emerald-600",bg: "bg-emerald-50",  icon: <CheckCircle2 size={12} /> },
  CLAIMS_STAGING:        { label: "Claims Staging",        color: "text-orange-600", bg: "bg-orange-50",   icon: <ShieldAlert size={12} /> },
  CLAIM_RESOLVED:        { label: "Claim Resolved",        color: "text-teal-600",   bg: "bg-teal-50",     icon: <CheckCircle2 size={12} /> },
  RECOVERED_TO_INVENTORY:{ label: "Recovered",             color: "text-green-700",  bg: "bg-green-50",    icon: <TrendingUp size={12} /> },
};

const ITEM_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  recovery:    { label: "Recovery",    color: "text-violet-600", bg: "bg-violet-50" },
  inventory:   { label: "Inventory",   color: "text-emerald-600",bg: "bg-emerald-50" },
  good:        { label: "Good",        color: "text-green-700",  bg: "bg-green-50" },
  sellable:    { label: "Sellable",    color: "text-green-700",  bg: "bg-green-50" },
  damaged:     { label: "Damaged",     color: "text-red-600",    bg: "bg-red-50" },
  refurbished: { label: "Refurbished", color: "text-blue-600",   bg: "bg-blue-50" },
  missing:     { label: "Missing",     color: "text-rose-700",   bg: "bg-rose-50" },
  rejected:    { label: "Rejected",    color: "text-orange-600", bg: "bg-orange-50" },
};

function getStatusMeta(status: string) {
  return (
    PACKAGE_STATUS_META[status] ||
    { label: status, color: "text-slate-500", bg: "bg-slate-100", icon: <Minus size={12} /> }
  );
}

function getItemMeta(status: string) {
  const lower = status.toLowerCase();
  for (const [key, val] of Object.entries(ITEM_STATUS_META)) {
    if (lower.includes(key)) return val;
  }
  return { label: status, color: "text-slate-500", bg: "bg-slate-100" };
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Range preset config ────────────────────────────────────────────────────────

const RANGE_OPTS: { value: RangeOption; label: string }[] = [
  { value: "today",  label: "Today" },
  { value: "week",   label: "This Week" },
  { value: "month",  label: "This Month" },
  { value: "year",   label: "This Year" },
  { value: "custom", label: "Custom" },
];

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Package Row ────────────────────────────────────────────────────────────────

function PackageRow({ pkg }: { pkg: PackageLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getStatusMeta(pkg.status);
  const rejected = pkg.evidences.some(e => e.type === "RECEIVER_REJECTION");
  const inspEvidence = pkg.evidences.filter(e => e.type !== "RECEIVER_REJECTION");

  return (
    <div className={`border-b border-slate-100 transition-colors ${expanded ? "bg-indigo-50/30" : "hover:bg-slate-50"}`}>
      {/* Main Row */}
      <div
        className="grid grid-cols-12 items-center px-4 py-3 gap-2 cursor-pointer"
        onClick={() => setExpanded(p => !p)}
      >
        {/* Tracking ID */}
        <div className="col-span-3 flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${meta.bg} ${meta.color}`}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 font-mono truncate">{pkg.trackingId}</p>
            {pkg.removalOrderId && (
              <p className="text-[10px] text-slate-400 truncate">Order: {pkg.removalOrderId}</p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color}`}>
            {meta.icon} {meta.label}
          </span>
        </div>

        {/* Received */}
        <div className="col-span-2 text-[11px] text-slate-600">
          {pkg.receivedAt ? (
            <span>{fmtDate(pkg.receivedAt)}<br /><span className="text-[10px] text-slate-400">{pkg.receivedBy || "—"}</span></span>
          ) : <span className="text-slate-300 italic text-[10px]">Not received</span>}
        </div>

        {/* Inspected */}
        <div className="col-span-2 text-[11px] text-slate-600">
          {pkg.inspectedAt ? (
            <span>{fmtDate(pkg.inspectedAt)}<br /><span className="text-[10px] text-slate-400">{pkg.inspectedBy || "—"}</span></span>
          ) : <span className="text-slate-300 italic text-[10px]">Not inspected</span>}
        </div>

        {/* Flags */}
        <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
          {rejected && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 border border-red-200">
              <XCircle size={9} /> Rejected
            </span>
          )}
          {pkg.claimId && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-600 border border-orange-200">
              <ShieldAlert size={9} /> Claimed
            </span>
          )}
          {pkg.unresolvedAlerts > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle size={9} /> {pkg.unresolvedAlerts} Alert{pkg.unresolvedAlerts > 1 ? "s" : ""}
            </span>
          )}
          {pkg.evidences.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-200">
              <FileImage size={9} /> Evidence
            </span>
          )}
        </div>

        {/* Expand */}
        <div className="col-span-1 flex justify-end">
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-6 pb-5 pt-1 bg-white/70 border-t border-slate-100 space-y-4">
          {/* Timeline */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Timeline</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { label: "Created",           ts: pkg.createdAt,             actor: null },
                { label: "QC Check",          ts: pkg.qcCheckedAt,           actor: null },
                { label: "Received at Dock",  ts: pkg.receivedAt,            actor: pkg.receivedBy },
                { label: "Handover to Insp.", ts: pkg.inspectorHandoverAt,   actor: null },
                { label: "Inspected",         ts: pkg.inspectedAt,           actor: pkg.inspectedBy },
              ].map(({ label, ts, actor }) => (
                <div key={label} className={`text-[11px] ${ts ? "text-slate-700" : "text-slate-300"}`}>
                  <span className="font-semibold">{label}:</span>{" "}
                  {ts ? fmt(ts) : "—"}
                  {actor && ts && <span className="text-slate-400"> · {actor}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          {pkg.evidences.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Evidence & Folder Links</p>
              <div className="space-y-2">
                {pkg.evidences.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                    <FileImage size={14} className="text-violet-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-violet-700 uppercase">{ev.type.replace(/_/g, " ")}</span>
                        {ev.claimReason && (
                          <span className="text-[10px] text-orange-600 font-semibold">{ev.claimReason}</span>
                        )}
                        {ev.claimSubReason && (
                          <span className="text-[10px] text-slate-500">{ev.claimSubReason}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {ev.orderDriveLink && (
                          <a href={ev.orderDriveLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                            <FolderOpen size={10} /> Order Folder
                          </a>
                        )}
                        {ev.lpnDriveLink && (
                          <a href={ev.lpnDriveLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                            <ExternalLink size={10} /> LPN Folder
                          </a>
                        )}
                        {ev.uploadedByEmail && (
                          <span className="text-[10px] text-slate-400">by {ev.uploadedByEmail}</span>
                        )}
                        <span className="text-[10px] text-slate-400">{fmt(ev.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          {pkg.alerts.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                Alerts ({pkg.alerts.length})
              </p>
              <div className="space-y-1.5">
                {pkg.alerts.map(al => (
                  <div key={al.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border text-[11px]
                    ${al.resolved ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-amber-50 border-amber-100 text-slate-700"}`}>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded
                      ${al.level === "L1" ? "bg-yellow-100 text-yellow-700"
                        : al.level === "L2" ? "bg-orange-100 text-orange-700"
                        : al.level === "L3" ? "bg-red-100 text-red-700"
                        : "bg-rose-200 text-rose-800"}`}>{al.level}</span>
                    <span className="flex-1">{al.title}</span>
                    <span className={`text-[10px] font-bold ${al.resolved ? "text-emerald-500" : "text-amber-500"}`}>
                      {al.resolved ? "✓ Resolved" : "⚠ Open"}
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtDate(al.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: ItemLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getItemMeta(item.status);

  return (
    <div className={`border-b border-slate-100 transition-colors ${expanded ? "bg-emerald-50/30" : "hover:bg-slate-50"}`}>
      <div
        className="grid grid-cols-12 items-center px-4 py-3 gap-2 cursor-pointer"
        onClick={() => setExpanded(p => !p)}
      >
        {/* LPN */}
        <div className="col-span-3 min-w-0">
          <p className="text-xs font-bold text-slate-800 font-mono truncate">{item.lpn}</p>
          {item.orderId && <p className="text-[10px] text-slate-400 truncate">Order: {item.orderId}</p>}
        </div>

        {/* Status */}
        <div className="col-span-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          {item.isRefurbished && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600">Refurb</span>
          )}
        </div>

        {/* Package */}
        <div className="col-span-2 text-[11px] text-slate-600 truncate">
          {item.manifestTrackingId || "—"}
        </div>

        {/* Recovery type */}
        <div className="col-span-2 text-[11px] text-slate-600">
          {item.recoveryType || <span className="text-slate-300">—</span>}
        </div>

        {/* Created */}
        <div className="col-span-2 text-[11px] text-slate-500">
          {fmtDate(item.createdAt)}
        </div>

        {/* Links */}
        <div className="col-span-1 flex justify-end gap-1.5 items-center">
          {(item.lpnDriveLink || item.orderDriveLink || item.evidences.some(e => e.lpnDriveLink || e.orderDriveLink)) && (
            <FolderOpen size={12} className="text-indigo-400" />
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-5 pt-1 bg-white/70 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: "Created",             value: fmt(item.createdAt) },
              { label: "Recovery Handover",   value: fmt(item.recoveryHandoverAt) },
              { label: "Inspected By",        value: item.inspectedBy || "—" },
              { label: "Manifest Status",     value: item.manifestStatus || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-[11px]">
                <span className="font-semibold text-slate-600">{label}: </span>
                <span className="text-slate-700">{value}</span>
              </div>
            ))}
          </div>
          {/* Drive links */}
          <div className="flex flex-wrap gap-3">
            {item.lpnDriveLink && (
              <a href={item.lpnDriveLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:underline bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                <ExternalLink size={12} /> LPN Folder
              </a>
            )}
            {item.orderDriveLink && (
              <a href={item.orderDriveLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:underline bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                <FolderOpen size={12} /> Order Folder
              </a>
            )}
            {item.evidences.map((ev, i) => (
              ev.lpnDriveLink && (
                <a key={i} href={ev.lpnDriveLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 hover:underline bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
                  <FileImage size={12} /> Evidence: {ev.type.replace(/_/g, " ")}
                </a>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Missing Item Row ───────────────────────────────────────────────────────────

function MissingRow({ item }: { item: MissingItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
      <PackageX size={14} className="text-rose-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800">FNSKU: <span className="font-mono">{item.fnsku}</span></p>
        <p className="text-[10px] text-slate-500">Order: {item.orderId} · Package: {item.manifestTrackingId || "—"}</p>
      </div>
      <span className="text-xs font-black text-rose-600">×{item.missingQuantity}</span>
      <span className="text-[10px] text-slate-400">{fmtDate(item.createdAt)}</span>
      {item.orderDriveLink && (
        <a href={item.orderDriveLink} target="_blank" rel="noopener noreferrer"
          className="text-[10px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5">
          <FolderOpen size={10} /> Folder
        </a>
      )}
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(data: PackageLog[] | ItemLog[], view: SubView) {
  let csv = "";
  if (view === "packages") {
    const rows = data as PackageLog[];
    csv = [
      "Tracking ID,Status,Marketplace,Order ID,Received At,Received By,Inspected At,Inspected By,Alerts,Evidence Count,Claim ID,Created At",
      ...rows.map(r =>
        [
          r.trackingId, r.status, r.marketplace, r.removalOrderId || "",
          r.receivedAt || "", r.receivedBy || "", r.inspectedAt || "", r.inspectedBy || "",
          r.alertCount, r.evidences.length, r.claimId || "", r.createdAt,
        ].join(",")
      ),
    ].join("\n");
  } else {
    const rows = data as ItemLog[];
    csv = [
      "LPN,Status,Recovery Type,Order ID,Package Tracking ID,Is Refurbished,Recovery Handover,Created At",
      ...rows.map(r =>
        [
          r.lpn, r.status, r.recoveryType || "", r.orderId || "",
          r.manifestTrackingId || "", r.isRefurbished, r.recoveryHandoverAt || "", r.createdAt,
        ].join(",")
      ),
    ].join("\n");
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `warehouse-logs-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main LogsTab Component ─────────────────────────────────────────────────────

export default function LogsTab({ role }: { role: string }) {
  // ── State ──
  const [view,    setView]    = useState<SubView>("packages");
  const [range,   setRange]   = useState<RangeOption>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [search,  setSearch]  = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Package view data
  const [packages, setPackages] = useState<PackageLog[]>([]);
  const [pkgStats, setPkgStats] = useState<PackageStats | null>(null);
  const [pkgTotal, setPkgTotal] = useState(0);
  const [pkgPages, setPkgPages] = useState(1);

  // Items view data
  const [items,       setItems]       = useState<ItemLog[]>([]);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [itemStats,   setItemStats]   = useState<ItemStats | null>(null);
  const [itemTotal,   setItemTotal]   = useState(0);
  const [itemPages,   setItemPages]   = useState(1);

  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  // Stable ref so refresh button and pagination can call the latest fetch without
  // being a useEffect dependency themselves.
  const doFetchRef = useRef<((pg?: number) => Promise<void>) | null>(null);

  // ── Fetch ──
  useEffect(() => {
    let cancelled = false;

    const doFetch = async (overridePage?: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          view,
          range,
          page: String(overridePage ?? page),
          limit: "50",
          ...(search ? { search } : {}),
          ...(range === "custom" && fromDate ? { from: fromDate } : {}),
          ...(range === "custom" && toDate   ? { to:   toDate   } : {}),
        });
        const res = await fetch(`/api/admin/logs?${params}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load logs");
        }
        const json = await res.json();
        if (cancelled) return;

        if (view === "packages") {
          setPackages(json.data || []);
          setPkgStats(json.stats || null);
          setPkgTotal(json.total || 0);
          setPkgPages(json.totalPages || 1);
        } else {
          setItems(json.data || []);
          setMissingItems(json.missing || []);
          setItemStats(json.stats || null);
          setItemTotal(json.total || 0);
          setItemPages(json.totalPages || 1);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Store latest fetch fn so buttons can call it imperatively
    doFetchRef.current = doFetch;

    doFetch();

    return () => { cancelled = true; };
  }, [view, range, page, search, fromDate, toDate]);

  // ── Search debounce ──
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1);
    }, 400);
  };

  const handleRangeChange = (r: RangeOption) => {
    setRange(r);
    setPage(1);
  };

  const handleViewChange = (v: SubView) => {
    setView(v);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    doFetchRef.current?.(p);
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 shrink-0 border-b border-white/5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ClipboardList size={18} className="text-indigo-300" />
            </div>
            <div>
              <h1 className="text-white font-black text-lg leading-tight">Activity Logs</h1>
              <p className="text-slate-400 text-xs">Full warehouse activity record for admin visibility</p>
            </div>
          </div>

          {/* Sub-view toggle */}
          <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
            {(["packages", "items"] as SubView[]).map(v => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  view === v
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {v === "packages" ? "📦 Packages" : "🏷 Items"}
              </button>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {/* Range presets */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            {RANGE_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRangeChange(opt.value)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  range === opt.value
                    ? "bg-[#FF6700] text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
              />
              <span className="text-white/40 text-xs">→</span>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
              />
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 min-w-[200px]">
            <Search size={13} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search tracking ID or LPN…"
              className="bg-transparent text-white text-xs placeholder:text-white/30 focus:outline-none w-full"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => doFetchRef.current?.()}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>

          {/* CSV Export */}
          <button
            onClick={() => exportCSV(view === "packages" ? packages : items, view)}
            disabled={loading || (view === "packages" ? packages.length === 0 : items.length === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold transition-all disabled:opacity-40"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        {view === "packages" && pkgStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Packages"  value={pkgStats.totalPackages}  color="bg-indigo-50 text-indigo-600"  icon={<Package size={18} />} />
            <StatCard label="Received"        value={pkgStats.totalReceived}   color="bg-emerald-50 text-emerald-600" icon={<PackageCheck size={18} />} />
            <StatCard label="Rejected"        value={pkgStats.totalRejected}   color="bg-red-50 text-red-600"       icon={<PackageX size={18} />} />
            <StatCard label="Inspected"       value={pkgStats.totalInspected}  color="bg-violet-50 text-violet-600" icon={<CheckCircle2 size={18} />} />
          </div>
        )}
        {view === "items" && itemStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Items"   value={itemStats.totalItems}   color="bg-indigo-50 text-indigo-600"  icon={<Box size={18} />} />
            <StatCard label="Missing Items" value={itemStats.missingItems}  color="bg-rose-50 text-rose-600"     icon={<AlertCircle size={18} />} />
            <StatCard label="Recovery"      value={itemStats.statusBreakdown?.["recovery"] || 0} color="bg-violet-50 text-violet-600" icon={<Wrench size={18} />} />
            <StatCard label="In Inventory"  value={itemStats.statusBreakdown?.["inventory"] || 0} color="bg-emerald-50 text-emerald-600" icon={<Layers size={18} />} />
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto mx-6 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-100 text-red-600 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* PACKAGES TABLE */}
        {!loading && view === "packages" && (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 px-4 py-2 bg-slate-50 border-b border-slate-200 gap-2 sticky top-0 z-10">
              {["Tracking ID / Order", "Status", "Received", "Inspected", "Flags", ""].map((h, i) => (
                <div key={i} className={`text-[10px] uppercase tracking-widest font-bold text-slate-400 ${
                  i === 0 ? "col-span-3" : i === 1 ? "col-span-2" : i === 2 ? "col-span-2" : i === 3 ? "col-span-2" : i === 4 ? "col-span-2" : "col-span-1"
                }`}>
                  {h}
                </div>
              ))}
            </div>

            {packages.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No packages found for this range</p>
                <p className="text-xs mt-1">Try a different date range or search term</p>
              </div>
            ) : (
              packages.map(pkg => <PackageRow key={pkg.id} pkg={pkg} />)
            )}
          </>
        )}

        {/* ITEMS TABLE */}
        {!loading && view === "items" && (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 px-4 py-2 bg-slate-50 border-b border-slate-200 gap-2 sticky top-0 z-10">
              {["LPN / Order ID", "Status", "Package", "Recovery Type", "Created", ""].map((h, i) => (
                <div key={i} className={`text-[10px] uppercase tracking-widest font-bold text-slate-400 ${
                  i === 0 ? "col-span-3" : i === 1 ? "col-span-2" : i === 2 ? "col-span-2" : i === 3 ? "col-span-2" : i === 4 ? "col-span-2" : "col-span-1"
                }`}>
                  {h}
                </div>
              ))}
            </div>

            {items.length === 0 && missingItems.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <Box size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No items found for this range</p>
                <p className="text-xs mt-1">Try a different date range or search term</p>
              </div>
            ) : (
              <>
                {items.map(item => <ItemRow key={item.lpn} item={item} />)}

                {/* Missing items section */}
                {missingItems.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-rose-50 border-y border-rose-100 flex items-center gap-2">
                      <AlertCircle size={13} className="text-rose-500" />
                      <span className="text-xs font-bold text-rose-700">Missing Items ({missingItems.length})</span>
                    </div>
                    {missingItems.map(m => <MissingRow key={m.id} item={m} />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="px-6 pb-4 shrink-0 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            {view === "packages"
              ? `${packages.length} of ${pkgTotal} packages`
              : `${items.length} of ${itemTotal} items`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 text-xs font-bold text-slate-600">
              {page} / {view === "packages" ? pkgPages : itemPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= (view === "packages" ? pkgPages : itemPages) || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
