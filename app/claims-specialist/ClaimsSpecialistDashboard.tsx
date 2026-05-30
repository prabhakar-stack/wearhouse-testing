"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  User,
  Bell,
  ChevronDown,
  AlertOctagon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileWarning,
  ExternalLink,
  Clipboard,
  Check,
  Eye,
  X,
  ShieldAlert,
  ArrowRight,
  Menu,
  ShieldCheck,
  Shield,
  TrendingUp,
  Package,
  Calendar,
  CheckCircle,
  Info
} from "lucide-react";

// --- ProfileModal Component (Directly matches SuperAdmin style) ---
function ProfileModal({ user, onClose }: { user: { name: string; email: string; role: string }; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(d => {
      if (d.user) setProfile(d.user);
    }).catch(() => {});
  }, []);

  const resolvedName = profile?.name || (user.name !== user.email ? user.name : '') || user.email;
  const isEmail = resolvedName.includes('@');
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient — black & slate gradient */}
        <div className="bg-gradient-to-br from-black to-slate-900 p-8 text-white relative border-b border-black/10">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
            {initials}
          </div>
          <h2 className="text-xl font-black text-white">{resolvedName}</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-mono">{user.email}</p>
          <div className="mt-3 flex items-center space-x-2">
            <Shield size={12} className="text-[#FF6700]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6700]">
              {user.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4 bg-[#FF6700]/5 border-t border-[#313079]/5">
          {profile ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-[#FF6700]/10 shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package size={14} className="text-[#FF6700]" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Items Processed</p>
                  </div>
                  <p className="text-2xl font-black text-[#313079] font-mono">{profile.itemsProcessed ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp size={14} className="text-green-500" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Accuracy Rate</p>
                  </div>
                  <p className="text-2xl font-black text-green-600 font-mono">{profile.accuracyRate?.toFixed(1) ?? '100.0'}%</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar size={14} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Member Since</p>
                </div>
                <p className="text-sm font-bold text-[#313079]">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs uppercase tracking-widest animate-pulse">Loading profile...</div>
          )}

          <div className="h-px bg-[#313079]/10" />
          <p className="text-[10px] text-slate-400 text-center font-medium">
            Active session · Verified Claims Access
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---
interface ClaimsSpecialistDashboardProps {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export default function ClaimsSpecialistDashboard({
  userId,
  role,
  name,
  email,
}: ClaimsSpecialistDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "triage" | "smartfiling">("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Live Claims Data State
  const [claims, setClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimDetails, setClaimDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Active Alerts State
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  // Statistics
  const [stats, setStats] = useState({
    pending: 0,
    resolved: 0,
    total: 0,
  });

  const fetchClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
      const res = await fetch("/api/claims");
      const data = await res.json();
      if (res.ok && data.claims) {
        setClaims(data.claims);
        setStats(prev => ({
          ...prev,
          pending: data.claims.length,
          total: data.claims.length + prev.resolved
        }));
      }
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setLoadingClaims(false);
    }
  }, []);

  const fetchAlerts = useCallback(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        if (d.alerts) {
          setAlerts(d.alerts);
          setAlertCount(d.alerts.length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchClaims, fetchAlerts]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleResolveClaim = async (manifestId: string) => {
    if (!confirm("Are you sure you want to mark this claim as resolved in the system?")) return;
    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifestId }),
      });
      if (res.ok) {
        setStats(prev => ({
          ...prev,
          resolved: prev.resolved + 1,
          pending: Math.max(0, prev.pending - 1)
        }));
        setSelectedClaimId(null);
        setClaimDetails(null);
        fetchClaims();
      } else {
        alert("Failed to resolve claim.");
      }
    } catch (err) {
      console.error("Error resolving claim:", err);
    }
  };

  const handleViewClaimDetails = async (manifestId: string) => {
    setSelectedClaimId(manifestId);
    setLoadingDetails(true);
    setCopySuccess(false);
    try {
      const res = await fetch(`/api/claims/details?manifestId=${manifestId}`);
      const data = await res.json();
      if (res.ok && data.claimData) {
        setClaimDetails(data.claimData);
      } else {
        console.error("Failed to fetch claim details");
      }
    } catch (err) {
      console.error("Error fetching claim details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCopySummary = () => {
    if (!claimDetails?.claimSummary) return;
    navigator.clipboard.writeText(claimDetails.claimSummary);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const displayName = name || (email !== name ? name : "") || "Claims Specialist";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "CS";

  return (
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative">
      
      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={{ name: displayName, email, role }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Drawer slide-over for Claim Details */}
      {selectedClaimId && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClaimId(null)} />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 ease-in-out">
                <div className="flex h-full flex-col bg-white shadow-2xl border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
                  
                  {/* Drawer Header */}
                  <div className="bg-gradient-to-br from-black to-slate-900 px-6 py-5 text-white flex justify-between items-center border-b border-black/10">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-[#FF6700] flex items-center gap-2">
                        <FileText size={16} />
                        <span>Filing Assistant</span>
                      </h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                        Smart claim generation tools & evidence mapping
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedClaimId(null)} 
                      className="text-slate-400 hover:text-white transition-colors p-1 bg-white/5 rounded-lg"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Drawer Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
                    {loadingDetails ? (
                      <div className="h-64 flex flex-col items-center justify-center space-y-3">
                        <div className="w-10 h-10 border-4 border-[#FF6700] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assembling evidence snapshot...</p>
                      </div>
                    ) : claimDetails ? (
                      <>
                        {/* Manifest Stats */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Manifest Details</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-medium">
                            <div>
                              <p className="text-slate-400 text-[10px] uppercase font-bold">Tracking ID</p>
                              <p className="font-mono text-slate-800 mt-0.5 break-all">{claimDetails.manifest.trackingId || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px] uppercase font-bold">Expected Date</p>
                              <p className="text-slate-800 mt-0.5">
                                {claimDetails.manifest.expectedDate 
                                  ? new Date(claimDetails.manifest.expectedDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })
                                  : "N/A"
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px] uppercase font-bold">Status</p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-orange-100 text-orange-700">
                                {claimDetails.manifest.status}
                              </span>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px] uppercase font-bold">Courier</p>
                              <p className="text-slate-800 mt-0.5">{claimDetails.manifest.courierName || "Delhivery"}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px] uppercase font-bold">Inspected By</p>
                              <p className="text-slate-800 mt-0.5 truncate" title={claimDetails.manifest.inspectedBy || "N/A"}>{claimDetails.manifest.inspectedBy || "N/A"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Staged Items List */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
                            Associated Return Items ({claimDetails.returnItems?.length || 0})
                          </h4>
                          {claimDetails.returnItems && claimDetails.returnItems.length > 0 ? (
                            <div className="space-y-3">
                              {claimDetails.returnItems.map((item: any) => (
                                <div key={item.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2 text-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-[10px] font-mono font-bold bg-[#FF6700]/10 text-[#FF6700] px-1.5 py-0.5 rounded">LPN: {item.lpn || "N/A"}</span>
                                      <p className="font-bold text-[#313079] mt-1">SKU: {item.sku || "N/A"}</p>
                                    </div>
                                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-red-100 text-red-700 border border-red-200">
                                      {item.condition || "PRODUCT_DAMAGED"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 border-t border-slate-100/70 pt-2">
                                    <p><strong className="uppercase font-bold text-slate-400">Return Reason:</strong> {item.returnReason || "Customer Damaged"}</p>
                                    <p><strong className="uppercase font-bold text-slate-400">Comments:</strong> {item.customerComments || "None"}</p>
                                  </div>
                                  
                                  {/* Evidence Drive Link */}
                                  {item.evidences && item.evidences.length > 0 && (
                                    <div className="flex gap-2 flex-wrap pt-1.5 border-t border-slate-100/70">
                                      {item.evidences.map((ev: any) => (
                                        <div key={ev.id} className="flex gap-2">
                                          {ev.lpnDriveLink && (
                                            <a 
                                              href={ev.lpnDriveLink} 
                                              target="_blank" 
                                              rel="noreferrer" 
                                              className="inline-flex items-center space-x-1 text-xs text-[#FF6700] font-bold hover:underline"
                                            >
                                              <span>LPN Drive Folder</span> <ExternalLink size={10} />
                                            </a>
                                          )}
                                          {ev.orderDriveLink && (
                                            <a 
                                              href={ev.orderDriveLink} 
                                              target="_blank" 
                                              rel="noreferrer" 
                                              className="inline-flex items-center space-x-1 text-xs text-blue-600 font-bold hover:underline"
                                            >
                                              <span>Order Drive Folder</span> <ExternalLink size={10} />
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-wider">
                              No specific return items mapped.
                            </div>
                          )}
                        </div>

                        {/* Order Level Evidence */}
                        {claimDetails.orderEvidences && claimDetails.orderEvidences.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
                              Order Evidence Attachments ({claimDetails.orderEvidences.length})
                            </h4>
                            <div className="space-y-2">
                              {claimDetails.orderEvidences.map((ev: any) => (
                                <div key={ev.id} className="flex justify-between items-center border border-slate-100 p-2.5 rounded-lg bg-slate-50/50 text-xs">
                                  <div className="flex items-center space-x-2">
                                    <FileWarning size={14} className="text-[#FF6700]" />
                                    <span className="font-bold text-slate-700 uppercase">{ev.type}</span>
                                  </div>
                                  {ev.orderDriveLink && (
                                    <a 
                                      href={ev.orderDriveLink} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="inline-flex items-center space-x-1 text-[#FF6700] font-bold"
                                    >
                                      <span>Open Link</span> <ExternalLink size={11} />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Generated Claim Summary */}
                        {claimDetails.claimSummary && (
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clipboard Payload</h4>
                              <button 
                                onClick={handleCopySummary}
                                className={`inline-flex items-center space-x-1.5 px-3 py-1 bg-black text-[#FF6700] border border-[#FF6700] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
                                  copySuccess ? "bg-green-600 border-green-600 text-white" : ""
                                }`}
                              >
                                {copySuccess ? <Check size={11} /> : <Clipboard size={11} />}
                                <span>{copySuccess ? "Summary Copied" : "Copy Summary"}</span>
                              </button>
                            </div>
                            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar border border-slate-800">
                              {claimDetails.claimSummary}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 text-slate-400 text-xs uppercase font-bold tracking-wider">
                        Unable to load claim details.
                      </div>
                    )}
                  </div>

                  {/* Drawer Footer */}
                  {claimDetails && (
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex gap-3 shrink-0">
                      <button 
                        onClick={() => setSelectedClaimId(null)} 
                        className="flex-1 border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleResolveClaim(claimDetails.manifest.id)} 
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded shadow-sm transition-colors"
                      >
                        Resolve Claim
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Alerts Active Dropdown Popup */}
      {showNotifications && (
        <div className="absolute right-4 top-16 w-[calc(100vw-32px)] sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] flex flex-col max-h-[500px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              <Bell className="text-[#FF6700]" size={16} />
              <span className="text-xs font-black uppercase tracking-widest text-[#313079]">Active Alerts</span>
              {alerts.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-black">{alerts.length}</span>
              )}
            </div>
            <button onClick={() => { setShowNotifications(false); }} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[440px] bg-slate-50/30">
            {alerts.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle size={36} className="text-green-500 mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">All Clear — No Alerts</p>
              </div>
            ) : (
              alerts.map(alert => {
                return (
                  <div key={alert.id} className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-1 relative pl-4 text-left">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                          {alert.level} - {alert.type}
                        </span>
                        <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{alert.description}</p>
                        {alert.manifest?.trackingId && (
                          <span className="inline-block mt-1 text-[8px] font-mono text-slate-400 uppercase">
                            AWB: {alert.manifest.trackingId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-black text-white shrink-0 shadow-lg z-20 flex items-center justify-between px-6 h-14 border-b border-white/10 w-full">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
            <ShieldAlert className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[120px]" title={displayName}>{displayName}</h1>
            <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className={`relative p-1 hover:text-white transition-colors ${showNotifications ? 'text-white' : 'text-slate-400'}`}
          >
            <Bell size={22} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-black animate-pulse">
                {alertCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="p-1 text-white/70 hover:text-white focus:outline-none"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 lg:z-20 w-64 bg-black text-white flex flex-col border-r border-black/10 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <FileText className="text-white" size={16} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[160px]" title={displayName}>{displayName}</h1>
              <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">{role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-white/50 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => { setActiveTab("overview"); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
              activeTab === "overview"
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={activeTab === "overview" ? 'text-[#FFF700]' : 'text-[#FF6700]/70'}><Activity size={14} /></span>
              <span>Overview & Queue</span>
            </div>
          </button>
          
          <button
            onClick={() => { setActiveTab("triage"); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
              activeTab === "triage"
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={activeTab === "triage" ? 'text-[#FFF700]' : 'text-[#FF6700]/70'}><FileWarning size={14} /></span>
              <span>Claims Triage</span>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab("smartfiling"); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
              activeTab === "smartfiling"
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={activeTab === "smartfiling" ? 'text-[#FFF700]' : 'text-[#FF6700]/70'}><Activity size={14} /></span>
              <span>Smart Filing Monitor</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3">
          
          <div className="h-px bg-white/10"></div>

          {/* Clickable Profile Section */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors group text-left"
            title="View Profile"
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-tight break-words">{displayName}</p>
              <p className="text-[9px] uppercase tracking-widest text-[#FF6700] font-bold mt-0.5">
                {role.replace(/_/g, ' ')}
              </p>
            </div>
            <User size={12} className="text-[#FF6700]/70 group-hover:text-white transition-colors shrink-0" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-50 flex flex-col">
        {/* Top Header (Desktop only) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-[#313079]">
              {activeTab === "overview" ? "Claims Processing Queue" : activeTab === "triage" ? "Claims Triage Console" : "Smart Filing Monitor"}
            </h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Returns Management App &bull; {role.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="flex items-center">
            <button 
              onClick={() => setShowNotifications(!showNotifications)} 
              className={`relative p-1.5 hover:text-[#313079] transition-colors ${showNotifications ? 'text-[#313079]' : 'text-slate-400'}`}
              title="Alerts Center"
            >
              <Bell size={24} />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Tab-specific Content Containers */}
        <div className="flex-1 p-6 relative overflow-hidden">
          <div className="absolute inset-6 bg-white border border-slate-200 shadow-xl flex flex-col rounded-2xl overflow-hidden">
            
            {activeTab === "overview" && (
              <div className="flex flex-col h-full p-8 space-y-8 overflow-y-auto custom-scrollbar">
                
                {/* Header info */}
                <div className="flex justify-between items-end shrink-0 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Reimbursements Queue</h2>
                    <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Verify visual evidence and submit claims to Amazon Seller Central.</p>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 shrink-0">
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Claims Staged</p>
                      <p className="text-3xl font-black text-[#313079] font-mono">{stats.pending}</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-100 shrink-0">
                      <AlertOctagon className="text-[#FF6700]" size={20} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Resolved Today</p>
                      <p className="text-3xl font-black text-green-600 font-mono">{stats.resolved}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center border border-green-100 shrink-0">
                      <CheckCircle2 className="text-green-600" size={20} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Total Claims</p>
                      <p className="text-3xl font-black text-[#313079] font-mono">{stats.total}</p>
                    </div>
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                      <FileText className="text-slate-500" size={20} />
                    </div>
                  </div>
                </div>

                {/* Queue Table */}
                <div className="w-full border border-slate-200 bg-white overflow-hidden flex flex-col rounded-xl shadow-sm flex-1 min-h-[300px]">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700">Pending Reimbursements</h3>
                    <button 
                      onClick={fetchClaims} 
                      className="text-[10px] font-extrabold uppercase tracking-widest text-[#FF6700] hover:text-[#FF6700]/80 transition-colors"
                    >
                      Refresh Queue
                    </button>
                  </div>
                  <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-medium">Tracking AWB</th>
                          <th className="px-6 py-4 font-medium">Amazon Order ID</th>
                          <th className="px-6 py-4 font-medium">Condition status</th>
                          <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {loadingClaims ? (
                          <tr><td colSpan={4} className="px-6 py-8 text-center text-xs">Loading pending claims directory...</td></tr>
                        ) : claims.map(c => {
                          const cond = c.status === "CLAIMS_STAGING" ? "PRODUCT DAMAGED" : "INSPECTED";
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-800">
                                <div className="flex items-center space-x-3">
                                  <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6700] shrink-0">
                                    <FileWarning size={14} />
                                  </div>
                                  <span className="font-mono text-[11px] font-bold text-slate-700">{c.trackingId}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{c.orderId || "N/A"}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase rounded bg-red-50 border border-red-100 text-red-600">
                                  {cond}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end items-center space-x-3">
                                  <button 
                                    onClick={() => handleViewClaimDetails(c.id)}
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm"
                                  >
                                    <Eye size={12} />
                                    <span>File Claim</span>
                                  </button>
                                  <button 
                                    onClick={() => handleResolveClaim(c.id)}
                                    className="text-[10px] uppercase font-bold tracking-widest text-green-600 hover:text-green-700 transition-colors"
                                  >
                                    Resolve
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!loadingClaims && claims.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-xs">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <ShieldCheck size={32} className="text-green-500 opacity-60" />
                                <p className="font-bold text-slate-400 uppercase tracking-widest">No Claims Staged</p>
                                <p className="text-[10px] text-slate-400 font-medium">All inspection returns have been successfully filed or resolved!</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {activeTab === "triage" && (
              <iframe
                src="http://localhost:5000/triage"
                className="w-full h-full border-none"
                title="Claims Triage"
                style={{
                  height: "100%", 
                }}
              />
            )}

            {activeTab === "smartfiling" && (
              <iframe
                src="http://localhost:5000/smartfiling"
                className="w-full h-full border-none"
                title="Smart Filing Monitor"
                style={{
                  height: "100%", 
                }}
              />
            )}

          </div>
        </div>

      </main>
      
    </div>
  );
}
