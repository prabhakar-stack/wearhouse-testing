import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  Package, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  Box, 
  Database,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecoveryItem {
  lpn: string;
  sku: string;
  damageType: 'Barcode Damaged' | 'Packaging Damaged';
  isRefurbished?: boolean;
  status: 'recovery' | 'recovered' | 'damaged' | 'requires review at recovery';
}

export default function RecoveryHubTab() {
  const [inputValue, setInputValue] = useState('');
  const [batch, setBatch] = useState<RecoveryItem[]>([]);
  const [activeLpn, setActiveLpn] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [screenshotTimestamp, setScreenshotTimestamp] = useState(() => Date.now());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [usingRefurbishedBox, setUsingRefurbishedBox] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitorActive, setIsMonitorActive] = useState(false);
  const [monitorSearchValue, setMonitorSearchValue] = useState('');
  const [showDamageConfirm, setShowDamageConfirm] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [unscannedCount, setUnscannedCount] = useState(0);

  // Clear alerts after 4 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputValue.trim();
    if (!cleanInput) return;

    // Regexp check: If starts with LPN and numbers/letters, classify as LPN, otherwise SKU
    const isLpn = /^LPN[A-Za-z0-9]+$/.test(cleanInput);
    const classification = isLpn ? 'LPN' : 'SKU';

    console.log(`[Scanner] Input "${cleanInput}" classified as: ${classification}`);

    // Check if item already exists in the local React batch state array (first scan vs second scan)
    const existingIndex = batch.findIndex(item => 
      item.lpn.toLowerCase() === cleanInput.toLowerCase() || 
      item.sku.toLowerCase() === cleanInput.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Scanned a second time! 
      if (isMonitorActive) {
        const targetItem = batch[existingIndex];
        if (targetItem.status === 'recovered') {
          setAlertMessage(`Item "${targetItem.lpn}" is already recovered.`);
        } else if (targetItem.status === 'damaged') {
          setAlertMessage(`Item "${targetItem.lpn}" is already marked as damaged.`);
        } else {
          setActiveLpn(targetItem.lpn);
          setUsingRefurbishedBox(!!targetItem.isRefurbished);
          setSuccessMessage(`Loaded "${targetItem.lpn}" at active workstation.`);
        }
      } else {
        setAlertMessage("Item is already in the handover batch. Click 'Handover complete' to unlock physical triaging updates.");
      }
      setInputValue('');
      return;
    }

    // First scan - check database/Supabase
    setIsLoading(true);
    try {
      const response = await fetch(`/api/recovery/query?search=${encodeURIComponent(cleanInput)}`);
      if (!response.ok) {
        setAlertMessage("Item not found in expected recovery pool");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const statusFromDb = (data.status || '').trim().toLowerCase();
      if (statusFromDb !== 'recovery') {
        setAlertMessage(`Only items with "recovery" status can be included in the handover batch. (Current status: "${data.status || 'unknown'}")`);
        setIsLoading(false);
        setInputValue('');
        return;
      }

      const mappedItem: RecoveryItem = {
        lpn: data.lpn,
        sku: data.sku,
        damageType: data.damageType === 'Packaging Damaged' || data.damage_type === 'Packaging Damaged' || data.damageType === 'box_damage' || data.damage_type === 'box_damage' ? 'Packaging Damaged' : 'Barcode Damaged',
        isRefurbished: !!(data.isRefurbished || data.is_refurbished),
        status: 'recovery'
      };

      // Add to local state array
      setBatch(prev => [...prev, mappedItem]);
      setSuccessMessage(`Scanned: Added ${mappedItem.lpn} (${mappedItem.sku}) to hand-over batch.`);
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to query database");
    } finally {
      setIsLoading(false);
      setInputValue('');
    }
  };

  const handleHandoverComplete = async () => {
    if (batch.length === 0) {
      setAlertMessage("Please scan/add at least default hand-over items to the batch before concluding the handover phase!");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/recovery/reconcile-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scannedLpns: batch.map(item => item.lpn)
        })
      });

      if (!response.ok) {
        throw new Error("Reconciliation check failed");
      }

      const data = await response.json();
      if (data.unscannedCount > 0) {
        setUnscannedCount(data.unscannedCount);
        setShowReconcileModal(true);
      } else {
        await finalizeHandover();
      }
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to perform reconciliation check");
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeHandover = async () => {
    try {
      setIsLoading(true);
      const tempResponse = await fetch('/api/recovery/reconcile-finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scannedLpns: batch.map(item => item.lpn)
        })
      });

      if (!tempResponse.ok) {
        throw new Error("Fallback mutation failed");
      }

      setIsMonitorActive(true);
      setSuccessMessage("Handover completed successfully! ACTIVE RECOVERY WORKSTATION MONITOR is now unlocked.");
      setShowReconcileModal(false);
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to finalize handover status updates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonitorSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearch = monitorSearchValue.trim().toLowerCase();
    if (!cleanSearch) return;

    const foundItem = batch.find(item => 
      item.lpn.toLowerCase() === cleanSearch || 
      item.sku.toLowerCase() === cleanSearch
    );

    if (foundItem) {
      if (foundItem.status === 'recovered') {
        setAlertMessage(`Item "${foundItem.lpn}" is already recovered.`);
      } else if (foundItem.status === 'damaged') {
        setAlertMessage(`Item "${foundItem.lpn}" is already marked as damaged.`);
      } else {
        setActiveLpn(foundItem.lpn);
        setUsingRefurbishedBox(!!foundItem.isRefurbished);
        setSuccessMessage(`Workstation active: Loaded "${foundItem.lpn}"`);
      }
    } else {
      setAlertMessage("Scanned item is not in the current handover batch. Register it in the Handover Deck first!");
    }
    setMonitorSearchValue('');
  };

  const handlePersistRecovery = async () => {
    if (!activeLpn) return;
    const activeItem = batch.find(item => item.lpn === activeLpn);
    if (!activeItem) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/recovery/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lpn: activeItem.lpn,
          sku: activeItem.sku,
          damageType: activeItem.damageType,
          isRefurbished: activeItem.damageType === 'Packaging Damaged' ? usingRefurbishedBox : false,
          status: 'recovered'
        })
      });

      if (!response.ok) {
        throw new Error("Update mutation failed");
      }

      // Mark the item row as green and update the status in local batch list
      setBatch(prev => prev.map(item => {
        if (item.lpn === activeLpn) {
          return {
            ...item,
            status: 'recovered',
            isRefurbished: activeItem.damageType === 'Packaging Damaged' ? usingRefurbishedBox : item.isRefurbished
          };
        }
        return item;
      }));

      setSuccessMessage(`✅ Item ${activeItem.lpn} successfully recovered! Database synchronized.`);
      setActiveLpn(null);
      setUsingRefurbishedBox(false);
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to save recovery parameters to database");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDamaged = async () => {
    if (!activeLpn) return;
    const activeItem = batch.find(item => item.lpn === activeLpn);
    if (!activeItem) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/recovery/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lpn: activeItem.lpn,
          sku: activeItem.sku,
          damageType: activeItem.damageType,
          isRefurbished: activeItem.damageType === 'Packaging Damaged' ? usingRefurbishedBox : false,
          status: 'requires review at recovery'
        })
      });

      if (!response.ok) {
        throw new Error("Update mutation failed");
      }

      // Mark the item row as red and status as damaged in local state list
      setBatch(prev => prev.map(item => {
        if (item.lpn === activeLpn) {
          return {
            ...item,
            status: 'damaged',
            isRefurbished: activeItem.damageType === 'Packaging Damaged' ? usingRefurbishedBox : item.isRefurbished
          };
        }
        return item;
      }));

      setSuccessMessage(`✅ Item ${activeItem.lpn} marked as DAMAGED. Switched status to 'requires review at recovery'.`);
      setActiveLpn(null);
      setUsingRefurbishedBox(false);
      setShowDamageConfirm(false);
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to save damaged status to database");
    } finally {
      setIsLoading(false);
    }
  };

  const activeItem = batch.find(item => item.lpn === activeLpn);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-900 bg-[#FFF700] px-2 py-0.5 rounded tracking-wider uppercase">Beta Module</span>
            <span className="text-xs font-semibold text-slate-400">Claims Administration Panel</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Recovery Hub Workstation</h2>
          <p className="text-slate-400 text-xs font-medium mt-1">
            Perform physical refurbishment triage of items suffering from retail damage state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 px-4 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-xs font-bold text-[#FFF700] gap-2">
            <Database className="w-4 h-4 text-[#FFF700]" />
            SUPABASE LIVE
          </div>
        </div>
      </div>

      {/* Dynamic Alerts Banner */}
      <AnimatePresence mode="wait">
        {alertMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#FF4C4C] text-white p-4 rounded-2xl flex items-center gap-3 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-extrabold text-sm uppercase tracking-wide">Error: {alertMessage}</span>
          </motion.div>
        )}

        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#22c55e] text-white p-4 rounded-2xl flex items-center gap-3 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-extrabold text-sm uppercase tracking-wide">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner Input Dashboard */}
      <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <h3 className="text-sm font-extrabold text-[#313079] mb-3 flex items-center gap-2">
          <Scan className="w-4 h-4 text-[#FF6700]" />
          BARCODE & BOX SCANNING WORKSTATION DECK
        </h3>
        
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <form onSubmit={handleScanSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Scan className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6700] focus:border-transparent transition-all"
                placeholder="Scan/Type LPN Barcode (e.g., LPN001) or SKU item (e.g., 1120100)..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-slate-950 text-white rounded-2xl text-xs font-extrabold tracking-wider hover:bg-black transition-colors shrink-0 shadow-sm flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              SUBMIT SCAN
            </button>
          </form>

          {!isMonitorActive ? (
            <button
              type="button"
              onClick={handleHandoverComplete}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-extrabold tracking-wider transition-all shrink-0 hover:translate-y-[1px] shadow-sm flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
              HANDOVER COMPLETE
            </button>
          ) : (
            <div className="px-5 py-3 bg-green-50 text-green-700 border border-green-200 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shrink-0">
              <CheckCircle className="w-4.5 h-4.5 text-green-600 shrink-0" />
              <span>HANDOVER RUN COMPLETED</span>
            </div>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-400 font-bold tracking-tight uppercase">
          💡 Pro-tip: Enter LPNs/SKUs to append them to the batch queue. Click the green &apos;Handover complete&apos; button to activate structural &amp; barcode triage controls.
        </p>
      </div>

      {/* main split view panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left column (40% space roughly: lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#313079]">HANDED OVER BATCH</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">Buffered scans for workstation triage</p>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
              {batch.length} ITEMS
            </span>
          </div>

          <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
            {batch.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 p-6 space-y-3">
                <Package className="w-12 h-12 text-slate-200" />
                <p className="text-sm font-bold tracking-tight text-center">Batch is currently empty</p>
                <p className="text-xs text-center max-w-[200px]">Scan identifiers above to build the current active batch schedule.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-[#313079]">
                    <th className="py-3 px-4">LPN</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Box Refurb?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {batch.map((item, idx) => {
                    // Determine styling based on active state or recovered state
                    const isActive = item.lpn === activeLpn;
                    const isRecovered = item.status === 'recovered';
                    const isDamaged = item.status === 'damaged';

                    let rowClass = "transition-all duration-200 ";
                    if (isDamaged) {
                      // plain Red to flag the broken product status visually, plus crossed-out text format
                      rowClass += "bg-[#ef4444] text-white font-bold line-through hover:bg-[#dc2626]";
                    } else if (isActive) {
                      // yellow background background (#FFF700)
                      rowClass += "bg-[#FFF700] text-black font-extrabold border-y-2 border-black";
                    } else if (isRecovered) {
                      // mark row as green
                      rowClass += "bg-green-50 text-green-800 line-through opacity-85 hover:bg-green-100";
                    } else {
                      // At the start of the batch, all rows look greyed out
                      rowClass += "opacity-60 bg-slate-100/60 hover:opacity-100 hover:bg-slate-50";
                    }

                    return (
                      <tr 
                        key={idx} 
                        className={rowClass}
                      >
                        <td className="py-3.5 px-4 text-xs font-mono font-bold tracking-tight">
                          <div className="flex items-center gap-2">
                            {isRecovered && <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                            {isDamaged && <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0 animate-pulse" />}
                            {item.lpn}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono">{item.sku}</td>
                        <td className="py-3.5 px-4 text-[10px] uppercase font-bold tracking-wider">
                          <span className={`px-2 py-0.5 rounded-full ${
                            isDamaged
                              ? 'bg-red-800 text-white border border-red-700'
                              : item.damageType === 'Packaging Damaged' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {item.damageType === 'Packaging Damaged' ? 'packaging damage' : 'barcode damage'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-center">
                          {item.damageType === 'Packaging Damaged' ? (
                            item.isRefurbished || (isActive && usingRefurbishedBox) ? (
                              <span className="text-green-600 font-extrabold text-[10px] tracking-tight uppercase">REFURB</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : (
                            <span className="text-slate-300">N/A</span>
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

        {/* Right column (60% space roughly: lg:col-span-6) */}
        <div className="lg:col-span-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-sm font-extrabold text-[#313079] uppercase">ACTIVE RECOVERY WORKSTATION MONITOR</h3>
            <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">Interactive mechanical instructions & update persistence deck</p>
          </div>

          {!isMonitorActive ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 space-y-4">
              <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-amber-500 animate-pulse" />
              </div>
              <div className="text-center max-w-sm space-y-2">
                <h4 className="text-sm font-extrabold text-[#313079] uppercase">MONITOR LOCKED</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  The active triage monitor is offline. Scan received items into the Handover Deck first, then click <strong className="text-slate-600">&quot;Handover complete&quot;</strong> to enable the workstation triaging monitor.
                </p>
              </div>
            </div>
          ) : activeItem ? (
            <div className="flex-1 flex flex-col justify-between space-y-6">
              {/* Prominent display of damage type at the top of 60% right column */}
              <div className="p-5 bg-slate-950 text-white rounded-2xl flex items-center justify-between border-2 border-black">
                <div>
                  <span className="text-[9px] font-extrabold tracking-widest text-[#FFF700] uppercase block mb-1">Active Inspected Item</span>
                  <p className="text-sm font-bold font-mono tracking-wider">{activeItem.lpn} ({activeItem.sku})</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase text-black ${
                  activeItem.damageType === 'Packaging Damaged' ? 'bg-sky-400' : 'bg-amber-400'
                }`}>
                  {activeItem.damageType === 'Packaging Damaged' ? 'PACKAGING DAMAGE DETECTED' : 'BARCODE DAMAGE DETECTED'}
                </div>
              </div>
 
              {/* Center of 60% Screen (Instructions Node) */}
              <div className="flex-1 p-6 bg-slate-50 border border-slate-200/60 rounded-2xl flex flex-col justify-center space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <HelpCircle className="w-5 h-5 text-[#313079]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#313079] uppercase tracking-wider">Mechanical Recovery Action Plan</h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Follow steps on work deck and log when complete</p>
                  </div>
                </div>
 
                <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-3 shadow-inner">
                  {activeItem.damageType === 'Barcode Damaged' ? (
                    <div className="space-y-3">
                      <div className="flex gap-2 text-xs font-bold text-slate-800">
                        <Printer className="w-4 h-4 text-[#FF6700]" />
                        <span>RE-PRINT AND APPLY BARCODE LABEL:</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        1. Place the retail item on the scale print surface.<br />
                        2. Verify SKU is <span className="font-bold underline">{activeItem.sku}</span>.<br />
                        3. Click print button on physical printer to generate a clean SKU sticker.<br />
                        4. Carefully inspect and peel the generated barcode, and paste it directly over the damaged LPN barcode spot.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2 text-xs font-bold text-slate-800">
                        <Box className="w-4 h-4 text-[#FF6700]" />
                        <span>STRUCTURAL RE-TAP / REPLACEMENT STEPS:</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        1. Inspect structural safety of packaging. Remove dynamic debris.<br />
                        2. Apply industrial transparent tape along standard structural box joints.<br />
                        3. If box structure has buckled completely, discard old board and repack into a fresh refurbished box.<br />
                        4. Tick the checkpoint option if a replacement refurbished retail package was used.
                      </p>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <label className="text-xs font-bold text-[#313079]" htmlFor="refurbished-toggle">
                          Using Refurbished Box
                        </label>
                        <input
                          id="refurbished-toggle"
                          type="checkbox"
                          checked={usingRefurbishedBox}
                          onChange={(e) => setUsingRefurbishedBox(e.target.checked)}
                          className="w-4 h-4 rounded text-green-600 border-slate-305 focus:ring-green-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom of 60% Screen (Action Controls) */}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-colors"
                  onClick={() => {
                    setActiveLpn(null);
                    setUsingRefurbishedBox(false);
                  }}
                  disabled={isLoading}
                >
                  Close Monitor
                </button>
                <button
                  type="button"
                  style={{ backgroundColor: '#FF6700' }}
                  className="flex-2 py-3 text-white hover:bg-opacity-90 text-xs font-extrabold tracking-wider uppercase transition-all rounded-xl shadow-md"
                  onClick={() => setShowDamageConfirm(true)}
                  disabled={isLoading}
                >
                  Item Damaged
                </button>
                <button
                  type="button"
                  className="flex-3 py-3 bg-slate-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-[#FFF700] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs font-extrabold tracking-widest uppercase transition-all rounded-xl"
                  onClick={handlePersistRecovery}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      PERSISTING TO SUPABASE...
                    </span>
                  ) : activeItem.damageType === 'Barcode Damaged' ? (
                    "Barcode Changed"
                  ) : (
                    "Box Changed"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-6 py-8">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-[#FFF700]/15 border-2 border-dashed border-[#FFF700] rounded-3xl flex items-center justify-center text-[#313079] shadow-sm">
                  <Scan className="w-7 h-7 animate-pulse text-slate-900" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#313079] uppercase tracking-wide">Workstation Standby</h4>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Scan or search for a pending LPN or SKU from your Handed-over Batch here to put it in-progress (yellow) and display instructions.
                  </p>
                </div>
              </div>

              {/* Triage Search Form inside Standby Monitor */}
              <form onSubmit={handleMonitorSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Scan className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#313079] transition-all"
                    placeholder="Scan / Type LPN or SKU in Batch..."
                    value={monitorSearchValue}
                    onChange={(e) => setMonitorSearchValue(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-extrabold tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  ACTIVATE
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      {/* State-based Confirmation Modal representing Item Damaged confirmation block */}
      <AnimatePresence>
        {showDamageConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full space-y-4 text-slate-900"
            >
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="w-8 h-8 shrink-0" />
                <h3 className="text-lg font-extrabold tracking-tight uppercase animate-pulse">Confirm Item Damaged</h3>
              </div>
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                Are you sure this item is damaged? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors"
                  onClick={() => setShowDamageConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-[#FF6700] hover:bg-opacity-95 text-white rounded-xl text-xs font-extrabold tracking-wider uppercase transition-colors"
                  onClick={handleMarkDamaged}
                >
                  Confirm Damaged
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showReconcileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full space-y-4 text-slate-900"
            >
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle className="w-8 h-8 shrink-0" />
                <h3 className="text-lg font-extrabold tracking-tight uppercase">Unscanned Items Remaining</h3>
              </div>
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                There are <span className="font-extrabold text-amber-600">{unscannedCount}</span> products left unscanned from the expected recovery pool. Are you sure this is it?
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Note: Selecting &quot;Yes&quot; will automatically update the status of those missing/unscanned items to exactly &apos;missing at recovery&apos;.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors"
                  onClick={() => setShowReconcileModal(false)}
                >
                  No, Go Back
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-extrabold tracking-wider uppercase transition-colors"
                  onClick={finalizeHandover}
                  disabled={isLoading}
                >
                  {isLoading ? "Finalizing..." : "Yes, This is It"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
