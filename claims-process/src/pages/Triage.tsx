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
  Bot
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Claim } from '../types';

interface GroupedClaim extends Claim {
  uniqueKey: string;
  issues: {
    qty?: number;
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

    fetch('/api/claims')
      .then(res => res.json())
      .then(data => {
        setClaims(data);
        setLoading(false);
      });
    
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (claim: GroupedClaim) => {
    const issuesText = claim.issues.map((i: any) => `- Qty: ${i.qty ?? 1} [${i.type}]: ${i.reason}`).join('\n');
    const bundle = `
Order ID: ${claim.orderId}
SKU: ${claim.sku}
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
    // Group by Tracking ID + SKU as requested
    const key = `${c.trackingId || 'N/A'}-${c.sku}`;
    
    // In our backend, we now return a 'qty' field which is the count of rows
    // If it's already grouped on server, acc[key] might already exist
    // But let's assume we might still get multiple records or want to be safe
    
    // Note: the backend grouping already summed up into 'qty'
    // If the frontend receives grouped results, we just use them.
    // If it receives individual rows, we group them here.
    
    if (!acc[key]) {
      acc[key] = { 
        ...c, 
        uniqueKey: key,
        issues: [{ 
          qty: (c as any).qty || 1, // Use backend qty if available, else 1
          type: c.type, 
          condition: c.condition, 
          reason: c.reason 
        }] 
      } as GroupedClaim;
    } else {
      // If we are double-grouping, we might want to avoid adding the same issue again
      // if it's already represented in the backend qty.
      // But for simplicity, we'll just treat it as a stream.
      const existing = (acc[key] as GroupedClaim);
      
      // If the item came in with its own qty > 1, we add it. 
      // If we are grouping raw rows here, we add them to the first issue or keep unique issues.
      const issueIdx = existing.issues.findIndex(i => i.type === c.type && i.condition === c.condition);
      if (issueIdx > -1) {
        existing.issues[issueIdx].qty = (existing.issues[issueIdx].qty || 0) + ((c as any).qty || 1);
      } else {
        existing.issues.push({ 
          qty: (c as any).qty || 1, 
          type: c.type, 
          condition: c.condition, 
          reason: c.reason 
        });
      }
    }
    return acc;
  }, {} as Record<string, GroupedClaim>);

  const groupedClaimsList: GroupedClaim[] = Object.values(groupedClaimsRaw);

  const filteredClaims = groupedClaimsList.filter(c => {
    // Check if any issue matches the filters
    const validIssues = c.issues.filter((issue: any) => {
      const condition = issue.condition?.toLowerCase();
      const typeLower = (issue.type || "").toLowerCase();
      if (condition === 'good' && typeLower !== 'rejecteddelivery' && typeLower !== 'rejected' && typeLower !== 'missing') {
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
              ) : filteredClaims.map((claim) => (
                <tr key={claim.uniqueKey} className="hover:bg-slate-50/50 transition-colors group">
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
                      </div>
                      <span className="text-xs font-mono font-bold text-[#313079] tracking-tighter">{claim.orderId}</span>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 rounded-sm w-fit">TRK: {claim.trackingId}</span>
                        <span className="text-[8px] font-bold text-indigo-600">GROUPED QTY: {claim.qty}</span>
                      </div>
                    </div>
                  </td>

                  {/* C2: Inventory Details */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-[#313079]">{claim.sku}</span>
                         <span className="text-[9px] font-semibold text-slate-400">({claim.fnsku})</span>
                      </div>
                      <div className="space-y-1.5 mt-1">
                        {claim.issues?.map((issue: any, idx: number) => (
                          <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-extrabold text-[#FF6700]">Qty: {issue.qty}</span>
                              <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">{issue.type}</span>
                            </div>
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1 rounded-sm w-fit",
                              issue.condition === 'damaged' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                            )}>
                              {issue.condition}
                            </span>
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
                    {claim.driveLink ? (
                      <a 
                        href={claim.driveLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-[9px] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        VIEW EVIDENCE
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-300 italic">No evidence link</span>
                    )}
                  </td>

                  {/* C5: SLA / Status */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 w-24">
                       <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest text-center border",
                          claim.status === 'Resolved' ? "bg-green-50 text-green-600 border-green-100" :
                          claim.status === 'Escalated' ? "bg-red-50 text-red-600 border-red-100" :
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
                                        orderId: claim.orderId,
                                        claimId: claim.claimId,
                                        lpn: claim.lpn
                                      })
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                      alert(`Bot triggered for Order ${claim.orderId}! Check Smart Filing Hub.`);
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
                        onClick={() => handleCopy(claim)}
                        className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all text-[#FF6700] shrink-0"
                      >
                        {copiedId === claim.uniqueKey ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
