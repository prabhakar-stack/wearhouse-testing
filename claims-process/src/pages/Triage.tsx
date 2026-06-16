import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertTriangle,
  Clock,
  ChevronDown,
  Search,
  Filter,
  Bot,
  ArrowLeft,
  Circle,
  Type,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Upload,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Claim } from '../types';
import ImageGenerationWorkspace from '../components/imageGeneration';

interface GroupedClaim extends Claim {
  uniqueKey: string;
  uniqueSkus?: {
    sku: string;
    fnsku: string;
    productName: string;
  }[];
  issues: {
    qty?: number;
    sku?: string;
    type: string;
    condition?: string;
    reason?: string;
  }[];
}

export default function Triage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<'All' | 'Missing' | 'Damaged' | 'RejectedDelivery' | 'Filed'>('All');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [botAvailable, setBotAvailable] = useState(true);
  const [lockedTrackingIds, setLockedTrackingIds] = useState<string[]>([]);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [isImageGenTabActive, setIsImageGenTabActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClaimsAndLocks = async () => {
    try {
      const claimsRes = await fetch('/api/claims');
      const claimsData = await claimsRes.json();
      setClaims(claimsData);
      
      const locksRes = await fetch('/api/claims/locked-sessions');
      const locksData = await locksRes.json();
      setLockedTrackingIds(locksData.lockedTrackingIds || locksData.lockedOrderIds || []);
      
      setLoading(false);
    } catch (err) {
      console.error("Fetch claims and locks failed:", err);
    }
  };

  useEffect(() => {
    const fetchBotStatus = async () => {
      try {
        const res = await fetch('/api/bot/config');
        const data = await res.json();
        setBotAvailable(data.isAvailable);
      } catch (err) {
        console.error(err);
      }
    };

    requestAnimationFrame(() => {
      fetchClaimsAndLocks();
    });
    const intervalBot = setInterval(fetchBotStatus, 10000); // Check every 10s
    const intervalLocks = setInterval(async () => {
      try {
        const res = await fetch('/api/claims/locked-sessions');
        const data = await res.json();
        setLockedTrackingIds(data.lockedTrackingIds || data.lockedOrderIds || []);
      } catch (e) {}
    }, 5000); // Check locks every 5s

    return () => {
      clearInterval(intervalBot);
      clearInterval(intervalLocks);
    };
  }, []);

  const handleCopy = (claim: GroupedClaim) => {
    const issuesText = claim.issues.map((i: any) => `- Qty: ${i.qty ?? 1} [${i.type}]: ${i.reason}`).join('\n');
    const skusText = claim.uniqueSkus ? claim.uniqueSkus.map((s: any) => s.sku).join(', ') : claim.sku;
    const bundle = `
Order ID: ${claim.orderId}
SKUs: ${skusText}
Issues:
${issuesText}
Evidence: ${claim.driveLink || 'N/A'}
    `.trim();
    
    navigator.clipboard.writeText(bundle);
    setCopiedId(claim.uniqueKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Grouped Claims Logic
  const groupedClaimsRaw = claims.reduce((acc, c) => {
    // Group strictly by trackingId as requested
    const key = c.trackingId || c.orderId || c.lpn || 'N/A';
    const normalizedKey = key.toLowerCase();
    
    if (!acc[normalizedKey]) {
      acc[normalizedKey] = { 
        ...c, 
        uniqueKey: key, // Keep original casing
        uniqueSkus: [{
          sku: c.sku || '',
          fnsku: c.fnsku || '',
          productName: c.productName || ''
        }],
        qty: (c as any).qty || 1,
        issues: [{ 
          qty: (c as any).qty || 1, 
          sku: c.sku,
          type: c.type, 
          condition: c.type, 
          reason: c.reason 
        }] 
      } as GroupedClaim;
    } else {
      const existing = acc[normalizedKey];
      // Sum quantities for that orderId group
      existing.qty = (existing.qty || 0) + ((c as any).qty || 1);
      
      // Accumulate unique SKUs
      const skuExists = existing.uniqueSkus?.some((s: any) => s.sku === c.sku);
      if (!skuExists && c.sku) {
        existing.uniqueSkus?.push({
          sku: c.sku || '',
          fnsku: c.fnsku || '',
          productName: c.productName || ''
        });
      }
      
      // Manage unique issues
      const issueIdx = existing.issues.findIndex((i: any) => i.type === c.type && i.condition === c.type && i.sku === c.sku);
      if (issueIdx > -1) {
        existing.issues[issueIdx].qty = (existing.issues[issueIdx].qty || 0) + ((c as any).qty || 1);
      } else {
        existing.issues.push({ 
          qty: (c as any).qty || 1, 
          sku: c.sku,
          type: c.type, 
          condition: c.type, 
          reason: c.reason 
        });
      }
    }
    return acc;
  }, {} as Record<string, GroupedClaim>);

  const groupedClaimsList: GroupedClaim[] = Object.values(groupedClaimsRaw);

  const filteredClaims = groupedClaimsList.filter(c => {
    // Client-side interactive real-time search filtering
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matchOrder = c.orderId?.toLowerCase().includes(lowerSearch);
      const matchTracking = c.trackingId?.toLowerCase().includes(lowerSearch);
      const matchSkus = c.uniqueSkus?.some(s => s.sku?.toLowerCase().includes(lowerSearch)) || c.sku?.toLowerCase().includes(lowerSearch);
      if (!matchOrder && !matchTracking && !matchSkus) {
        return false;
      }
    }

    // CRITICAL TRIAGE FILTER: Items classified as 'Shopify RTO' never require claims processing
    if (c.channel === 'Shopify RTO') {
      return false;
    }

    // Check if any issue matches the filters
    const validIssues = c.issues.filter((issue: any) => {
      const typeLower = (issue.type || "").toLowerCase();
      if (typeLower === 'good' || typeLower === 'sellable') {
        return false;
      }
      return true;
    });

    if (validIssues.length === 0) return false;

    if (filter === 'All') return true;
    if (filter === 'Filed') return !!c.reimbursementId && c.status !== 'Resolved';
    
    // Check if any valid issue matches the tab filter
    return validIssues.some((issue: any) => {
      if (filter === 'Missing') return c.deliveryStatus?.toLowerCase() !== 'delivered' && c.slaDaysElapsed>=1;
      if (filter === 'Damaged') return (issue.type === 'Damaged');
      if (filter === 'RejectedDelivery') return c.deliveryStatus?.toLowerCase() === 'rejected' || issue.type === 'RejectedDelivery' || issue.type === 'Rejected';
      return issue.type === filter;
    });
  });

  const getRowBgClass = (claim: GroupedClaim) => {
    const status = (claim.status || "").trim().toLowerCase();
    if (status === "ready for claim") {
      return "bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950";
    }
    if (status === "partial" || status === "partially completed" || status === "in progress") {
      return "bg-amber-50/80 hover:bg-amber-100/80 text-amber-950";
    }
    return "bg-white hover:bg-slate-50/50";
  };

  const handleRowSelect = async (claim: GroupedClaim) => {
    const status = (claim.status || "").trim().toLowerCase();
    const trkId = claim.trackingId || claim.orderId || claim.uniqueKey;
    if (status === "ready for claim") {
      alert(`⚠️ Already Ready for Claim\n\nThis shipment (${trkId}) has already been triaged and is marked as 'Ready for claim'. The Image Generation workspace is locked for completed orders.`);
      return;
    }

    if (lockedTrackingIds.includes(trkId)) {
      alert(`⚠️ CONCURRENT WORKSPACE LOCK\n\nShipment tracking ID ${trkId} is currently being triaged in another Image Generation session. Concurrent edits are locked to prevent overwrite conflicts.`);
      return;
    }

    try {
      // Lock session
      await fetch('/api/claims/lock-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingId: trkId, orderId: claim.orderId })
      });
      
      // Open Workspace
      setActiveTrackingId(trkId);
      setIsImageGenTabActive(true);
    } catch (e: any) {
      console.error(e);
      alert("Error opening workspace: " + e.message);
    }
  };

  if (isImageGenTabActive && activeTrackingId) {
    return (
      <ImageGenerationWorkspace 
        trackingId={activeTrackingId} 
        claims={claims} 
        onClose={async (exitType) => {
          if (exitType === 'partial') {
            await fetch('/api/claims/partial-save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackingId: activeTrackingId })
            });
          } else {
            await fetch('/api/claims/ready-for-claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackingId: activeTrackingId })
            });
          }
          await fetch('/api/claims/release-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingId: activeTrackingId })
          });
          setIsImageGenTabActive(false);
          setActiveTrackingId(null);
          fetchClaimsAndLocks();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Triage Queue</h2>
        <p className="text-slate-500 text-xs lg:text-sm">Manage and escalate pending inventory claims.</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto no-scrollbar w-full lg:max-w-3xl">
          {(['All', 'Missing', 'Damaged', 'RejectedDelivery', 'Filed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "px-4 lg:px-6 py-2 text-[10px] lg:text-xs font-extrabold rounded-lg transition-all whitespace-nowrap",
                filter === t 
                  ? "bg-black text-white shadow-md shadow-black/20" 
                  : "text-slate-400 hover:text-[#313079] hover:bg-white"
              )}
            >
              {t === 'RejectedDelivery' ? 'Rejected Delivery' : t === 'Filed' ? 'Filed Claims' : t}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="relative group flex-1 lg:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#FF6700] transition-colors" />
            <input 
              type="text" 
              placeholder="Search ID, SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#313079] focus:outline-none focus:ring-2 focus:ring-black/5 w-full lg:w-72 transition-all placeholder:text-slate-300 shadow-sm"
            />
          </div>
          <button className="p-2.5 bg-[#FFF700] border border-slate-100 rounded-xl hover:brightness-95 transition-all shadow-sm shrink-0">
            <Filter className="w-4 h-4 text-[#313079]" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest leading-none">
                <th className="px-4 py-4">C1: Company & Order</th>
                <th className="px-4 py-4">C2: Inventory Details</th>
                <th className="px-4 py-4">C3: Reason Analysis</th>
                <th className="px-4 py-4">C4: Drive Link</th>
                <th className="px-4 py-4">C5: SLA / Status</th>
                <th className="px-4 py-4 text-right">C6: Reimbursement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-4 py-10 h-16 bg-slate-50/50" />
                  </tr>
                ))
              ) : filteredClaims.map((claim) => {
                const trkId = claim.trackingId || claim.orderId || claim.uniqueKey;
                const isLocked = lockedTrackingIds.includes(trkId);
                return (
                  <tr 
                    key={claim.uniqueKey} 
                    onClick={() => {
                      if (!isLocked) {
                        handleRowSelect(claim);
                      }
                    }}
                    className={cn(
                      "transition-colors group text-slate-800 border-b border-slate-100",
                      getRowBgClass(claim),
                      isLocked ? "bg-slate-100/70 hover:bg-slate-100/70 opacity-65 cursor-not-allowed text-slate-400" : "cursor-pointer"
                    )}
                  >
                    {/* C1: Company & Order */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded uppercase",
                            claim.channel.includes('B2B') ? "bg-black text-white" : "bg-blue-600 text-white"
                          )}>
                            {claim.channel}
                          </span>
                          {isLocked && (
                            <span className="flex items-center gap-1 text-[8.5px] font-extrabold text-red-600 bg-red-50 border border-red-100 px-1 py-0.2 rounded uppercase">
                              <Lock className="w-2.5 h-2.5 animate-pulse" />
                              LOCKED
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-[#313079] tracking-tighter">TRK: {claim.trackingId || 'N/A'}</span>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 rounded-sm w-fit">ORDER: {claim.orderId}</span>
                          <span className="text-[8px] font-bold text-indigo-600">GROUPED QTY: {claim.qty}</span>
                        </div>
                      </div>
                    </td>

                     {/* C2: Inventory Details */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        {/* Show up to 2 unique SKUs with fallback */}
                        {claim.uniqueSkus && claim.uniqueSkus.length > 0 ? (
                          claim.uniqueSkus.slice(0, 2).map((item: any, uIdx: number) => (
                            <div key={uIdx} className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#313079]">{item.sku ? item.sku : '()'}</span>
                              {item.fnsku && <span className="text-[9px] font-semibold text-slate-400">({item.fnsku})</span>}
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#313079]">{claim.sku ? claim.sku : '()'}</span>
                            {claim.fnsku && <span className="text-[9px] font-semibold text-slate-400">({claim.fnsku})</span>}
                          </div>
                        )}

                        {/* If more than 2 SKU, show 2 + {remaining qty} i.e. remaining count */}
                        {claim.uniqueSkus && claim.uniqueSkus.length > 2 && (
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 w-fit">
                            + {claim.uniqueSkus.length - 2} more SKU
                          </span>
                        )}

                        <div className="space-y-1.5 mt-1">
                          {claim.issues?.map((issue: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-extrabold text-[#FF6700]">Qty: {issue.qty}</span>
                                {issue.sku && <span className="text-[8.5px] font-semibold text-slate-400">[{issue.sku}]</span>}
                                <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">{issue.type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* C3: Reason Analysis */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2 max-w-[220px]">
                        {claim.issues?.map((issue: any, idx: number) => (
                          <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-2">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{issue.reason || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* C4: Drive Link */}
                    <td className="px-4 py-4">
                      {(() => {
                        const match = claims.find(c => c.orderId === claim.orderId);
                        const resolvedLink = match?.orderDriveLink || match?.driveLink || claim.orderDriveLink || claim.driveLink;
                        if (resolvedLink) {
                          return (
                            <a 
                              href={resolvedLink} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-[9px] transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              VIEW EVIDENCE
                            </a>
                          );
                        }
                        return <span className="text-[9px] text-slate-300 italic">No evidence link</span>;
                      })()}
                    </td>

                    {/* C5: SLA / Status */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 w-24">
                         <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest text-center border",
                            claim.status === 'Resolved' ? "bg-green-50 text-green-600 border-green-100" :
                            claim.status === 'Escalated' ? "bg-red-50 text-red-600 border-red-100" :
                            claim.status === 'Ready for claim' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            claim.status === 'Partial' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-slate-50 text-slate-500 border-slate-100"
                         )}>
                           {claim.status}
                         </span>
                         <div className="text-[8px] font-bold text-slate-400 text-center uppercase">Day {claim.slaDaysElapsed}</div>
                      </div>
                    </td>

                    {/* C6: Reimbursement */}
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex flex-col items-end mr-1">
                          {claim.reimbursementId ? (
                            <>
                              <span className="text-[8px] font-bold text-green-600">ID: {claim.reimbursementId}</span>
                              <span className="text-[10px] font-black text-[#FF6700]">{claim.currency} {claim.amount}</span>
                            </>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-bold text-slate-300 italic">Unfiled</span>
                              {true && (
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const res = await fetch('/api/bot/trigger', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                          trackingId: claim.trackingId || claim.uniqueKey,
                                          orderId: claim.orderId,
                                          claimId: claim.claimId,
                                          lpn: claim.lpn
                                        })
                                      });
                                      const data = await res.json();
                                      if (res.ok) {
                                        alert(`Bot triggered for Tracking ID ${claim.trackingId || claim.uniqueKey}! Check Smart Filing Hub.`);
                                      } else {
                                        alert(data.message || "Bot unavailable");
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  disabled={!botAvailable}
                                  className={cn(
                                    "text-[9px] font-black mt-0.5 flex items-center gap-1 group transition-colors",
                                    botAvailable ? "text-indigo-600 hover:text-indigo-700" : "text-slate-300 cursor-not-allowed"
                                  )}
                                >
                                  <Bot className={cn("w-3 h-3", botAvailable && "group-hover:animate-bounce")} />
                                  {botAvailable ? 'FILE WITH BOT' : 'BOT COOLING...'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(claim);
                          }}
                          className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all text-[#FF6700] shrink-0"
                        >
                          {copiedId === claim.uniqueKey ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


