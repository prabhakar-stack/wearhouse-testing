import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Check, 
  HelpCircle, 
  RefreshCw, 
  Package, 
  ArrowRight, 
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SkuStatus {
  sku: string;
  quantity_count: number;
  status: string;
  expected_count: number;
  has_hidden_damaged: boolean;
}

interface RecoveredItem {
  lpn: string;
  sku: string;
  item_status: string;
  is_refurbished: boolean;
  damage_type: string;
}

interface RejectedClaim {
  orderId: string;
  trackingId: string;
  sku: string;
  fnsku: string;
  productName: string;
  channel: string;
  status: string;
  type: string;
  driveLink: string;
  botLogReason?: string;
}

export default function QCAuditTab() {
  // Section 1 States
  const [skuList, setSkuList] = useState<SkuStatus[]>([]);
  const [scanValue, setScanValue] = useState('');
  const [loadingSku, setLoadingSku] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [lastScannedSku, setLastScannedSku] = useState<string | null>(null);

  // Damaged Confirmation Popup State
  const [showDamageConfirm, setShowDamageConfirm] = useState<string | null>(null);

  // Reconciliation states
  const [showReconciliationConfirm, setShowReconciliationConfirm] = useState<{ totalMissing: number } | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Section 2 States
  const [recoveredItems, setRecoveredItems] = useState<RecoveredItem[]>([]);
  const [loadingRecovered, setLoadingRecovered] = useState(false);

  // Section 3 States
  const [rejectedClaims, setRejectedClaims] = useState<RejectedClaim[]>([]);
  const [loadingRejected, setLoadingRejected] = useState(false);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  // Global Notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Initial Fetch Function
  const fetchData = async () => {
    try {
      setLoadingSku(true);
      setLoadingRecovered(true);
      setLoadingRejected(true);

      const [skuRes, recRes, rejRes] = await Promise.all([
        fetch('/api/qc/sku-status'),
        fetch('/api/qc/recovered-items'),
        fetch('/api/qc/rejected-claims')
      ]);

      if (skuRes.ok) {
        const data = await skuRes.json();
        setSkuList(data);
      }
      if (recRes.ok) {
        const data = await recRes.json();
        setRecoveredItems(data);
      }
      if (rejRes.ok) {
        const data = await rejRes.json();
        setRejectedClaims(data);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to sync compliance audit datasets.', 'error');
    } finally {
      setLoadingSku(false);
      setLoadingRecovered(false);
      setLoadingRejected(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Section 1 Handlers
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = scanValue.trim();
    if (!cleanSku) return;

    setLoadingSku(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/qc/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: cleanSku })
      });

      if (res.ok) {
        const result = await res.json();
        const difference = result.expected_count - result.quantity_count;
        
        let msgType: 'success' | 'warning' = 'success';
        let msgText = `Successfully scanned SKU ${cleanSku}. Counted: ${result.quantity_count}/${result.expected_count}`;
        
        if (result.qc_status === 'quantity missing') {
          msgType = 'warning';
          msgText = `SKU scanned. Quantity missing: Need ${difference} more to match expectations!`;
        }

        setScanMessage({ text: msgText, type: msgType });
        triggerToast(`SKU ${cleanSku} incremented successfully!`, 'success');
        setScanValue('');
        setLastScannedSku(cleanSku);
        
        // Refresh SKU list to show update
        const updatedRes = await fetch('/api/qc/sku-status');
        if (updatedRes.ok) setSkuList(await updatedRes.json());
      } else {
        const errData = await res.json();
        setScanMessage({ text: errData.message || 'Verification scan failed.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setScanMessage({ text: 'Network exception occurred during scanning.', type: 'error' });
    } finally {
      setLoadingSku(false);
    }
  };

  const handleMarkDamaged = async (sku: string) => {
    try {
      const res = await fetch('/api/qc/sku-damaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku })
      });

      if (res.ok) {
        triggerToast(`Batch and item status flagged for review. SKU: ${sku}`, 'success');
        setShowDamageConfirm(null);
        
        // Refresh datasets
        const [updatedSku, updatedRec] = await Promise.all([
          fetch('/api/qc/sku-status').then(r => r.json()),
          fetch('/api/qc/recovered-items').then(r => r.json())
        ]);
        setSkuList(updatedSku);
        setRecoveredItems(updatedRec);
      } else {
        triggerToast('Failed to mark item as damaged.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to trigger database damage mutations', 'error');
    }
  };

  const handleHandoverCompleteClick = () => {
    let totalMissing = 0;
    skuList.forEach(item => {
      const diff = item.expected_count - item.quantity_count;
      if (diff > 0) {
        totalMissing += diff;
      }
    });

    if (totalMissing > 0) {
      setShowReconciliationConfirm({ totalMissing });
    } else {
      handleHandoverComplete(true);
    }
  };

  const handleHandoverComplete = async (bypassWarning = false) => {
    setIsReconciling(true);
    try {
      const res = await fetch('/api/qc/handover-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypassWarning })
      });

      if (res.ok) {
        triggerToast('Handover reconciled and completed successfully!', 'success');
        setShowReconciliationConfirm(null);
        // Refresh SKU list to show update
        const updatedRes = await fetch('/api/qc/sku-status');
        if (updatedRes.ok) setSkuList(await updatedRes.json());
      } else {
        triggerToast('Failed to reconcile handover.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during batch handover complete.', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  // Section 2 Handler
  const handleRecoveryReview = async (lpn: string) => {
    try {
      const res = await fetch('/api/qc/recovery-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpn })
      });

      if (res.ok) {
        triggerToast(`Asynchronous compliance status saved for ${lpn}`, 'success');
        
        // Refresh SKU & Recovered lists
        const [updatedSku, updatedRec] = await Promise.all([
          fetch('/api/qc/sku-status').then(r => r.json()),
          fetch('/api/qc/recovered-items').then(r => r.json())
        ]);
        setSkuList(updatedSku);
        setRecoveredItems(updatedRec);
      } else {
        triggerToast('Failed to trigger audit update.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Database connection lookup yielded error.', 'error');
    }
  };

  // Section 3 Handlers
  const handleClaimStatusUpdate = async (orderId: string, choice: 'No Issue' | 'Inspection Mistake') => {
    const targetStatus = choice === 'No Issue' ? 'closed - valid rejection' : 're-evaluation required';
    try {
      const res = await fetch('/api/qc/claims/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: targetStatus })
      });

      if (res.ok) {
        triggerToast(`Audited successfully: '${choice}' saved.`, 'success');
        // Close expander
        setExpandedClaim(null);
        // Refresh rejected claims list
        const updatedRes = await fetch('/api/qc/rejected-claims');
        if (updatedRes.ok) setRejectedClaims(await updatedRes.json());
      } else {
        triggerToast('Failed to save audit result.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to mutate claims database statuses.', 'error');
    }
  };

  return (
    <div id="qc-audit-container" className="p-4 sm:p-6 lg:p-8 space-y-10 max-w-7xl mx-auto text-slate-800 bg-slate-50/50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-[#FF6700]/10 rounded-xl flex items-center justify-center border border-[#FF6700]/25 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-[#FF6700]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase">compliance and qc audit</h1>
          </div>
          <p className="text-slate-505 font-medium mt-1.5 text-sm sm:text-base">
            Defensive monitor designed to prevent incorrect inventory categorizations and packaging mix-ups on re-inventorisation.
          </p>
        </div>
        <div>
          <button 
            onClick={fetchData}
            id="btn-sync-databases"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-gray-300 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4 text-slate-500 animate-spin-hover" />
            Synchronize Datasets
          </button>
        </div>
      </div>

      {/* TOAST SYSTEM */}
      {toast && (
        <div 
          id="compliance-toast"
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-850 font-medium' :
            toast.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-850 font-medium' :
            'bg-slate-800 border-slate-700 text-white'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span className="font-semibold text-sm">{toast.text}</span>
        </div>
      )}

      {/* SECTION 1: SKU HANDOVER PROCESS */}
      <section id="section-sku-handover" className="space-y-6">
        <div className="border-b border-gray-205 pb-4">
          <span className="text-xs font-bold text-[#FF6700] tracking-widest uppercase">Process 01</span>
          <h2 className="text-xl font-extrabold text-slate-950 mt-1">SKU Handover Process</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Scan physical barcodes to track counted numbers under strict blind verification boundaries.
          </p>
        </div>

        {/* Two Column Workspace Grid (Left 40% batch, Right 60% Active monitor) */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          
          {/* LEFT COLUMN: 40% BATCH OVERVIEW */}
          <div className="lg:col-span-4 bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider block">Batch Overview</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active SKU checklist under audit</p>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                {skuList.length} SKUs
              </span>
            </div>

            {/* List / Checklist rows layout */}
            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-3 pr-1">
              {skuList.map((item) => {
                const isDamagedRow = item.status === 'requires review' || item.status === 'requires review at qc';
                const isQuantityMissing = item.status === 'quantity missing' || item.status === 'missing at qc';
                const isReady = item.status === 'ready for Inventory';
                const isActiveHighlight = item.sku === lastScannedSku;

                return (
                  <div
                    key={item.sku}
                    className={`p-3.5 rounded-lg border transition-all duration-250 ${
                      isActiveHighlight 
                        ? 'bg-[#FFF700]/20 border-2 border-amber-400 shadow-sm ring-1 ring-amber-300 font-bold' 
                        : isDamagedRow 
                          ? 'bg-rose-50/70 border-l-4 border-l-red-500 border-rose-200' 
                          : isReady 
                            ? 'bg-emerald-50/40 border-emerald-250' 
                            : isQuantityMissing 
                              ? 'bg-amber-50/40 border-amber-200' 
                              : 'bg-white border-gray-150 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-950 text-sm block truncate">
                          {item.sku}
                        </span>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.status === 'ok' || item.status === 'verified' || item.status === 'ready for Inventory' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.status === 'quantity missing' || item.status === 'missing at qc' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          item.status === 'requires review' || item.status === 'requires review at qc' ? 'bg-rose-50 text-rose-750 border border-rose-200' :
                          item.status === 'requires recovery review' ? 'bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20' :
                          'bg-slate-100 text-slate-605'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-slate-950 text-sm">{item.quantity_count}</span>
                            <span className="text-slate-400 text-xs">/</span>
                            <span className="text-[#FF6700] text-[10px] font-semibold bg-[#FF6700]/10 border border-[#FF6700]/25 px-1.5 py-0.5 rounded">
                              ? Blind Target
                            </span>
                          </div>
                          {item.has_hidden_damaged && (
                            <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 mt-1">
                              Has Damaged Items
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Active highlight state alert text using yellow accent state color */}
                    {isActiveHighlight && (
                      <div className="mt-2 text-[10px] font-extrabold text-[#7c7400] bg-[#FFF700] px-2.5 py-1 rounded border border-yellow-350 flex items-center gap-1 animate-pulse uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                        Scanning Validation Highlight Flag
                      </div>
                    )}
                  </div>
                );
              })}

              {skuList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Package className="w-12 h-12 text-slate-205 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider">No SKUs loaded in handover</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: 60% ACTIVE MONITOR */}
          <div className="lg:col-span-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6 flex flex-col justify-between min-h-[500px]">
            <div className="space-y-6">
              {/* Header block */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider block">Active QC Monitor</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active scan validation workstation desk</p>
                </div>
                
                {lastScannedSku && (
                  <div className="px-2.5 py-1 bg-[#FFF700] border border-amber-305 text-slate-950 font-extrabold text-[10px] rounded tracking-wider uppercase animate-fade-in flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-700 animate-ping inline-block"></span>
                    WORKSTATION: {lastScannedSku}
                  </div>
                )}
              </div>

              {/* Barcode Form Workspace */}
              <div className="bg-slate-50 border border-gray-202 rounded-lg p-4">
                <label htmlFor="sku-scan-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                  Scan / Register Hard Label
                </label>
                <form onSubmit={handleScanSubmit} className="flex gap-2 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      id="sku-scan-input"
                      type="text"
                      placeholder="Laser-scan or code-type SKU barcode..."
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 hover:border-gray-350 focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                    />
                  </div>
                  <button
                    id="sku-scan-submit-btn"
                    type="submit"
                    disabled={loadingSku}
                    className="px-5 py-2 bg-[#FF6700] hover:bg-[#E05300] text-white text-sm font-bold rounded-lg shrink-0 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {loadingSku ? 'Scanning...' : 'Verify Scan'}
                  </button>
                </form>
              </div>

              {/* Barcode scan response message log with yellow highlight background if warning */}
              {scanMessage && (
                <div 
                  id="scan-notification-banner"
                  className={`p-4 rounded-lg border text-sm flex items-start justify-between ${
                    scanMessage.type === 'success' 
                      ? 'bg-emerald-50 border-emerald-205 text-emerald-800' 
                      : scanMessage.type === 'warning' 
                        ? 'bg-[#FFF700]/25 border-yellow-350 text-slate-900 shadow-sm' 
                        : 'bg-rose-50 border-rose-205 text-rose-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${
                      scanMessage.type === 'success' ? 'text-emerald-600' :
                      scanMessage.type === 'warning' ? 'text-amber-800' : 'text-rose-605'
                    }`} />
                    <div>
                      <span className="font-extrabold text-[11px] uppercase block tracking-wider">
                        {scanMessage.type === 'success' ? 'Validation Ok' : scanMessage.type === 'warning' ? 'Warning Check Required' : 'Scan Refused'}
                      </span>
                      <p className="text-xs font-bold mt-0.5">{scanMessage.text}</p>
                    </div>
                  </div>
                  <button onClick={() => setScanMessage(null)} className="p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Workstation Action Desk */}
              <div className="bg-slate-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <span className="text-xs font-bold text-slate-705 uppercase tracking-wider block border-b border-gray-200 pb-2">
                  Active Workstation Action Deck
                </span>
                
                {lastScannedSku ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Selected Active SKU</span>
                        <span className="font-mono text-slate-905 font-extrabold text-base block">{lastScannedSku}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-50 rounded text-[10px] font-extrabold uppercase text-amber-700 border border-amber-200 animate-pulse">
                        WIP Checked Focus
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-normal">
                      Perform visual inspection inside the physical container. If product, container packaging, or barcode labels suffer retail damage flag here.
                    </p>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowDamageConfirm(lastScannedSku)}
                        className="px-4 py-2 bg-[#FF6700] hover:bg-[#E05300] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm shadow-orange-100"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-white" />
                        Flag SKU as Damaged
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    No active SKU focus loaded at workstation. Please scan a barcode to initialize triaging controls.
                  </div>
                )}
              </div>
            </div>

            {/* Reconciliation and Handover trigger button */}
            <div className="pt-5 mt-6 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                * Conclude standard handover once all counted SKU targets are reached.
              </span>
              <button
                id="btn-handover-complete"
                disabled={isReconciling || skuList.length === 0}
                onClick={handleHandoverCompleteClick}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-4.5 h-4.5 text-white" />
                {isReconciling ? 'Reconciling Batch...' : 'Handover Complete'}
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* CONFIRMATION POPUP FOR ITEM DAMAGED BUTTON */}
      {showDamageConfirm && (
        <div id="damage-confirmation-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white border border-gray-202 rounded-xl max-w-md w-full p-6 relative shadow-2xl animate-in scale-in">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#FF6700]" />
              Confirm Integrity Violation?
            </h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed font-semibold">
              You are about to declare a physical product damage violation for SKU <strong className="font-mono text-white bg-slate-900 rounded px-1.5 py-0.5">{showDamageConfirm}</strong>. 
              This will update all associated items to 'requires review at qc' and highlight current batches in red.
            </p>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-150">
              <button
                onClick={() => setShowDamageConfirm(null)}
                className="px-4 py-2 bg-slate-105 hover:bg-slate-200 text-xs sm:text-sm text-slate-700 font-bold rounded-lg transition-colors"
               >
                Cancel
              </button>
              <button
                onClick={() => handleMarkDamaged(showDamageConfirm)}
                className="px-4 py-2 bg-[#FF6700] hover:bg-[#E05300] text-xs sm:text-sm text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                Yes, Flag Damage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HANDOVER COMPLETE RECONCILIATION MODAL */}
      {showReconciliationConfirm && (
        <div id="reconciliation-confirmation-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 relative shadow-2xl animate-in scale-in">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Discrepancy Bypass?
            </h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              There are <strong className="text-amber-600 text-base">{showReconciliationConfirm.totalMissing}</strong> products left missing compared to the expected target. Are you sure you want to proceed?
            </p>
            <p className="text-slate-500 text-xs mt-2 font-semibold">
              If you proceed, any shorted or unscanned batch elements will automatically be updated to 'missing at qc'.
            </p>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-150">
              <button
                onClick={() => setShowReconciliationConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-202 text-xs sm:text-sm text-slate-705 font-bold rounded-lg transition-colors"
              >
                Cancel & Count
              </button>
              <button
                onClick={() => handleHandoverComplete(true)}
                className="px-4 py-2 bg-[#FF6700] hover:bg-[#E05300] text-xs sm:text-sm text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: RECOVERY INTEGRITY CHECK */}
      <section id="section-recovery-integrity" className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <span className="text-xs font-bold text-[#FF6700] tracking-widest uppercase">Process 02</span>
          <h2 className="text-xl font-extrabold text-slate-950 mt-1">Recovery Integrity Check</h2>
          <p className="text-slate-505 text-xs sm:text-sm mt-1">
            Detect mismatched packaging types. Flag items that are wrapped in standard retail packaging, even though they should use custom refurbished materials.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg shadow-xs">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">LPN Identifier</th>
                <th className="py-3.5 px-4">SKU Code</th>
                <th className="py-3.5 px-4">Damage Profile</th>
                <th className="py-3.5 px-4">Packaging Box Check</th>
                <th className="py-3.5 px-4 text-center font-bold">Audit Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-sm">
              {recoveredItems.map((item) => {
                const requiresRefurbContainer = item.is_refurbished;
                const statusTag = item.item_status;
                
                return (
                  <tr key={item.lpn} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[#FF6700] font-bold">{item.lpn}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-905">{item.sku}</td>
                    <td className="py-3.5 px-4 capitalize text-slate-630 font-medium">{item.damage_type.replace('_', ' ')}</td>
                    <td className="py-3.5 px-4">
                      {requiresRefurbContainer ? (
                        <div className="flex flex-col">
                          <span className="text-amber-700 font-extrabold flex items-center gap-1 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Original Box Detected
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">Should use: Refurbished Box Container</span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-extrabold text-xs">Refurbished Packaging OK</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                        statusTag === 'requires recovery review' ? 'bg-amber-50 text-amber-700 border-amber-250' :
                        'bg-emerald-50 text-emerald-700 border-emerald-250'
                      }`}>
                        {statusTag.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRecoveryReview(item.lpn)}
                        className="px-3.5 py-1.5 bg-white text-[#FF6700] hover:bg-[#FF6700]/5 border border-[#FF6700]/25 text-xs font-bold rounded-lg transition-all"
                      >
                        Requires Recovery Review
                      </button>
                    </td>
                  </tr>
                );
              })}
              {recoveredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs font-medium">
                    No recovered elements found or matching 'recovered' state in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: REJECTED CLAIMS VERIFICATION */}
      <section id="section-rejected-claims" className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <span className="text-xs font-bold text-[#FF6700] tracking-widest uppercase">Process 03</span>
          <h2 className="text-xl font-extrabold text-slate-950 mt-1">Rejected Claims Verification</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Audit case decisions directly. Expand items to inspect drive evidence photos inline and make corrective routing updates.
          </p>
        </div>

        {/* CLAIMS VERIFICATION LIST */}
        <div id="rejected-claims-accordion" className="mt-6 space-y-4">
          {rejectedClaims.map((claim) => {
            const isExpanded = expandedClaim === claim.orderId;
            return (
              <div 
                key={claim.orderId}
                className={`border rounded-lg transition-all duration-350 ${
                  isExpanded ? 'bg-slate-50/50 border-gray-300 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedClaim(isExpanded ? null : claim.orderId)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{claim.orderId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">REJECTED</span>
                      <span className="text-xs text-slate-400 font-semibold">{claim.channel}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800 truncate max-w-lg">
                      {claim.productName}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    <div className="text-right text-xs">
                      <span className="text-slate-400 block font-extrabold text-[9px] uppercase tracking-wider">SKU Code</span>
                      <span className="font-mono text-slate-800 font-bold block">{claim.sku}</span>
                    </div>
                    <div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 sm:p-6 bg-white rounded-b-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Left Column: Embed Live view IFrame */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold text-[#7c7400] bg-[#FFF700] px-2 py-0.5 rounded border border-yellow-350 tracking-widest block font-bold w-max uppercase mb-2">
                          Embedded Evidence Explorer (Drive Document)
                        </label>
                        <div className="relative w-full h-[320px] bg-slate-100 border border-gray-200 rounded-lg overflow-hidden shadow-inner">
                          <iframe
                            src={claim.driveLink}
                            className="absolute inset-0 w-full h-full border-0 rounded-lg"
                            title={`Drive Evidence Explorer for ${claim.sku}`}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                          <span className="truncate max-w-[200px]">Evidence URL: {claim.driveLink}</span>
                          <a 
                            href={claim.driveLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[#FF6700] hover:underline flex items-center gap-1 font-bold"
                          >
                            Open in New Tab <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Right Column: Actions Control */}
                      <div className="flex flex-col justify-between">
                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Automation System Failure Reason</span>
                            <p className="text-xs sm:text-sm text-slate-705 bg-slate-50 border border-gray-150 p-4 rounded-lg mt-1.5 leading-relaxed italic">
                              "{claim.botLogReason || 'No descriptive failure log snippet detected.'}"
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Audit Instructions</span>
                            <p className="text-xs text-slate-450 mt-1.5 leading-relaxed font-semibold">
                              Compare the uploaded LPN parcel condition against retail box requirements. If packaging was accurate, mark this as an <strong>Inspection Mistake</strong> to trigger a system re-evaluation. Or, select <strong>No Issue</strong> if the dismissal was correct.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6 lg:mt-0 pt-4 border-t border-gray-150">
                          <button
                            onClick={() => handleClaimStatusUpdate(claim.orderId, 'No Issue')}
                            className="flex-1 py-2.5 bg-slate-105 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold border border-gray-200 rounded-lg transition-colors"
                          >
                            No Issue (Correct Rejection)
                          </button>
                          <button
                            onClick={() => handleClaimStatusUpdate(claim.orderId, 'Inspection Mistake')}
                            className="flex-1 py-2.5 bg-[#FF6700] hover:bg-[#E05300] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-colors"
                          >
                            Inspection Mistake (Re-evaluation)
                          </button>
                        </div>

                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rejectedClaims.length === 0 && (
            <div className="py-12 border border-dashed border-gray-205 rounded-lg text-center text-slate-400 text-xs sm:text-sm">
              No rejected claims found or pending verification. Compliance rates are optimal.
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: RE-INVENTORISATION (FUTURE PLACEHOLDER) */}
      <section id="section-re-inventorisation" className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Re-Inventorisation</h2>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-tight">Automated synchronization back directly towards live stock management pipelines.</p>
        
        <div className="mt-4 p-6 bg-slate-50 border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-white border border-gray-150 rounded-xl flex items-center justify-center mb-3 shadow-xs font-semibold">
            <Package className="w-6 h-6 text-[#FF6700]" />
          </div>
          <span className="text-sm font-extrabold text-slate-800">Module coming soon: Inventory sync engine pending release.</span>
          <p className="text-xs text-slate-400 max-w-sm mt-1 leading-normal font-semibold">
            Future release will hook directly with centralized warehouse inventory databases for rapid stock cataloging.
          </p>
        </div>
      </section>

    </div>
  );
}
