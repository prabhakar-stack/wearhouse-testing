"use client";

import { useEffect, useState } from 'react';
import { ExternalLink, Video, Image as ImageIcon, AlertTriangle, Folder, FileText, Search, CheckCircle } from 'lucide-react';

export default function EvidenceTable() {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/admin/evidence')
      .then(res => res.json())
      .then(data => {
        if (data.evidence) {
          setEvidenceList(data.evidence);
          setFilteredList(data.evidence);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let list = [...evidenceList];
    
    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.lpn && item.lpn.toLowerCase().includes(q)) ||
        (item.returnItem?.sku && item.returnItem.sku.toLowerCase().includes(q)) ||
        (item.orderId && item.orderId.toLowerCase().includes(q)) ||
        (item.manifest?.trackingId && item.manifest.trackingId.toLowerCase().includes(q)) ||
        (item.claimReason && item.claimReason.toLowerCase().includes(q)) ||
        (item.claimSubReason && item.claimSubReason.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q)) ||
        (item.user?.email && item.user.email.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      list = list.filter(item => item.type === typeFilter);
    }

    setFilteredList(list);
  }, [searchTerm, typeFilter, evidenceList]);

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#FF6700] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px]">Loading Secure Evidence Logs...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#313079]/15 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Header and Filters bar */}
      <div className="p-6 border-b border-[#313079]/10 bg-gradient-to-r from-[#FF6700]/5 to-[#313079]/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-extrabold uppercase tracking-widest text-[#313079] text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6700] animate-pulse"></span>
            Media & Evidence Logs
          </h3>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Granular LPN and Order-level dispute records</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search LPN, Order, Reason..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6700] rounded-xl text-xs w-full sm:w-60 transition-all shadow-inner"
            />
          </div>

          {/* Type filter */}
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#FF6700] rounded-xl text-xs cursor-pointer font-semibold uppercase tracking-wider"
          >
            <option value="ALL">All Types</option>
            <option value="INSPECTION_VIDEO">Inspection Videos</option>
            <option value="RECEIVER_REJECTION">Receiver Rejections</option>
            <option value="CLAIM_EVIDENCE">Claim Evidence</option>
          </select>

          <span className="bg-[#FF6700]/10 border border-[#FF6700]/20 text-[#FF6700] text-[10px] px-3 py-2 rounded-xl font-black uppercase flex items-center justify-center">
            {filteredList.length} / {evidenceList.length} Records
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-[#313079]/10 text-[#313079]/70 text-[10px] uppercase font-bold tracking-widest">
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">LPN ID (Unique Key)</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Associated Order</th>
              <th className="px-6 py-4">Claims Reason / Context</th>
              <th className="px-6 py-4">Uploaded By</th>
              <th className="px-6 py-4">Evidence Folder Directories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No matching evidence logs found.
                </td>
              </tr>
            ) : (
              filteredList.map((record) => {
                const isRejection = record.type === 'RECEIVER_REJECTION';
                const isVideo = record.type === 'INSPECTION_VIDEO';
                const isMissing = record.reason === 'missing';
                
                // HSL styling configurations for high visual fidelity
                const typeBadgeStyle = isRejection 
                  ? 'bg-red-50 text-red-600 border-red-200' 
                  : isVideo 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200';

                return (
                  <tr key={record.id} className="hover:bg-[#FF6700]/5 transition-colors group">
                    {/* Timestamp */}
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 font-medium">
                      {new Date(record.createdAt).toLocaleDateString()} 
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Type badge */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-black uppercase rounded-lg shadow-sm ${typeBadgeStyle}`}>
                          {isRejection && <AlertTriangle size={12} />}
                          {isVideo && <Video size={12} />}
                          {!isRejection && !isVideo && <ImageIcon size={12} />}
                          {record.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Unique LPN Badge */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`px-2 py-1 font-mono text-xs font-black rounded-lg w-max border shadow-sm ${
                          isMissing 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          {record.lpn}
                        </span>
                        {isMissing && (
                          <span className="text-[9px] font-extrabold uppercase text-rose-500 mt-1 tracking-wider animate-pulse flex items-center gap-0.5">
                            <AlertTriangle size={10} /> Missing Expected Item
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SKU Badge */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 font-mono text-xs font-extrabold bg-[#313079]/5 border border-[#313079]/10 text-[#313079] rounded-lg shadow-sm">
                        {record.returnItem?.sku || 'N/A'}
                      </span>
                    </td>

                    {/* Associated Order */}
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {record.orderId || record.manifest?.trackingId || 'N/A'}
                      </span>
                      {record.manifest?.courierName && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mt-1">
                          {record.manifest.courierName}
                        </span>
                      )}
                    </td>

                    {/* Claim Reasons and context details */}
                    <td className="px-6 py-4 max-w-xs overflow-hidden text-ellipsis">
                      {isMissing ? (
                        <span className="bg-rose-100/50 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          MISSING FROM BOX
                        </span>
                      ) : record.claimReason ? (
                        <div className="flex flex-col space-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-indigo-900 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 w-max">
                            {record.claimReason.replace(/_/g, ' ')}
                          </span>
                          {record.claimSubReason && (
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                              &bull; {record.claimSubReason.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-semibold italic">
                          {record.reason || 'No inspection issues logged'}
                        </span>
                      )}
                    </td>

                    {/* Uploader Email */}
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                      {record.user?.email || 'SYSTEM AUTOMATION'}
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold mt-0.5">
                        {record.user?.role?.replace('_', ' ') || 'WEB SERVICE'}
                      </span>
                    </td>

                    {/* Drive links columns with folder and document indicators */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Order parent drive directory link */}
                        {record.orderDriveLink ? (
                          <a 
                            href={record.orderDriveLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            title="Open Order Parent Directory"
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-[#FF6700] hover:bg-[#FF6700]/5 bg-white text-slate-700 hover:text-[#FF6700] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                          >
                            <Folder size={12} className="text-slate-400 group-hover:text-[#FF6700]" />
                            <span>Order Folder</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-not-allowed">
                            <Folder size={12} />
                            <span>No Order Folder</span>
                          </span>
                        )}

                        {/* Specific LPN file directory link */}
                        {record.lpnDriveLink ? (
                          <a 
                            href={record.lpnDriveLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            title="Open Specific LPN Directory"
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-[#313079] hover:bg-[#313079]/5 bg-white text-slate-700 hover:text-[#313079] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                          >
                            <FileText size={12} className="text-slate-400 group-hover:text-[#313079]" />
                            <span>LPN Folder</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-not-allowed">
                            <FileText size={12} />
                            <span>No LPN Folder</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}