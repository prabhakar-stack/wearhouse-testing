import React, { useState, useEffect, useCallback } from 'react';
import {
  Scan,
  Package,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Database,
  ShieldAlert,
  ClipboardList,
  XCircle,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type ProcessStep = 1 | 2 | 3;
type HandoverTab = 'good' | 'recovery';
type QCTab = 'good' | 'recovery';

type GoodAuditStatus = 'pending' | 'requires review at inspection' | 'qc approved';
type RecoveryAuditStatus = 'pending' | 'requires review at inspection' | 'requires review at recovery' | 'qc approved';

interface GoodBatchItem {
  lpn: string;
  sku: string;
  auditStatus: GoodAuditStatus;
}

interface RecoveryBatchItem {
  temp_id: string;
  sku: string;
  lpn?: string;
  auditStatus: RecoveryAuditStatus;
}

interface RejectedClaimRow {
  lpn?: string;
  claimId?: string;
  trackingId?: string;
  orderId?: string;
  sku?: string;
  productName?: string;
  status: string;
  createdAt?: string;
  botLogReason?: string;
  actionStatus?: 'pending' | 'fail checked' | 'requires claims review';
}

// --- Helpers ---

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'qc approved') return 'bg-green-100 text-green-700 border border-green-200';
  if (s === 'requires review at inspection') return 'bg-red-100 text-red-700 border border-red-200';
  if (s === 'requires review at recovery') return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (s === 'ok') return 'bg-green-100 text-green-700 border border-green-200';
  if (s === 'fail checked') return 'bg-green-100 text-green-700 border border-green-200';
  if (s === 'requires claims review') return 'bg-red-100 text-red-700 border border-red-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

// --- Main Component ---

export default function QCAuditTab() {
  const [currentProcess, setCurrentProcess] = useState<ProcessStep>(1);
  const [handoverTab, setHandoverTab] = useState<HandoverTab>('good');
  const [qcTab, setQcTab] = useState<QCTab>('good');

  // Process 1 state
  const [goodBatch, setGoodBatch] = useState<GoodBatchItem[]>([]);
  const [recoveryBatch, setRecoveryBatch] = useState<RecoveryBatchItem[]>([]);
  const [goodScanInput, setGoodScanInput] = useState('');
  const [recoveryScanInput, setRecoveryScanInput] = useState('');

  // Process 3 state
  const [rejectedClaims, setRejectedClaims] = useState<RejectedClaimRow[]>([]);
  const [rejectedLoading, setRejectedLoading] = useState(false);

  // Shared
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (alertMessage) {
      const t = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [alertMessage]);

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const fetchRejectedClaims = useCallback(async () => {
    setRejectedLoading(true);
    try {
      const resp = await fetch('/api/qc/rejected-claims');
      if (resp.ok) {
        const data = await resp.json();
        setRejectedClaims(data.map((r: any) => ({ ...r, actionStatus: 'pending' as const })));
      }
    } catch {}
    finally { setRejectedLoading(false); }
  }, []);

  useEffect(() => {
    if (currentProcess === 3) fetchRejectedClaims();
  }, [currentProcess, fetchRejectedClaims]);

  // --- Process 1: Handover handlers ---

  const handleGoodScan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanLpn = goodScanInput.trim();
    if (!cleanLpn) return;
    if (goodBatch.find(i => i.lpn.toLowerCase() === cleanLpn.toLowerCase())) {
      setAlertMessage(`LPN ${cleanLpn} is already in the good batch`);
      setGoodScanInput('');
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/qc/check-lpn?lpn=${encodeURIComponent(cleanLpn)}`);
      const data = await resp.json();
      if (!resp.ok) { setAlertMessage(data.message || `LPN ${cleanLpn} not found`); return; }
      if (data.status !== 'good') {
        setAlertMessage(`LPN ${cleanLpn} has status "${data.status}" — only "good" items can be added to this batch`);
        return;
      }
      setGoodBatch(prev => [...prev, { lpn: data.lpn, sku: data.sku || 'UNKNOWN', auditStatus: 'pending' }]);
      setSuccessMessage(`Added LPN ${cleanLpn} (${data.sku || 'UNKNOWN'}) to good batch`);
    } catch {
      setAlertMessage('Failed to check LPN status — check connection');
    } finally {
      setIsLoading(false);
      setGoodScanInput('');
    }
  };

  const handleRecoveryScan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanTempId = recoveryScanInput.trim();
    if (!cleanTempId) return;
    if (recoveryBatch.find(i => i.temp_id.toLowerCase() === cleanTempId.toLowerCase())) {
      setAlertMessage(`Temp ID ${cleanTempId} is already in the recovery batch`);
      setRecoveryScanInput('');
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/qc/check-temp-id?temp_id=${encodeURIComponent(cleanTempId)}`);
      const data = await resp.json();
      if (!resp.ok) { setAlertMessage(data.message || `Temp ID ${cleanTempId} not found`); return; }
      if (data.status !== 'recovered') {
        setAlertMessage(`Temp ID ${cleanTempId} has status "${data.status}" — only "recovered" items can be added`);
        return;
      }
      setRecoveryBatch(prev => [...prev, {
        temp_id: data.temp_id,
        sku: data.sku || 'UNKNOWN',
        lpn: data.lpn,
        auditStatus: 'pending'
      }]);
      setSuccessMessage(`Added Temp ID ${cleanTempId} (${data.sku || 'UNKNOWN'}) to recovery batch`);
    } catch {
      setAlertMessage('Failed to check Temp ID status — check connection');
    } finally {
      setIsLoading(false);
      setRecoveryScanInput('');
    }
  };

  // --- Process 2: QC action handlers ---

  const handleGoodAction = async (lpn: string, newStatus: GoodAuditStatus) => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/qc/lpn-qc-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpn, status: newStatus }),
      });
      if (!resp.ok) { setAlertMessage('Failed to update item status'); return; }
      setGoodBatch(prev => prev.map(i => i.lpn === lpn ? { ...i, auditStatus: newStatus } : i));
      setSuccessMessage(`LPN ${lpn} → "${newStatus}"`);
    } catch {
      setAlertMessage('Network error while updating status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryAction = async (temp_id: string, newStatus: RecoveryAuditStatus) => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/qc/temp-id-qc-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_id, status: newStatus }),
      });
      if (!resp.ok) { setAlertMessage('Failed to update item status'); return; }
      setRecoveryBatch(prev => prev.map(i => i.temp_id === temp_id ? { ...i, auditStatus: newStatus } : i));
      setSuccessMessage(`Temp ID ${temp_id} → "${newStatus}"`);
    } catch {
      setAlertMessage('Network error while updating status');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Process 3: Rejected claims handlers ---

  const handleRejectedClaimAction = async (
    row: RejectedClaimRow,
    newStatus: 'fail checked' | 'requires claims review'
  ) => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/qc/claims/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingId: row.trackingId, orderId: row.orderId, status: newStatus }),
      });
      if (!resp.ok) { setAlertMessage('Failed to update claim status'); return; }
      setRejectedClaims(prev =>
        prev.map(r => (r.lpn === row.lpn && r.trackingId === row.trackingId ? { ...r, actionStatus: newStatus } : r))
      );
      setSuccessMessage(`Claim (${row.lpn || row.trackingId}) → "${newStatus}"`);
    } catch {
      setAlertMessage('Network error while updating claim status');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---

  const canProceedToQC = goodBatch.length > 0 || recoveryBatch.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-900 bg-[#FFF700] px-2 py-0.5 rounded tracking-wider uppercase">QC Module</span>
            <span className="text-xs font-semibold text-slate-400">Claims Administration Panel</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">QC Audit Workstation</h2>
          <p className="text-slate-400 text-xs font-medium mt-1">Handover scanning → quality check → rejected claims review</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 px-4 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-xs font-bold text-[#FFF700] gap-2">
            <Database className="w-4 h-4" />
            SUPABASE LIVE
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence mode="wait">
        {alertMessage && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-[#FF4C4C] text-white p-4 rounded-2xl flex items-center gap-3 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-extrabold text-sm uppercase tracking-wide">{alertMessage}</span>
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-[#22c55e] text-white p-4 rounded-2xl flex items-center gap-3 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-extrabold text-sm uppercase tracking-wide">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Process Step Nav */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
        {([1, 2, 3] as ProcessStep[]).map((step) => {
          const labels: Record<ProcessStep, string> = { 1: '1  Handover', 2: '2  Quality Check', 3: '3  Rejected Claims' };
          const icons: Record<ProcessStep, React.ReactNode> = {
            1: <Scan className="w-4 h-4" />,
            2: <BadgeCheck className="w-4 h-4" />,
            3: <ClipboardList className="w-4 h-4" />,
          };
          const active = currentProcess === step;
          const disabled = step === 2 && !canProceedToQC;
          return (
            <button
              key={step}
              type="button"
              onClick={() => !disabled && setCurrentProcess(step)}
              disabled={disabled}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 transition-all
                ${active
                  ? 'bg-slate-900 text-[#FFF700] shadow-md'
                  : disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}
            >
              {icons[step]}
              {labels[step]}
            </button>
          );
        })}
      </div>

      {/* ========== PROCESS 1: HANDOVER ========== */}
      {currentProcess === 1 && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-2">
            {(['good', 'recovery'] as HandoverTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setHandoverTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all border
                  ${handoverTab === tab
                    ? tab === 'good'
                      ? 'bg-green-600 text-white border-green-700 shadow'
                      : 'bg-sky-600 text-white border-sky-700 shadow'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                {tab === 'good' ? `Good Products (${goodBatch.length})` : `Recovery Products (${recoveryBatch.length})`}
              </button>
            ))}
          </div>

          {/* Good Products scan */}
          {handoverTab === 'good' && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#313079] flex items-center gap-2">
                  <Scan className="w-4 h-4 text-[#FF6700]" />
                  SCAN GOOD PRODUCTS — BY LPN
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">ItemStatus must be "good" to be accepted</p>
              </div>
              <form onSubmit={handleGoodScan} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Scan className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="Scan or manually enter LPN barcode..."
                    value={goodScanInput}
                    onChange={e => setGoodScanInput(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-extrabold tracking-wider transition-colors shrink-0 flex items-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  ADD TO BATCH
                </button>
              </form>

              {/* Good batch table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                {goodBatch.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Package className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="text-xs font-bold">Good batch is empty — scan LPNs above</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">LPN</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {goodBatch.map((item, idx) => (
                        <tr key={item.lpn} className="hover:bg-slate-50">
                          <td className="py-3 px-4 text-[10px] font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 text-xs font-mono font-bold">{item.lpn}</td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600">{item.sku}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-green-50 text-green-700 border border-green-200">good</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Recovery Products scan */}
          {handoverTab === 'recovery' && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#313079] flex items-center gap-2">
                  <Scan className="w-4 h-4 text-[#FF6700]" />
                  SCAN RECOVERY PRODUCTS — BY TEMP ID
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">ItemStatus must be "recovered" to be accepted</p>
              </div>
              <form onSubmit={handleRecoveryScan} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Scan className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                    placeholder="Scan or manually enter Temp ID barcode..."
                    value={recoveryScanInput}
                    onChange={e => setRecoveryScanInput(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-extrabold tracking-wider transition-colors shrink-0 flex items-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  ADD TO BATCH
                </button>
              </form>

              {/* Recovery batch table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                {recoveryBatch.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Package className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="text-xs font-bold">Recovery batch is empty — scan Temp IDs above</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Temp ID</th>
                        <th className="py-3 px-4">LPN</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recoveryBatch.map((item, idx) => (
                        <tr key={item.temp_id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 text-[10px] font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 text-xs font-mono font-bold">{item.temp_id}</td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-500">{item.lpn || '—'}</td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600">{item.sku}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-200">recovered</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Proceed button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canProceedToQC}
              onClick={() => setCurrentProcess(2)}
              className={`px-8 py-3 rounded-2xl text-xs font-extrabold tracking-widest uppercase flex items-center gap-2 transition-all
                ${canProceedToQC
                  ? 'bg-slate-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-[#FFF700] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'}`}
            >
              Proceed to Quality Check
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========== PROCESS 2: QUALITY CHECK ========== */}
      {currentProcess === 2 && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-2">
            {(['good', 'recovery'] as QCTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setQcTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all border
                  ${qcTab === tab
                    ? tab === 'good'
                      ? 'bg-green-600 text-white border-green-700 shadow'
                      : 'bg-sky-600 text-white border-sky-700 shadow'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                {tab === 'good' ? `Good Products (${goodBatch.length})` : `Recovery Products (${recoveryBatch.length})`}
              </button>
            ))}
          </div>

          {/* Good QC table */}
          {qcTab === 'good' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-[#313079]">GOOD PRODUCTS — QUALITY CHECK</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Inspect each item and take the appropriate action</p>
              </div>
              {goodBatch.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ShieldAlert className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="text-xs font-bold">No good items scanned in Process 1</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                      <th className="py-3 px-4">LPN</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Audit Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {goodBatch.map((item) => {
                      const done = item.auditStatus !== 'pending';
                      return (
                        <tr key={item.lpn} className={`transition-colors ${done ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                          <td className="py-3.5 px-4 text-xs font-mono font-bold">{item.lpn}</td>
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-600">{item.sku}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusBadge(item.auditStatus)}`}>
                              {item.auditStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {done ? (
                              <span className="text-[10px] text-slate-400 font-bold italic">Actioned</span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleGoodAction(item.lpn, 'requires review at inspection')}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Product Damaged
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleGoodAction(item.lpn, 'qc approved')}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Approved
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Recovery QC table */}
          {qcTab === 'recovery' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-[#313079]">RECOVERY PRODUCTS — QUALITY CHECK</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Inspect each refurbished item and take the appropriate action</p>
              </div>
              {recoveryBatch.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ShieldAlert className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="text-xs font-bold">No recovery items scanned in Process 1</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                      <th className="py-3 px-4">Temp ID</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Audit Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recoveryBatch.map((item) => {
                      const done = item.auditStatus !== 'pending';
                      return (
                        <tr key={item.temp_id} className={`transition-colors ${done ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                          <td className="py-3.5 px-4 text-xs font-mono font-bold">{item.temp_id}</td>
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-600">{item.sku}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusBadge(item.auditStatus)}`}>
                              {item.auditStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {done ? (
                              <span className="text-[10px] text-slate-400 font-bold italic">Actioned</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleRecoveryAction(item.temp_id, 'requires review at inspection')}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Product Damaged
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleRecoveryAction(item.temp_id, 'requires review at recovery')}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Recovery Fault
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleRecoveryAction(item.temp_id, 'qc approved')}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Approved
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== PROCESS 3: REJECTED CLAIMS REVIEW ========== */}
      {currentProcess === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#313079] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#FF6700]" />
                  REJECTED CLAIMS REVIEW
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Claims rejected by Amazon or the filing bot — inspect and take action</p>
              </div>
              <button
                type="button"
                onClick={fetchRejectedClaims}
                disabled={rejectedLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-extrabold tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rejectedLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {rejectedLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-bold">Loading rejected claims...</span>
              </div>
            ) : rejectedClaims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ClipboardList className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-xs font-bold">No rejected claims to review</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                    <th className="py-3 px-4">LPN</th>
                    <th className="py-3 px-4">Claim ID</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rejectedClaims.map((row, idx) => {
                    const done = row.actionStatus !== 'pending';
                    return (
                      <tr key={row.lpn || row.trackingId || idx} className={`transition-colors ${done ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-mono font-bold">{row.lpn || '—'}</span>
                          {row.botLogReason && (
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[220px] truncate" title={row.botLogReason}>
                              {row.botLogReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-600">{row.claimId || '—'}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {done ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusBadge(row.actionStatus!)}`}>
                              {row.actionStatus}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-700 border border-red-200">
                              rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {done ? (
                            <span className="text-[10px] text-slate-400 font-bold italic">Actioned</span>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleRejectedClaimAction(row, 'requires claims review')}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                              >
                                <XCircle className="w-3 h-3" />
                                Inspection Fault
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleRejectedClaimAction(row, 'fail checked')}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-lg text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Approved
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
