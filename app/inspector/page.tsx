"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertOctagon,
  Link as LinkIcon,
  ScanEye,
  Camera,
  AlertTriangle,
  ArrowRight,
  PackageOpen,
  User,
  ArrowLeft,
  Shield,
  FileText,
  Box,
  Zap,
  TrendingUp,
  Check,
  Bell,
  ChevronDown,
  X,
} from "lucide-react";
import Link from "next/link";

type ProductCondition =
  | "GOOD_SELLABLE"
  | "PACKAGING_DAMAGED"
  | "PRODUCT_DAMAGED"
  | "WRONG_ITEM"
  | "MISSING"
  | "BAD_FAKE_PRODUCT";

type InspectorReturnItem = {
  lpn: string;
  orderId: string;
  sku?: string;
  quantity?: number;
};

function resolveProductCondition(
  category: "GOOD" | "RECOVERY" | "BAD",
  reason?: string,
  subReason?: string,
): ProductCondition {
  if (category === "GOOD") return "GOOD_SELLABLE";
  if (category === "RECOVERY") return "PACKAGING_DAMAGED";

  const text = `${reason || ""} ${subReason || ""}`.toLowerCase();
  if (
    text.includes("fake") ||
    text.includes("replica") ||
    text.includes("counterfeit")
  )
    return "BAD_FAKE_PRODUCT";
  if (text.includes("different") || text.includes("junk")) return "WRONG_ITEM";
  if (text.includes("empty") || text.includes("missing")) return "MISSING";

  return "PRODUCT_DAMAGED";
}

export default function InspectorPage() {
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    setTimeout(() => {
      setRole(storedRole || "INSPECTOR");
      setMounted(true);
    }, 0);
  }, []);

  if (!mounted) return null;

  if (role !== "INSPECTOR" && role !== "ADMIN" && role !== "SUPER_ACCESS") {
    return (
      <div className="h-screen w-screen bg-red-50 text-red-800 flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-red-200">
        <AlertOctagon size={120} className="mb-8 text-red-400" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight text-red-700">
          Access Denied
        </h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-red-500">
          Invalid Role Authorization
        </p>
      </div>
    );
  }

  return <InspectorDashboard role={role} />;
}

function StepVisualGuide({
  step,
}: {
  step: { id: number; title: string; desc: string; sampleImg: string | null };
}) {
  const renderBoxWireframe = (
    highlightedFace: "top" | "bottom" | "front" | "back" | "left" | "right",
  ) => {
    return (
      <svg viewBox="0 0 200 135" className="w-40 h-28 text-[#FF6700]">
        <defs>
          <linearGradient id="glowBrand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6700" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FF6700" stopOpacity="0.15" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Draw hidden faces first */}
        <polygon
          points="60,95 100,115 140,95 100,75"
          fill={highlightedFace === "bottom" ? "url(#glowBrand)" : "none"}
          stroke={
            highlightedFace === "bottom" ? "#FF6700" : "rgba(49, 48, 121, 0.3)"
          }
          strokeWidth={highlightedFace === "bottom" ? "2" : "1"}
          strokeDasharray={highlightedFace === "bottom" ? "none" : "3,3"}
          filter={highlightedFace === "bottom" ? "url(#glow)" : undefined}
        />
        <polygon
          points="100,20 60,40 60,95 100,75"
          fill={highlightedFace === "left" ? "url(#glowBrand)" : "none"}
          stroke={
            highlightedFace === "left" ? "#FF6700" : "rgba(49, 48, 121, 0.3)"
          }
          strokeWidth={highlightedFace === "left" ? "2" : "1"}
          strokeDasharray={highlightedFace === "left" ? "none" : "3,3"}
          filter={highlightedFace === "left" ? "url(#glow)" : undefined}
        />
        <polygon
          points="100,20 140,40 140,95 100,75"
          fill={highlightedFace === "back" ? "url(#glowBrand)" : "none"}
          stroke={
            highlightedFace === "back" ? "#FF6700" : "rgba(49, 48, 121, 0.3)"
          }
          strokeWidth={highlightedFace === "back" ? "2" : "1"}
          strokeDasharray={highlightedFace === "back" ? "none" : "3,3"}
          filter={highlightedFace === "back" ? "url(#glow)" : undefined}
        />

        {/* 2. Draw visible faces */}
        {/* Top Face */}
        <polygon
          points="100,20 140,40 100,60 60,40"
          fill={
            highlightedFace === "top"
              ? "url(#glowBrand)"
              : "rgba(49, 48, 121, 0.2)"
          }
          stroke={
            highlightedFace === "top" ? "#FF6700" : "rgba(49, 48, 121, 0.4)"
          }
          strokeWidth={highlightedFace === "top" ? "2" : "1"}
          filter={highlightedFace === "top" ? "url(#glow)" : undefined}
        />
        {/* Front Face */}
        <polygon
          points="60,40 100,60 100,115 60,95"
          fill={
            highlightedFace === "front"
              ? "url(#glowBrand)"
              : "rgba(49, 48, 121, 0.2)"
          }
          stroke={
            highlightedFace === "front" ? "#FF6700" : "rgba(49, 48, 121, 0.4)"
          }
          strokeWidth={highlightedFace === "front" ? "2" : "1"}
          filter={highlightedFace === "front" ? "url(#glow)" : undefined}
        />
        {/* Right Face */}
        <polygon
          points="100,60 140,40 140,95 100,115"
          fill={
            highlightedFace === "right"
              ? "url(#glowBrand)"
              : "rgba(49, 48, 121, 0.2)"
          }
          stroke={
            highlightedFace === "right" ? "#FF6700" : "rgba(49, 48, 121, 0.4)"
          }
          strokeWidth={highlightedFace === "right" ? "2" : "1"}
          filter={highlightedFace === "right" ? "url(#glow)" : undefined}
        />

        {/* Glowing text label floating near the highlighted face */}
        <text
          x="100"
          y="130"
          textAnchor="middle"
          fill="#FF6700"
          className="text-[10px] font-black tracking-widest font-mono uppercase animate-pulse"
        >
          {highlightedFace.toUpperCase()} SIDE
        </text>
      </svg>
    );
  };

  const renderDeliveryLabel = () => {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <svg viewBox="0 0 200 110" className="w-48 h-24">
          <rect
            x="50"
            y="10"
            width="100"
            height="90"
            rx="4"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <rect x="60" y="20" width="25" height="8" rx="1" fill="#1e293b" />
          <circle cx="95" cy="24" r="3" fill="#FF6700" />
          <line
            x1="60"
            y1="36"
            x2="110"
            y2="36"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="60"
            y1="44"
            x2="130"
            y2="44"
            stroke="#e2e8f0"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="60"
            y1="50"
            x2="100"
            y2="50"
            stroke="#e2e8f0"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g opacity="0.8">
            <line
              x1="60"
              y1="62"
              x2="60"
              y2="82"
              stroke="#0f172a"
              strokeWidth="3"
            />
            <line
              x1="66"
              y1="62"
              x2="66"
              y2="82"
              stroke="#0f172a"
              strokeWidth="1"
            />
            <line
              x1="70"
              y1="62"
              x2="70"
              y2="82"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <line
              x1="76"
              y1="62"
              x2="76"
              y2="82"
              stroke="#0f172a"
              strokeWidth="4"
            />
            <line
              x1="84"
              y1="62"
              x2="84"
              y2="82"
              stroke="#0f172a"
              strokeWidth="1"
            />
            <line
              x1="88"
              y1="62"
              x2="88"
              y2="82"
              stroke="#0f172a"
              strokeWidth="3"
            />
            <line
              x1="94"
              y1="62"
              x2="94"
              y2="82"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <line
              x1="100"
              y1="62"
              x2="100"
              y2="82"
              stroke="#0f172a"
              strokeWidth="5"
            />
            <line
              x1="108"
              y1="62"
              x2="108"
              y2="82"
              stroke="#0f172a"
              strokeWidth="1"
            />
            <line
              x1="112"
              y1="62"
              x2="112"
              y2="82"
              stroke="#0f172a"
              strokeWidth="3"
            />
            <line
              x1="118"
              y1="62"
              x2="118"
              y2="82"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <line
              x1="124"
              y1="62"
              x2="124"
              y2="82"
              stroke="#0f172a"
              strokeWidth="4"
            />
            <line
              x1="132"
              y1="62"
              x2="132"
              y2="82"
              stroke="#0f172a"
              strokeWidth="1"
            />
            <line
              x1="138"
              y1="62"
              x2="138"
              y2="82"
              stroke="#0f172a"
              strokeWidth="3"
            />
          </g>
          <text
            x="100"
            y="93"
            textAnchor="middle"
            className="text-[7px] font-mono font-bold tracking-widest fill-[#313079]"
          >
            AWB: 1Z999AA10123456784
          </text>
        </svg>
        <div
          className="absolute left-1/2 -translate-x-1/2 w-52 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]"
          style={{
            animation: "laser 2.5s infinite ease-in-out",
          }}
        ></div>
      </div>
    );
  };

  const renderOrderSlip = () => {
    return (
      <svg viewBox="0 0 200 110" className="w-48 h-24 text-[#313079]/30">
        <rect
          x="55"
          y="15"
          width="90"
          height="85"
          rx="3"
          fill="#475569"
          stroke="#334155"
          strokeWidth="1.5"
        />
        <rect x="85" y="10" width="30" height="12" rx="2" fill="#1e293b" />
        <circle cx="100" cy="16" r="2" fill="#94a3b8" />
        <rect x="62" y="22" width="76" height="72" rx="1" fill="#f8fafc" />
        <rect x="70" y="30" width="40" height="4" fill="#FF6700" rx="0.5" />
        <g opacity="0.8">
          <rect
            x="70"
            y="42"
            width="6"
            height="6"
            rx="1"
            fill="none"
            stroke="#10b981"
            strokeWidth="1"
          />
          <line
            x1="80"
            y1="45"
            x2="120"
            y2="45"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M71,45 L73,47 L75,43"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <rect
            x="70"
            y="54"
            width="6"
            height="6"
            rx="1"
            fill="none"
            stroke="#10b981"
            strokeWidth="1"
          />
          <line
            x1="80"
            y1="57"
            x2="110"
            y2="57"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M71,57 L73,59 L75,55"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <rect
            x="70"
            y="66"
            width="6"
            height="6"
            rx="1"
            fill="none"
            stroke="#10b981"
            strokeWidth="1"
          />
          <line
            x1="80"
            y1="69"
            x2="125"
            y2="69"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M71,69 L73,71 L75,67"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
        <circle
          cx="120"
          cy="36"
          r="10"
          fill="#10b981"
          className="animate-pulse"
        />
        <path
          d="M116,36 L119,39 L124,33"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  };

  const renderSvgGuide = (id: number) => {
    switch (id) {
      case 3:
        return renderBoxWireframe("front");
      case 4:
        return renderBoxWireframe("back");
      case 5:
        return renderBoxWireframe("left");
      case 6:
        return renderBoxWireframe("right");
      case 7:
        return renderDeliveryLabel();
      case 8:
        return renderOrderSlip();
      default:
        return null;
    }
  };

  if (step.sampleImg) {
    return (
      <div className="relative w-full h-36 rounded-lg overflow-hidden border border-[#313079]/10 bg-white shadow-sm flex shrink-0">
        <img
          src={step.sampleImg}
          alt="Sample reference"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-[#FF6700]/80 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest text-center py-1">
          Reference Sample
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-36 rounded-lg overflow-hidden border border-[#FF6700]/20 bg-[#313079] flex items-center justify-center shrink-0 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-[#313079] via-[#000000] to-[#313079] opacity-95"></div>
      <style>{`
        @keyframes laser {
          0%, 100% { top: 10%; opacity: 0.8; }
          50% { top: 80%; opacity: 1; }
        }
      `}</style>

      <div className="relative z-10 w-full h-full flex items-center justify-center p-2 pb-6">
        {renderSvgGuide(step.id)}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-[#313079]/90 border-t border-[#FF6700]/30 backdrop-blur-sm text-[#FF6700] text-[9px] font-black uppercase tracking-[0.15em] text-center py-1 flex items-center justify-center space-x-1.5 animate-pulse">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF6700]"></span>
        <span>HUD Visual Assist Active</span>
      </div>
    </div>
  );
}

function InspectorDashboard({ role }: { role: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "home" | "takeover" | "inspect" | "profile" | "ledger"
  >("home");
  const [userData, setUserData] = useState<any>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [activeSopAlertId, setActiveSopAlertId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserData(data.user);
      })
      .catch(console.error);
  }, []);

  const fetchAlerts = useCallback(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        if (d.alerts) {
          setAlerts(d.alerts);
          setAlertCount(d.alerts.length);
        }
        if (d.sopMap) setSopMap(d.sopMap);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    if (!resolutionText.trim()) return;
    setResolvingId(alertId);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText }),
      });
      if (res.ok) {
        setResolutionText('');
        setActiveSopAlertId(null);
        fetchAlerts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-[#313079] select-none overscroll-none font-sans overflow-hidden border-4 border-[#313079]/10 relative">
      <header className="p-4 md:p-6 border-b border-[#313079]/10 shrink-0 bg-white shadow-sm z-20 flex items-center justify-between">
        <div className="flex items-center">
          {activeTab !== "home" && (
            <button
              onClick={() => setActiveTab("home")}
              className="mr-4 text-[#313079]/70 hover:text-[#313079]"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#FF6700]">
              {activeTab === "profile"
                ? "Profile"
                : activeTab === "ledger"
                  ? "Custody Ledger"
                  : "Quality Assurance"}
            </h1>
            <p className="text-[#313079]/60 text-xs font-bold tracking-widest mt-1 uppercase">
              {userData
                ? userData.name || userData.email || role
                : role.replace("_", " ")}{" "}
              &bull; {role.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className={`relative p-1 hover:text-[#313079] transition-colors ${showNotifications ? 'text-[#313079]' : 'text-[#FF6700]'}`}
            title="Notifications & Alerts"
          >
            <Bell size={26} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                {alertCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`hover:text-[#313079] transition-colors ${activeTab === "profile" ? "text-[#313079]" : "text-[#FF6700]"}`}
            title="Profile"
          >
            <User size={26} />
          </button>
        </div>
      </header>

      {showNotifications && (
        <div className="absolute right-4 top-16 md:top-20 w-[calc(100vw-32px)] sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] flex flex-col max-h-[500px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              <Bell className="text-[#FF6700]" size={16} />
              <span className="text-xs font-black uppercase tracking-widest text-[#313079]">Active Alerts</span>
              {alerts.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-black">{alerts.length}</span>
              )}
            </div>
            <button onClick={() => { setShowNotifications(false); setActiveSopAlertId(null); }} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[440px] bg-slate-50/30">
            {alerts.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle2 size={36} className="text-green-500 mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">All Clear — No Pending Alerts</p>
              </div>
            ) : (
              alerts.map(alert => {
                const isSopOpen = activeSopAlertId === alert.id;
                const steps = sopMap[alert.type] || [];
                return (
                  <div key={alert.id} className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-2.5 relative pl-4 text-left">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                          {alert.level} - {alert.type}
                        </span>
                        <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{alert.description}</p>
                      </div>
                      <button 
                        onClick={() => setActiveSopAlertId(isSopOpen ? null : alert.id)}
                        className="text-[9px] text-[#FF6700] hover:text-[#FF6700]/80 font-black uppercase tracking-wider ml-2 shrink-0 border border-[#FF6700]/20 rounded-md px-2 py-0.5"
                      >
                        {isSopOpen ? 'Close' : 'SOP'}
                      </button>
                    </div>

                    {isSopOpen && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-wider text-[#FF6700]">SOP Steps:</p>
                          <ul className="space-y-1">
                            {steps.map((step: any, idx: number) => (
                              <li key={step.id || idx} className="text-[10px] text-[#313079]/90 font-medium flex items-start space-x-1.5">
                                <span className="font-mono font-bold text-[#FF6700]">{step.stepOrder}.</span>
                                <span className="leading-snug">{step.instruction}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex space-x-1.5 items-center pt-1 border-t border-slate-50">
                          <input 
                            type="text" 
                            placeholder="RESOLVE NOTES" 
                            value={resolutionText}
                            onChange={e => setResolutionText(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] uppercase font-bold focus:outline-none focus:border-[#FF6700] text-slate-900"
                          />
                          <button 
                            onClick={() => handleResolve(alert.id)}
                            disabled={!resolutionText.trim() || resolvingId === alert.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 text-[9px] font-black uppercase rounded-md"
                          >
                            {resolvingId === alert.id ? '...' : 'Resolve'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <main className="flex-1 relative overflow-y-auto custom-scrollbar bg-[#FF6700]/5">
        {activeTab === "home" && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4 pb-10">
            <div className="space-y-4">
              <button
                onClick={() => setActiveTab("ledger")}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">
                    Custody Ledger
                  </h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">
                    Packages pending inspection
                  </p>
                </div>
                <FileText
                  size={32}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10"
                />
              </button>

              <button
                onClick={() => setActiveTab("takeover")}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">
                    Custody Takeover
                  </h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">
                    Execute mechanical handshake
                  </p>
                </div>
                <LinkIcon
                  size={32}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10"
                />
              </button>

              <button
                onClick={() => setActiveTab("inspect")}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">
                    Deep Inspect
                  </h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">
                    Gamified quality assurance
                  </p>
                </div>
                <ScanEye
                  size={32}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10"
                />
              </button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-4 pb-10">
            {/* Profile Card */}
            <div className="bg-white border border-[#313079]/10 overflow-hidden rounded-2xl shadow-md">
              {/* Gradient header */}
              <div className="bg-gradient-to-br from-black to-slate-900 p-8 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={100} className="text-white" />
                </div>
                {/* Avatar with initials from name or email */}
                <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
                  {userData
                    ? userData.name
                      ? userData.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                      : userData.email?.slice(0, 2).toUpperCase() || "?"
                    : "?"}
                </div>
                <h2 className="text-xl font-black text-white">
                  {userData
                    ? userData.name || userData.email || "Inspector"
                    : "Loading..."}
                </h2>
                {userData?.email && (
                  <p className="text-slate-400 text-xs font-mono mt-1">
                    {userData.email}
                  </p>
                )}
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
                  {role?.replace(/_/g, " ")}
                </span>
              </div>

              {/* Stats */}
              <div className="p-6 space-y-4">
                {userData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#FF6700]/5 border border-[#FF6700]/10 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">
                          Items Inspected
                        </p>
                        <p className="text-3xl font-black font-mono text-[#313079]">
                          {userData.itemsProcessed ?? 0}
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">
                          Accuracy Rate
                        </p>
                        <p className="text-3xl font-black font-mono text-green-600">
                          {userData.accuracyRate?.toFixed(1) ?? "100.0"}%
                        </p>
                      </div>
                    </div>
                    {userData.createdAt && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-1">
                          Member Since
                        </p>
                        <p className="text-sm font-bold text-[#313079]">
                          {new Date(userData.createdAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "long", year: "numeric" },
                          )}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-[#313079]/40 text-xs uppercase tracking-widest animate-pulse font-bold">
                    Loading profile...
                  </div>
                )}
                <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  Profile is read-only · Contact Admin to update details.
                </p>
              </div>
            </div>

            {(role === "SUPER_ACCESS" || role === "ADMIN") && (
              <Link
                href={role === "SUPER_ACCESS" ? "/super-admin" : "/admin"}
                className="w-full flex items-center justify-center py-4 bg-[#FFF700] border-2 border-black hover:brightness-95 transition-all text-[#313079] font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                Return to Command Center
              </Link>
            )}
            <button
              onClick={async () => {
                localStorage.removeItem("userRole");
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch (e) {}
                router.push("/login");
              }}
              className="w-full py-4 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              Sign Out
            </button>
          </div>
        )}

        {activeTab === "ledger" && <LedgerTab />}
        {activeTab === "takeover" && <TakeoverTab />}
        {activeTab === "inspect" && <InspectTab userId={userData?.id} />}
      </main>
    </div>
  );
}

function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = () => {
      fetch("/api/inspector/ledger")
        .then((r) => r.json())
        .then((d) => {
          if (d.ledger) setLedger(d.ledger);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchLedger();
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 pt-6 px-4">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
          My Custody Ledger
        </h2>
        <span className="bg-white border border-[#FF6700]/30 text-[#FF6700] px-3 py-1 font-mono text-xs rounded-sm shadow-sm font-bold">
          {ledger.length} PENDING
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">
          Syncing Custody Ledger...
        </div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-md">
          <CheckCircle2
            size={48}
            className="mx-auto text-green-500 mb-4 opacity-50"
          />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
            No Pending Inspections
          </h3>
          <p className="text-[10px] uppercase text-[#313079]/70 mt-2 max-w-[200px] mx-auto font-medium">
            You have no active taken packages. Proceed to Takeover to pull from
            Receiver.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-white border border-[#313079]/10 p-4 flex flex-col space-y-3 relative overflow-hidden group rounded-md shadow-sm hover:shadow transition-shadow"
            >
              <div
                className={`absolute inset-y-0 left-0 w-1 ${item.status === "INSPECTING" ? "bg-[#FF6700] animate-pulse" : "bg-[#FF6700]/30"}`}
              ></div>

              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/60">
                    {item.marketplace || "UNKNOWN"} &bull; ORDER {item.orderId}
                  </p>
                  <p className="font-mono text-base text-[#313079] mt-0.5 font-bold">
                    {item.trackingId}
                  </p>
                </div>
                <div className="text-right">
                  {item.status === "INSPECTING" ? (
                    <span className="bg-[#FF6700]/5 text-[#FF6700] px-2 py-1 text-[10px] font-bold uppercase border border-[#FF6700]/20 rounded-sm">
                      IN PROGRESS
                    </span>
                  ) : (
                    <span className="bg-[#313079]/5 text-[#313079]/70 px-2 py-1 text-[10px] font-bold uppercase border border-[#313079]/15 rounded-sm">
                      PENDING
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pl-2 pt-2 border-t border-[#313079]/10">
                <div>
                  <p className="text-[10px] uppercase text-[#313079]/50 font-bold">
                    Items Scanned
                  </p>
                  <div className="font-mono text-xs mt-1 text-[#313079] font-bold">
                    <span className="text-green-600">
                      {item.itemsInspected}
                    </span>{" "}
                    / {item.itemsExpected}
                  </div>
                </div>
                <div className="text-[9px] font-mono text-[#313079]/50 font-bold">
                  Taken:{" "}
                  {new Date(item.receivedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TakeoverTab() {
  const [trackingId, setTrackingId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [takenManifest, setTakenManifest] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/inspector/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: trackingId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Takeover failed");
        setLoading(false);
        return;
      }
      setTakenManifest(data.manifest);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setTrackingId("");
        setTakenManifest(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="absolute inset-0 bg-green-500 z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
        <CheckCircle2 size={120} className="text-white mb-8 drop-shadow-2xl" />
        <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-widest text-center leading-tight drop-shadow-lg">
          Custody Transferred
        </h2>
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase">
          Successfully!
        </p>
        {takenManifest && (
          <div className="mt-6 bg-white/20 backdrop-blur px-6 py-3 rounded-lg text-white text-sm font-mono">
            <p>Tracking ID: {takenManifest.trackingId}</p>
            <p>Items to Inspect: {takenManifest.itemCount}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col justify-center items-center px-4 py-8 pb-32">
      <div className="w-full max-w-lg bg-white p-6 border border-[#313079]/10 shadow-lg flex flex-col space-y-6 rounded-md">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#FF6700]/5 mx-auto flex items-center justify-center rounded-full border border-[#FF6700]/20 mb-4 shadow-sm">
            <LinkIcon size={32} className="text-[#FF6700]" />
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#313079]">
            Mechanical Handshake
          </h2>
          <p className="text-[#313079]/60 font-bold text-sm tracking-widest mt-2 uppercase">
            Scan Box from Receiver
          </p>
        </div>

        <div className="flex flex-col space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input
              type="text"
              placeholder="ENTER TRACKING ID..."
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              autoFocus
              className="w-full bg-white border-2 border-[#313079]/20 text-[#313079] p-4 text-center font-mono focus:outline-none focus:border-[#FF6700] transition-colors uppercase placeholder-[#313079]/30 rounded"
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-bold rounded flex items-center space-x-2">
                <AlertOctagon size={16} />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!trackingId.trim() || loading}
              className="w-full min-h-16 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white disabled:bg-[#313079]/5 disabled:text-[#313079]/30 disabled:border-none transition-all border-none text-xl font-black uppercase tracking-[0.1em] shadow-lg disabled:shadow-none flex items-center justify-center space-x-3 rounded"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Confirm Takeover</span>
                  <ArrowRight size={24} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function InspectTab({ userId }: { userId?: string }) {
  const [phase, setPhase] = useState<
    "START" | "BOX_EVIDENCE" | "ITEM_INSPECTION" | "COMPLETED"
  >("START");
  const [orderId, setOrderId] = useState("");



  const [boxStep, setBoxStep] = useState(1);

  const [itemStep, setItemStep] = useState(1);
  const [itemsProcessed, setItemsProcessed] = useState(0);
  const [currentLpn, setCurrentLpn] = useState("");
  const [currentCategory, setCurrentCategory] = useState<
    "GOOD" | "RECOVERY" | "BAD" | null
  >(null);
  const [selectedClaimReason, setSelectedClaimReason] = useState<string | null>(
    null,
  );
  const [selectedClaimSubReason, setSelectedClaimSubReason] = useState<
    string | null
  >(null);
  const [showDefectDropdown, setShowDefectDropdown] = useState(false);
  const [showRecoveryDropdown, setShowRecoveryDropdown] = useState(false);

  const [missingAcknowledged, setMissingAcknowledged] = useState(false);

  // Dynamic expected items — fetched from DB on order start
  const [expectedItems, setExpectedItems] = useState(0);
  const [expectedFnskuQuantities, setExpectedFnskuQuantities] = useState<Record<string, number>>({});
  const [isValidatingLpn, setIsValidatingLpn] = useState(false);
  const [startError, setStartError] = useState("");
  const [manifestId, setManifestId] = useState("");
  const [activeOrderPlatformId, setActiveOrderPlatformId] = useState("");
  const [expectedLpnItems, setExpectedLpnItems] = useState<InspectorReturnItem[]>([]);
  const [lpnScanError, setLpnScanError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const capturedImagesRef = useRef<
    { type: "box" | "lpn" | "product"; id?: string; step?: number; blob: Blob }[]
  >([]);
  const lpnConditionsRef = useRef<Record<string, string>>({});
  const lpnRecoveryTypesRef = useRef<Record<string, string>>({});
  const scannedLpnsRef = useRef<Set<string>>(new Set());
  const reqAnimRef = useRef<number>(0);
  const isOrderCompleteRef = useRef(false);

  const orderIdRef = useRef(orderId);
  const userIdRef = useRef(userId);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const resetProcess = () => {
    setPhase("START");
    setOrderId("");
    setManifestId("");
    setActiveOrderPlatformId("");
    setExpectedLpnItems([]);
    setExpectedFnskuQuantities({});
    setIsValidatingLpn(false);
    setLpnScanError("");
    setBoxStep(1);
    setItemStep(1);
    setItemsProcessed(0);
    setCurrentLpn("");
    setCurrentCategory(null);
    setMissingAcknowledged(false);
    setSelectedClaimReason(null);
    setSelectedClaimSubReason(null);
    setShowDefectDropdown(false);
    setShowRecoveryDropdown(false);
    setExpectedItems(0);
    setStartError("");
    isOrderCompleteRef.current = false;
    capturedImagesRef.current = [];
    lpnConditionsRef.current = {};
    lpnRecoveryTypesRef.current = {};
    scannedLpnsRef.current = new Set();
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = "Evidence upload is in progress. Please do not close or reload the page.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  const isCameraActive =
    phase === "BOX_EVIDENCE" || phase === "ITEM_INSPECTION";

  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const canvas = visibleCanvasRef.current;

    if (isCameraActive && video && canvas) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          stream = s;
          video.srcObject = stream;

          video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const drawFrame = () => {
              if (video.paused || video.ended) return;
              ctx.save();
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI);
              ctx.drawImage(
                video,
                -canvas.width / 2,
                -canvas.height / 2,
                canvas.width,
                canvas.height,
              );
              ctx.restore();
              reqAnimRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();

            try {
              // @ts-ignore
              const canvasStream = canvas.captureStream(30);
              const mr = new MediaRecorder(canvasStream, {
                mimeType: "video/webm",
              });
              mediaRecorderRef.current = mr;
              chunksRef.current = [];

              mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
              };

              mr.onstop = () => {
                if (!isOrderCompleteRef.current) return;

                // Capture current values in local scope immediately before resetting states
                const activeOrderId = orderId;
                const activeUserId = userId;
                const activeManifestId = manifestId;
                const activePlatformOrderId = activeOrderPlatformId;
                const capturedImages = [...capturedImagesRef.current];
                const lpnConditions = { ...lpnConditionsRef.current };
                const lpnRecoveryTypes = { ...lpnRecoveryTypesRef.current };
                const itemsScanned = itemsProcessed;
                const itemsExpected = expectedItems;
                const isMissingItemFlagged = itemsProcessed < expectedItems;

                // Reset the UI instantly to the START phase
                resetProcess();

                // Non-blocking fire-and-forget background upload
                const backgroundUpload = async () => {
                  if (!activeOrderId) {
                    console.error(
                      "[Background Upload] Aborted: activeOrderId is empty",
                    );
                    return;
                  }

                  setIsUploading(true);

                  try {
                    const videoChunks =
                      chunksRef.current.length > 0
                        ? chunksRef.current
                        : [
                            new Blob(["empty-video-fallback"], {
                              type: "video/webm",
                            }),
                          ];

                    const blob = new Blob(videoChunks, { type: "video/webm" });

                    const filesToUpload: { key: string; name: string; mimeType: string; lpn?: string; blob: Blob }[] = [];
                    filesToUpload.push({ key: "file", name: "video-proof.webm", mimeType: "video/webm", blob });

                    let boxCounter = 1;
                    capturedImages.forEach((img) => {
                      if (!img.blob || img.blob.size === 0) return;
                      if (img.type === "box") {
                        const stepNum = img.step || boxCounter;
                        filesToUpload.push({
                          key: `step_${stepNum}`,
                          name: `step${stepNum}.jpg`,
                          mimeType: "image/jpeg",
                          blob: img.blob,
                        });
                        boxCounter++;
                      } else if ((img.type === "lpn" || img.type === "product") && img.id) {
                        const fileKey = `${img.type}_img_${img.id}`;
                        const fileName = img.type === "lpn" ? `lpn_${img.id}.jpg` : `lpn_${img.id}_product.jpg`;
                        filesToUpload.push({
                          key: fileKey,
                          name: fileName,
                          mimeType: "image/jpeg",
                          blob: img.blob,
                          lpn: img.id,
                        });
                      }
                    });

                    const filesMetaData = filesToUpload.map((f) => ({
                      key: f.key,
                      name: f.name,
                      mimeType: f.mimeType,
                      lpn: f.lpn,
                      condition: f.lpn
                        ? lpnConditions[f.lpn]
                        : undefined,
                    }));

                    // 1. Initialize Direct Upload — creates the Drive folder structure and returns upload URLs
                    const initRes = await fetch("/api/upload/init", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: activeOrderId,
                        type: "INSPECTION_VIDEO",
                        filesMetaData,
                      }),
                    });

                    if (!initRes.ok)
                      throw new Error(
                        "Failed to initialize Google Drive upload",
                      );
                    const { uploadUrls, folderLink, orderFolderId } =
                      await initRes.json();

                    // 2. CALL INSPECTOR EVALUATE EARLY TO REMOVE FROM CUSTODY STACK INSTANTLY
                    try {
                      const evalRes = await fetch("/api/inspector/evaluate", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-user-role": "INSPECTOR",
                          "x-user-id": activeUserId || ""
                        },
                        body: JSON.stringify({
                          manifestId: activeManifestId,
                          orderPlatformId: activePlatformOrderId,
                          itemsScanned,
                          itemsExpected,
                          isMissingItemFlagged,
                          lpnConditions,
                          lpnRecoveryTypes,
                          evidenceUrl: folderLink || null
                        })
                      });
                      if (!evalRes.ok) {
                        const err = await evalRes.json().catch(() => ({}));
                        console.error("[Background Upload] Early evaluate failed:", err);
                      } else {
                        console.log("[Background Upload] Early evaluate completed successfully!");
                      }
                    } catch (evalErr) {
                      console.error("[Background Upload] Early evaluate error:", evalErr);
                    }

                    // 3. Upload files silently — video uses silent chunked pipeline, images use existing raw pipeline

                    // Helper: upload a small file (image) via /api/upload/raw with 3 retries
                    const uploadSmallFile = async (
                      f: { key: string; name: string; blob: Blob },
                      url: string,
                    ) => {
                      const timeoutMs = Math.max(
                        30000,
                        Math.min(
                          120000,
                          Math.ceil((f.blob.size / 100000) * 1000),
                        ),
                      );
                      for (let attempt = 1; attempt <= 3; attempt++) {
                        const controller = new AbortController();
                        const tid = setTimeout(
                          () => controller.abort(),
                          timeoutMs,
                        );
                        try {
                          const res = await fetch(url, {
                            method: "PUT",
                            body: f.blob,
                            signal: controller.signal,
                          });
                          clearTimeout(tid);
                          if (res.ok) {
                            console.log(
                              `[Queue Upload] Uploaded image ${f.name} on attempt ${attempt}`,
                            );
                            return;
                          }
                          console.warn(
                            `[Queue Upload] Attempt ${attempt} failed for ${f.name}: HTTP ${res.status}`,
                          );
                        } catch (err: any) {
                          clearTimeout(tid);
                          console.error(
                            `[Queue Upload] Attempt ${attempt} error for ${f.name}:`,
                            err.name === "AbortError" ? "Timeout" : err.message,
                          );
                        }
                        if (attempt < 3)
                          await new Promise((r) =>
                            setTimeout(r, 1000 * attempt),
                          );
                      }
                      console.error(
                        `[Queue Upload] Gave up on image ${f.name} after 3 attempts.`,
                      );
                    };

                    // Helper: chunked upload for the video — splits blob into 5 MB slices
                    const uploadVideoChunked = async (
                      f: {
                        key: string;
                        name: string;
                        mimeType: string;
                        blob: Blob;
                      },
                      targetFolderId: string,
                    ) => {
                      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
                      const totalChunks = Math.max(
                        1,
                        Math.ceil(f.blob.size / CHUNK_SIZE),
                      );
                      const uploadId = crypto.randomUUID();

                      console.log(
                        `[Chunked Upload] Video ${f.name} — ${(f.blob.size / (1024 * 1024)).toFixed(2)} MB split into ${totalChunks} chunks (uploadId=${uploadId})`,
                      );

                      for (let i = 0; i < totalChunks; i++) {
                        const start = i * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, f.blob.size);
                        const chunk = f.blob.slice(start, end);

                        let chunkOk = false;
                        for (let attempt = 1; attempt <= 3; attempt++) {
                          const controller = new AbortController();
                          const tid = setTimeout(
                            () => controller.abort(),
                            90000,
                          ); // 90s per 5 MB chunk
                          try {
                            const res = await fetch(
                              `/api/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${i}&totalChunks=${totalChunks}&name=${encodeURIComponent(f.name)}`,
                              {
                                method: "PUT",
                                body: chunk,
                                signal: controller.signal,
                              },
                            );
                            clearTimeout(tid);
                            if (res.ok) {
                              console.log(
                                `[Chunked Upload] Chunk ${i + 1}/${totalChunks} OK on attempt ${attempt}`,
                              );
                              chunkOk = true;
                              break;
                            }
                            console.warn(
                              `[Chunked Upload] Chunk ${i + 1}/${totalChunks} attempt ${attempt} failed: HTTP ${res.status}`,
                            );
                          } catch (err: any) {
                            clearTimeout(tid);
                            console.error(
                              `[Chunked Upload] Chunk ${i + 1}/${totalChunks} attempt ${attempt}:`,
                              err.name === "AbortError"
                                ? "Timeout"
                                : err.message,
                            );
                          }
                          if (attempt < 3)
                            await new Promise((r) =>
                              setTimeout(r, 1500 * attempt),
                            );
                        }

                        if (!chunkOk) {
                          console.error(
                            `[Chunked Upload] Chunk ${i + 1}/${totalChunks} failed after 3 attempts — aborting video upload for ${f.name}.`,
                          );
                          return;
                        }
                      }

                      // All chunks received — assemble into one file on server and push to Drive
                      console.log(
                        `[Chunked Upload] All ${totalChunks} chunks uploaded. Assembling ${f.name}...`,
                      );
                      try {
                        const assembleRes = await fetch(
                          "/api/upload/assemble",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              uploadId,
                              totalChunks,
                              name: f.name,
                              mimeType: f.mimeType,
                              folderId: targetFolderId,
                            }),
                          },
                        );
                        if (assembleRes.ok) {
                          const data = await assembleRes.json();
                          console.log(
                            `[Chunked Upload] Assembly complete. Drive fileId=${data.fileId}`,
                          );
                        } else {
                          const errBody = await assembleRes
                            .json()
                            .catch(() => ({}));
                          console.error(
                            `[Chunked Upload] Assembly failed: HTTP ${assembleRes.status}`,
                            errBody,
                          );
                        }
                      } catch (err: any) {
                        console.error(
                          "[Chunked Upload] Assembly request error:",
                          err.message,
                        );
                      }
                    };

                    // Process all files sequentially
                    for (const f of filesToUpload) {
                      if (f.key === "file") {
                        // Video → chunked pipeline (no body size limit issue)
                        await uploadVideoChunked(f, orderFolderId);
                      } else {
                        // Images → existing raw pipeline
                        const url = uploadUrls[f.key];
                        if (!url) {
                          console.warn(
                            `[Queue Upload] No URL for key: ${f.key}`,
                          );
                          continue;
                        }
                        await uploadSmallFile(f, url);
                      }
                    }

                    // 4. Finalize Database Write
                    const cleanUserId =
                      activeUserId &&
                      activeUserId !== "undefined" &&
                      activeUserId !== "null"
                        ? activeUserId
                        : undefined;
                    await fetch("/api/upload/finalize", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: activeOrderId,
                        manifestId: activeManifestId,
                        orderPlatformId: activePlatformOrderId,
                        folderLink,
                        orderFolderId,
                        type: "INSPECTION_VIDEO",
                        uploadedById: cleanUserId,
                        reason: "Complete Order Inspection Folder",
                        lpnConditions,
                        lpnRecoveryTypes,
                      }),
                    });
                  } catch (e) {
                    console.error("Silent background pipeline failed:", e);
                  } finally {
                    setIsUploading(false);
                  }
                };

                backgroundUpload(); // Trigger silently without blocking UI
              };

              mr.start(1000);
              setIsRecording(true);
            } catch (e) {
              console.error("MediaRecorder init failed", e);
            }
          };
        })
        .catch((err) =>
          console.error("Camera access denied or unavailable:", err),
        );
    }

    return () => {
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
    };
  }, [isCameraActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      setTimeout(() => setRecordingTime(0), 0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const captureImage = (
    type: "box" | "lpn" | "product",
    identifier?: string,
  ) => {
    if (videoRef.current && hiddenCanvasRef.current) {
      const video = videoRef.current;
      const canvas = hiddenCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(
          video,
          -canvas.width / 2,
          -canvas.height / 2,
          canvas.width,
          canvas.height,
        );
        ctx.restore();

        if (type === "lpn" || type === "product") {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas.width * 0.3;
          tempCanvas.height = canvas.height;
          const tCtx = tempCanvas.getContext("2d");

          if (tCtx) {
            tCtx.drawImage(
              canvas,
              canvas.width * 0.7,
              0,
              canvas.width * 0.3,
              canvas.height,
              0,
              0,
              tempCanvas.width,
              tempCanvas.height,
            );
            tempCanvas.toBlob(
              (blob) => {
                if (blob)
                  capturedImagesRef.current.push({
                    type,
                    id: identifier,
                    step: boxStep,
                    blob,
                  });
              },
              "image/jpeg",
              0.8,
            );
          }
        } else {
          canvas.toBlob(
            (blob) => {
              if (blob)
                capturedImagesRef.current.push({
                  type,
                  id: identifier,
                  step: boxStep,
                  blob,
                });
            },
            "image/jpeg",
            0.8,
          );
        }
      }
    }
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);
  };

  const stopAndFinalizeRecording = () => {
    isOrderCompleteRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const triggerXp = (amount: number) => {
    // XP and gamification elements removed
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setStartError("");

    if (!userId) {
      setStartError("Authentication error. Please log in again.");
      return;
    }

    try {
      const res = await fetch(
        `/api/manifest/${encodeURIComponent(orderId.trim())}`,
      );
      if (res.ok) {
        const data = await res.json();
        const manifest = data.manifest;

        if (!manifest) {
          setStartError("This Order ID / Tracking ID is not found in the system.");
          return;
        }



        if (manifest.status !== "IN_INSPECTION") {
          setStartError(
            "This package is not active in your inspection stack. Take custody from the receiver before scanning."
          );
          return;
        }

        if (manifest.inspection?.completedAt) {
          setStartError("This package has already been inspected.");
          return;
        }

        setManifestId(manifest.id);

        const resolvedOrderId = manifest.matchedOrderId || "";
        const manifestOrderIds = Array.from(
          new Set(
            (manifest.returnItems || [])
              .map((ri: any) => ri.orderId)
              .filter(Boolean),
          ),
        );

        if (!resolvedOrderId && manifestOrderIds.length > 1) {
          setStartError(
            "This tracking ID contains multiple orders. Please scan the exact Order ID before inspection."
          );
          return;
        }

        const scopedReturnItems = (manifest.returnItems || []).filter((ri: any) =>
          resolvedOrderId ? ri.orderId === resolvedOrderId : true,
        );

        setActiveOrderPlatformId(resolvedOrderId || (manifestOrderIds[0] as string) || "");
        setExpectedLpnItems(
          scopedReturnItems
            .filter((ri: any) => ri.lpn)
            .map((ri: any) => ({
              lpn: String(ri.lpn).trim(),
              orderId: ri.orderId,
              sku: ri.sku,
              quantity: ri.quantity,
            })),
        );

        const totalExpected = manifest.totalExpectedQuantity || 1;
        setExpectedItems(totalExpected);

        const fnskuMap: Record<string, number> = {};
        if (manifest.expectedFnskus && Array.isArray(manifest.expectedFnskus)) {
          for (const item of manifest.expectedFnskus) {
            if (item.fnsku) {
              fnskuMap[String(item.fnsku).trim().toUpperCase()] = item.quantity || 0;
            }
          }
        }
        setExpectedFnskuQuantities(fnskuMap);
      } else {
        setStartError("This Order ID / Tracking ID is not found in the system.");
        return;
      }
    } catch {
      setStartError("Failed to verify custody. Please try again.");
      return;
    }

    setPhase("BOX_EVIDENCE");
    triggerXp(50);
  };


  const nextBoxStep = () => {
    triggerXp(20);
    if (boxStep < 8) {
      setBoxStep((prev) => prev + 1);
    } else {
      setPhase("ITEM_INSPECTION");
    }
  };

  const nextItemStep = async () => {
    if (itemStep === 1) {
      const ok = await confirmCurrentLpn();
      if (!ok) return;
    }
    triggerXp(30);
    if (itemStep < 6) {
      setItemStep((prev) => prev + 1);
    } else {
      console.warn("Item step out of bounds");
    }
  };

  const normalizeLpn = (value: string) => value.trim().toUpperCase();

  const confirmCurrentLpn = async () => {
    const scannedLpn = currentLpn.trim().toUpperCase();
    if (!scannedLpn) {
      setLpnScanError("Scan or type the LPN before continuing.");
      return false;
    }

    if (scannedLpnsRef.current.has(scannedLpn)) {
      setLpnScanError("This LPN has already been scanned for this order.");
      return false;
    }

    setIsValidatingLpn(true);
    setLpnScanError("");

    try {
      const res = await fetch(
        `/api/product/status?lpn=${encodeURIComponent(scannedLpn)}&orderId=${encodeURIComponent(activeOrderPlatformId)}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLpnScanError(data.error || "LPN validation failed.");
        setIsValidatingLpn(false);
        return false;
      }

      const itemInfo = await res.json();
      const resolvedFnsku = String(itemInfo.fnsku || "").trim().toUpperCase();

      const remainingQty = expectedFnskuQuantities[resolvedFnsku] ?? 0;

      if (!(resolvedFnsku in expectedFnskuQuantities)) {
        setLpnScanError(`This item (FNSKU: ${resolvedFnsku}) is not expected in this removal order.`);
        setIsValidatingLpn(false);
        return false;
      }

      if (remainingQty <= 0) {
        setLpnScanError(`All expected units of this item (FNSKU: ${resolvedFnsku}) have already been scanned.`);
        setIsValidatingLpn(false);
        return false;
      }

      // Decrement the local remaining quantity for this FNSKU
      setExpectedFnskuQuantities(prev => ({
        ...prev,
        [resolvedFnsku]: remainingQty - 1
      }));

      setCurrentLpn(scannedLpn);
      setLpnScanError("");
      setIsValidatingLpn(false);
      return true;
    } catch (err) {
      setLpnScanError("Connection error while validating LPN.");
      setIsValidatingLpn(false);
      return false;
    }
  };

  const CLAIM_REASONS = [
    {
      id: "damaged_used",
      label: "1. I received damaged/ used item(s)",
      subReasons: [
        { value: "heavily_damaged", label: "a. Item(s) heavily damaged" },
        {
          value: "minor_damages",
          label: "b. Item(s) with minor damages/dents/scratches",
        },
        {
          value: "packaging_damaged",
          label: "c. Only product packaging damaged",
        },
      ],
    },
    {
      id: "different_empty",
      label: "2. I received different item or empty box",
      subReasons: [
        { value: "different_junk", label: "a. Different/junk item received" },
        { value: "empty_box", label: "b. Empty box received" },
        {
          value: "fake_counterfeit",
          label: "c. Fake/ replica/ counterfeit item received",
        },
      ],
    },
  ];

  const handleCategory = (cat: "GOOD" | "RECOVERY" | "BAD") => {
    const condition = resolveProductCondition(cat);
    lpnConditionsRef.current[currentLpn] = condition;
    triggerXp(100);
    setCurrentCategory(cat);
    if (cat === "BAD") {
      setShowDefectDropdown(true);
      setShowRecoveryDropdown(false);
      setSelectedClaimReason(null);
      setSelectedClaimSubReason(null);
    } else if (cat === "RECOVERY") {
      setShowDefectDropdown(false);
      setShowRecoveryDropdown(true);
      setSelectedClaimReason(null);
      setSelectedClaimSubReason(null);
    } else {
      setShowDefectDropdown(false);
      setShowRecoveryDropdown(false);
      setSelectedClaimReason(null);
      setSelectedClaimSubReason(null);
      delete lpnRecoveryTypesRef.current[currentLpn];
      nextItemStep();
    }
  };

  const handleRecoverySelected = (recoveryType: string) => {
    lpnRecoveryTypesRef.current[currentLpn] = recoveryType;
    setShowRecoveryDropdown(false);
    nextItemStep();
  };

  const handleDefectSelected = (reason: string, subReason: string) => {
    setSelectedClaimReason(reason);
    setSelectedClaimSubReason(subReason);
    const condition = resolveProductCondition("BAD", reason, subReason);
    lpnConditionsRef.current[currentLpn] = condition;
    setShowDefectDropdown(false);
    nextItemStep();
  };

  const handleBinning = () => {
    const finalizedLpn = currentLpn;
    const finalizedCondition = finalizedLpn
      ? lpnConditionsRef.current[finalizedLpn]
      : undefined;

    if (finalizedLpn && finalizedCondition) {
      void fetch("/api/product/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lpn: finalizedLpn,
          condition: finalizedCondition,
          orderPlatformId: activeOrderPlatformId,
          recoveryType: finalizedLpn ? lpnRecoveryTypesRef.current[finalizedLpn] : undefined,
        }),
      }).catch((error) =>
        console.error("[Live Product Status] failed:", error),
      );
    }

    triggerXp(50);
    const newProcessed = itemsProcessed + 1;
    scannedLpnsRef.current.add(normalizeLpn(finalizedLpn));
    setItemsProcessed(newProcessed);
    setCurrentLpn("");
    setLpnScanError("");
    setCurrentCategory(null);
    setSelectedClaimReason(null);
    setSelectedClaimSubReason(null);
    setShowDefectDropdown(false);
    setItemStep(1);

    if (newProcessed >= expectedItems) {
      stopAndFinalizeRecording();
    }
  };

  const handleMissing = () => {
    stopAndFinalizeRecording();
    setMissingAcknowledged(true);
  };

  const BOX_STEPS = [
    {
      id: 1,
      title: "Top Side",
      desc: "Lay the box flat. Center the TOP face in the camera frame so all 4 edges are visible. Capture when steady.",
      sampleImg: "/samples/inspector_box_photo.png",
    },
    {
      id: 2,
      title: "Bottom Side",
      desc: "Flip the box over carefully. Capture the BOTTOM face — look for moisture staining or crushed corners.",
      sampleImg: "/samples/inspector_box_photo.png",
    },
    {
      id: 3,
      title: "Front Side",
      desc: "Stand the box upright. Capture the FRONT face — note any dents, tears, or re-taped areas.",
      sampleImg: null,
    },
    {
      id: 4,
      title: "Back Side",
      desc: "Rotate the box. Capture the BACK face — check for any impact damage or label irregularities.",
      sampleImg: null,
    },
    {
      id: 5,
      title: "Left Side",
      desc: "Capture the LEFT SIDE of the box — look for crush marks or moisture stains on the edges.",
      sampleImg: null,
    },
    {
      id: 6,
      title: "Right Side",
      desc: "Capture the RIGHT SIDE — check the seam tape runs continuously without gaps or cuts.",
      sampleImg: null,
    },
    {
      id: 7,
      title: "Delivery Label",
      desc: "Hold the DELIVERY LABEL clearly to the camera. All text must be readable. Ensure AWB matches scanned number.",
      sampleImg: null,
    },
    {
      id: 8,
      title: "Remove Slip",
      desc: "Remove the ORDER DETAILS SLIP from inside the box and hold it to the camera. This is your paper audit trail.",
      sampleImg: null,
    },
  ];

  const ITEM_STEPS = [
    {
      id: 1,
      title: "Scan Item LPN",
      instruction:
        "Type or scan the LPN barcode number printed on the item sticker. Verify it matches the manifest before proceeding.",
    },
    {
      id: 2,
      title: "Capture LPN Photo",
      instruction:
        "Point the camera at the LPN label on the item. Keep the LPN label in the RIGHT HALF of the frame. Hold steady and capture.",
      sampleImg: "/samples/inspector_lpn_scan.png",
    },
    {
      id: 3,
      title: "Testing Instructions",
      instruction:
        "Perform the physical product check below before capturing the image. Ensure no step is skipped.",
    },
    {
      id: 4,
      title: "Capture Product Image",
      instruction:
        "Place the product in the RIGHT HALF of the camera frame. Capture all visible sides — scratches, dents, missing parts must be visible.",
      sampleImg: "/samples/inspector_product_photo.png",
    },
    {
      id: 5,
      title: "Categorize Condition",
      instruction:
        "Based on your physical test and visual inspection, select the correct condition grade. This determines the bin the item goes into.",
    },
    {
      id: 6,
      title: "Physical Binning",
      instruction:
        "Place the item into the labelled bin shown below. Confirm once placed — this cannot be undone without a supervisor override.",
    },
  ];

  return (
    <div className="absolute inset-0 z-40 flex flex-row bg-slate-900 select-none overflow-hidden text-slate-800">
      <div className="w-[60%] bg-black relative flex flex-col items-center justify-center border-r border-slate-800 shadow-2xl">
        <div className="absolute top-4 left-4 bg-red-600/90 backdrop-blur text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 rounded shadow-lg z-10">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span>REC &bull; Continuous Evidence</span>
        </div>

        <div className="absolute top-4 right-4 bg-black/70 border border-white/20 text-white px-4 py-2 text-sm font-mono tracking-widest rounded flex items-center space-x-3 z-10 shadow-lg">
          {isRecording && (
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
          )}
          <span>
            {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:
            {String(recordingTime % 60).padStart(2, "0")}
          </span>
        </div>

        <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="hidden"
          ></video>
          <canvas
            ref={visibleCanvasRef}
            className="absolute inset-0 w-full h-full object-cover bg-black"
          ></canvas>
          <canvas ref={hiddenCanvasRef} className="hidden"></canvas>
          {shutterFlash && (
            <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150"></div>
          )}

          {/* Split Screen Overlay for Item Inspection */}
          {phase === "ITEM_INSPECTION" && (
            <div className="absolute inset-0 z-10 pointer-events-none flex">
              <div className="w-[70%] h-full border-r-2 border-white/40 border-dashed flex items-center justify-center bg-black/20">
                <span className="text-white/60 font-black text-2xl tracking-widest">
                  BOX AREA
                </span>
              </div>
              <div className="w-[30%] h-full flex items-center justify-center">
                <span className="text-white/60 font-black text-2xl tracking-widest">
                  ITEM AREA
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-[40%] bg-white flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
        <div className="bg-white border-b border-[#313079]/10 p-4 flex justify-between items-center shrink-0 shadow-sm relative">
          <div className="flex items-center space-x-2">
            <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]">
              <Box size={16} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">
                Tracking ID
              </p>
              <p className="text-sm font-black font-mono text-[#313079]">
                {manifestId ? orderId : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-right">
            <div>
              <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">
                Order ID
              </p>
              <p className="text-sm font-black font-mono text-[#FF6700]">
                {activeOrderPlatformId || "—"}
              </p>
            </div>
            <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]">
              <FileText size={16} />
            </div>
          </div>
        </div>

        {phase === "START" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 bg-[#FF6700]/5">
            <div className="bg-[#FF6700]/10 p-4 rounded-full mb-6">
              <ScanEye size={48} className="text-[#FF6700]" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-[#313079] mb-1 text-center">
              Scan Order ID
            </h2>
            <p className="text-[#313079]/60 font-bold tracking-wider mb-8 uppercase text-xs">
              To Begin Continuous Evidence
            </p>

            <form
              onSubmit={handleStart}
              className="w-full flex flex-col space-y-4 max-w-sm"
            >
              <input
                type="text"
                placeholder="ENTER ORDER ID..."
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                autoFocus
                className="w-full min-h-12 bg-white border-2 border-[#313079]/20 text-[#313079] px-4 py-3 text-center text-lg font-mono focus:outline-none focus:border-[#FF6700] uppercase placeholder-[#313079]/30 rounded-lg shadow-inner transition-colors"
              />
              <button
                type="submit"
                disabled={!orderId.trim()}
                className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white disabled:bg-[#313079]/10 disabled:text-[#313079]/40 transition-all text-sm font-black uppercase tracking-[0.15em] shadow-md flex justify-center items-center space-x-2 rounded-lg"
              >
                <span>Initialize</span>
                <ArrowRight size={18} />
              </button>
              {startError && (
                <div className="w-full text-red-600 text-xs font-black uppercase tracking-wider text-center bg-red-50 border-2 border-red-200 p-3 rounded-lg shadow-sm animate-in fade-in duration-200 mt-2">
                  {startError}
                </div>
              )}
            </form>
          </div>
        )}

        {phase === "BOX_EVIDENCE" && (
          <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
            <div className="mb-6">
              <h3 className="text-[10px] uppercase font-black tracking-widest text-[#FF6700] mb-1">
                Phase 1
              </h3>
              <h2 className="text-lg font-black uppercase tracking-widest text-[#313079]">
                Box Evidence
              </h2>
            </div>

            <div className="flex-1 relative">
              {BOX_STEPS.map((step, idx) => {
                const isActive = boxStep === step.id;
                const isCompleted = boxStep > step.id;
                const isLast = idx === BOX_STEPS.length - 1;

                return (
                  <div key={step.id} className="relative pl-8 pb-4">
                    {!isLast && (
                      <div
                        className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? "bg-[#FF6700]/30" : "bg-[#313079]/10"}`}
                      ></div>
                    )}

                    <div
                      className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-[#313079] border-[#313079]"
                          : isActive
                            ? "bg-white border-[#FF6700] shadow-[0_0_8px_rgba(255,103,0,0.4)]"
                            : "bg-white border-[#313079]/15"
                      }`}
                    >
                      {isCompleted && (
                        <Check
                          size={12}
                          strokeWidth={4}
                          className="text-white"
                        />
                      )}
                      {isActive && (
                        <div className="w-2 h-2 bg-[#FF6700] rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <div
                      className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? "text-[#FF6700]" : isCompleted ? "text-[#313079]/60" : "text-[#313079]/40"}`}
                    >
                      {step.id}. {step.title}
                    </div>

                    {isActive && (
                      <div className="mt-3 bg-white p-4 rounded-lg border border-[#FF6700]/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                        <p className="text-sm font-medium text-[#313079]/80 leading-relaxed">
                          {step.desc}
                        </p>
                        <StepVisualGuide step={step} />
                        <button
                          onClick={() => {
                            captureImage("box");
                            nextBoxStep();
                          }}
                          className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex items-center justify-center space-x-2 transition-all"
                        >
                          <Camera size={16} /> <span>Capture Image</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "ITEM_INSPECTION" && (
          <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex justify-between items-start border-b border-[#313079]/10 pb-4">
              <div>
                <h3 className="text-[10px] uppercase font-black tracking-widest text-[#FF6700] mb-1">
                  Phase 2
                </h3>
                <h2 className="text-lg font-black uppercase tracking-widest text-[#313079] leading-tight">
                  Product Verification
                </h2>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase font-bold tracking-widest text-[#313079]/50 mb-1">
                  Items Processed
                </p>
                <p className="text-base font-black font-mono text-[#313079]">
                  {itemsProcessed}{" "}
                  <span className="text-[#313079]/40">/ {expectedItems}</span>
                </p>
              </div>
            </div>

            <div className="flex-1 relative">
              {ITEM_STEPS.map((step, idx) => {
                const isActive = itemStep === step.id;
                const isCompleted = itemStep > step.id;
                const isLast = idx === ITEM_STEPS.length - 1;

                return (
                  <div key={step.id} className="relative pl-8 pb-4">
                    {!isLast && (
                      <div
                        className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? "bg-[#FF6700]/30" : "bg-[#313079]/10"}`}
                      ></div>
                    )}

                    <div
                      className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-[#313079] border-[#313079]"
                          : isActive
                            ? "bg-white border-[#FF6700] shadow-[0_0_8px_rgba(255,103,0,0.4)]"
                            : "bg-white border-[#313079]/15"
                      }`}
                    >
                      {isCompleted && (
                        <Check
                          size={12}
                          strokeWidth={4}
                          className="text-white"
                        />
                      )}
                      {isActive && (
                        <div className="w-2 h-2 bg-[#FF6700] rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <div
                      className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? "text-[#FF6700]" : isCompleted ? "text-[#313079]/60" : "text-[#313079]/40"}`}
                    >
                      {step.id}. {step.title}
                    </div>

                    {isActive && (
                      <div className="mt-3 bg-white p-4 rounded-lg border border-[#FF6700]/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                        {"instruction" in step && step.instruction && (
                          <p className="text-sm font-medium text-[#313079]/80 leading-relaxed">
                            {step.instruction}
                          </p>
                        )}

                        {"sampleImg" in step && step.sampleImg && (
                          <div className="relative w-full h-40 rounded-lg overflow-hidden border border-[#313079]/10 bg-[#FF6700]/5">
                            <img
                              src={step.sampleImg}
                              alt="Reference sample"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-[#FF6700]/80 text-white text-[10px] font-bold uppercase tracking-widest text-center py-1">
                              Reference Sample
                            </div>
                          </div>
                        )}

                        {step.id === 1 && (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="SCAN OR TYPE LPN..."
                              value={currentLpn}
                              onChange={(e) => {
                                setCurrentLpn(e.target.value);
                                setLpnScanError("");
                              }}
                              autoFocus
                              className={`w-full min-h-12 bg-white border text-[#313079] px-4 py-2 text-center text-sm font-mono focus:outline-none focus:border-[#FF6700] uppercase rounded ${
                                lpnScanError ? "border-red-400" : "border-[#313079]/20"
                              }`}
                            />
                            {lpnScanError && (
                              <p className="text-xs font-bold text-red-600 text-center">
                                {lpnScanError}
                              </p>
                            )}
                            {activeOrderPlatformId && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#313079]/50 text-center">
                                Order: {activeOrderPlatformId}
                              </p>
                            )}
                            <button
                              onClick={nextItemStep}
                              disabled={!currentLpn.trim() || isValidatingLpn}
                              className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded disabled:bg-[#313079]/10 disabled:text-[#313079]/40 transition-colors flex items-center justify-center space-x-2"
                            >
                              {isValidatingLpn ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <span>LPN Confirmed →</span>
                              )}
                            </button>
                          </div>
                        )}

                        {step.id === 2 && (
                          <button
                            onClick={() => {
                              captureImage("lpn", currentLpn);
                              nextItemStep();
                            }}
                            className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all"
                          >
                            <Camera size={16} /> <span>Capture LPN Photo</span>
                          </button>
                        )}

                        {step.id === 3 && (
                          <div className="space-y-3">
                            <ul className="text-[#313079]/80 font-medium space-y-2 text-sm list-none">
                              <li className="flex items-start space-x-2">
                                <span className="text-[#FF6700] font-black mt-0.5">
                                  ①
                                </span>
                                <span>
                                  Inspect all corners and surfaces for scratches
                                  or cracks.
                                </span>
                              </li>
                              <li className="flex items-start space-x-2">
                                <span className="text-[#FF6700] font-black mt-0.5">
                                  ②
                                </span>
                                <span>
                                  Verify all mechanical parts and buttons
                                  move/click correctly.
                                </span>
                              </li>
                              <li className="flex items-start space-x-2">
                                <span className="text-[#FF6700] font-black mt-0.5">
                                  ③
                                </span>
                                <span>
                                  Confirm all accessories listed on the slip are
                                  present.
                                </span>
                              </li>
                            </ul>
                            <button
                              onClick={nextItemStep}
                              className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded"
                            >
                              Testing Done →
                            </button>
                          </div>
                        )}

                        {step.id === 4 && (
                          <button
                            onClick={() => {
                              captureImage("product", currentLpn);
                              nextItemStep();
                            }}
                            className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all"
                          >
                            <Camera size={16} />{" "}
                            <span>Capture Product Image</span>
                          </button>
                        )}

                        {step.id === 5 && !showDefectDropdown && !showRecoveryDropdown && (
                          <div className="flex flex-col space-y-2">
                            <button
                              onClick={() => handleCategory("GOOD")}
                              className="w-full min-h-12 bg-green-600 active:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95"
                            >
                              <CheckCircle2 size={18} />{" "}
                              <span>Good — Resellable</span>
                            </button>
                            <button
                              onClick={() => handleCategory("RECOVERY")}
                              className="w-full min-h-12 bg-[#FF6700] active:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95"
                            >
                              <AlertTriangle size={18} />{" "}
                              <span>Recovery — Minor Damage</span>
                            </button>
                            <button
                              onClick={() => handleCategory("BAD")}
                              className="w-full min-h-12 bg-red-600 active:bg-red-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95"
                            >
                              <AlertOctagon size={18} />{" "}
                              <span>Bad — Unsalvageable</span>
                            </button>
                          </div>
                        )}

                        {step.id === 5 && showRecoveryDropdown && (
                          <div className="flex flex-col space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <p className="text-xs font-black uppercase tracking-widest text-[#FF6700] mb-1">
                                Select Recovery Type
                              </p>
                              <p className="text-[10px] text-orange-700 leading-relaxed font-bold">
                                Select the required recovery/refurbishment process for LPN {currentLpn}
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <button
                                onClick={() => handleRecoverySelected("Barcode Damaged")}
                                className="w-full min-h-11 bg-white border-2 border-orange-200 hover:border-[#FF6700] hover:bg-orange-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                              >
                                <span className="flex-1 pr-2">
                                  Barcode Damaged
                                </span>
                                <ArrowRight
                                  size={14}
                                  className="text-orange-400 shrink-0"
                                />
                              </button>
                              <button
                                onClick={() => handleRecoverySelected("Packaging Damaged")}
                                className="w-full min-h-11 bg-white border-2 border-orange-200 hover:border-[#FF6700] hover:bg-orange-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                              >
                                <span className="flex-1 pr-2">
                                  Packaging Damaged
                                </span>
                                <ArrowRight
                                  size={14}
                                  className="text-orange-400 shrink-0"
                                />
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setShowRecoveryDropdown(false);
                                setCurrentCategory(null);
                              }}
                              className="w-full min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/70 text-xs font-bold uppercase tracking-widest rounded transition-colors"
                            >
                              ← Back to Grade Selection
                            </button>
                          </div>
                        )}

                        {/* Amazon Claim Defect Type Dropdown — appears when BAD is selected */}
                        {step.id === 5 && showDefectDropdown && (
                          <div className="flex flex-col space-y-3">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-xs font-black uppercase tracking-widest text-red-700 mb-1">
                                {selectedClaimReason
                                  ? "2) Select Claim Sub-Reason"
                                  : "1) Select Claim Reason"}
                              </p>
                              <p className="text-[10px] text-red-600 leading-relaxed font-bold">
                                {selectedClaimReason
                                  ? `Selected Reason: ${selectedClaimReason}`
                                  : "Select the primary claim category matching Amazon's IDR portal"}
                              </p>
                            </div>
                            <div className="space-y-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                              {!selectedClaimReason
                                ? CLAIM_REASONS.map((cr) => (
                                    <button
                                      key={cr.id}
                                      onClick={() =>
                                        setSelectedClaimReason(cr.label)
                                      }
                                      className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                                    >
                                      <span className="flex-1 pr-2">
                                        {cr.label}
                                      </span>
                                      <ArrowRight
                                        size={14}
                                        className="text-red-400 shrink-0"
                                      />
                                    </button>
                                  ))
                                : CLAIM_REASONS.find(
                                    (r) => r.label === selectedClaimReason,
                                  )?.subReasons.map((csr) => (
                                    <button
                                      key={csr.value}
                                      onClick={() =>
                                        handleDefectSelected(
                                          selectedClaimReason,
                                          csr.label,
                                        )
                                      }
                                      className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                                    >
                                      <span className="flex-1 pr-2">
                                        {csr.label}
                                      </span>
                                      <ArrowRight
                                        size={14}
                                        className="text-red-400 shrink-0"
                                      />
                                    </button>
                                  ))}
                            </div>
                            <div className="flex space-x-2">
                              {selectedClaimReason ? (
                                <button
                                  onClick={() => setSelectedClaimReason(null)}
                                  className="flex-1 min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/85 text-xs font-bold uppercase tracking-widest rounded transition-colors"
                                >
                                  ← Back to Reasons
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setShowDefectDropdown(false);
                                    setCurrentCategory(null);
                                  }}
                                  className="flex-1 min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/70 text-xs font-bold uppercase tracking-widest rounded transition-colors"
                                >
                                  ← Back to Grade Selection
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {step.id === 6 && (
                          <div className="flex flex-col items-center justify-center space-y-4 py-2">
                            <div className="bg-[#FF6700]/5 p-6 rounded-xl border-2 border-[#313079]/15 text-center w-full">
                              <p className="text-sm font-bold text-[#313079]/60 uppercase tracking-widest mb-2">
                                Place item in
                              </p>
                              <p
                                className={`text-3xl font-black uppercase tracking-widest ${currentCategory === "GOOD" ? "text-green-600" : currentCategory === "RECOVERY" ? "text-[#FF6700]" : "text-red-600"}`}
                              >
                                {currentCategory} BIN
                              </p>
                            </div>
                            <button
                              onClick={handleBinning}
                              className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all"
                            >
                              <span>Confirm Binning</span>
                              <ArrowRight size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Safety Valve */}
            {itemsProcessed < expectedItems && (
              <button
                onClick={handleMissing}
                className="w-full min-h-12 mt-6 bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 active:bg-red-200 text-xs font-black uppercase tracking-widest flex items-center justify-center space-x-2 rounded transition-colors shrink-0"
              >
                <AlertTriangle size={16} /> <span>No Products Left in Box</span>
              </button>
            )}
          </div>
        )}

        {phase === "COMPLETED" && (
          <div className="flex-1 flex flex-col justify-center items-center p-8 bg-green-50 animate-in fade-in zoom-in-95 duration-300 text-center">
            <div className="bg-green-100 p-6 rounded-full mb-6 shadow-inner border-4 border-green-200">
              <CheckCircle2 size={64} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-green-700 uppercase tracking-widest mb-3">
              Order Complete
            </h2>
            <p className={`text-xs font-bold tracking-widest uppercase mb-10 bg-white px-4 py-2 rounded-full shadow-sm ${isUploading ? "text-amber-600 border border-amber-200" : "text-green-600 border border-green-200"}`}>
              {isUploading ? "Uploading evidence to Drive..." : "Evidence successfully uploaded"}
            </p>

            {missingAcknowledged && (
              <div className="bg-[#FFF700]/15 border border-[#FFF700]/50 text-[#313079] p-4 rounded-lg mb-8 flex items-center space-x-3 w-full justify-center text-left">
                <AlertTriangle size={20} className="shrink-0 text-[#FF6700]" />
                <span className="font-bold uppercase tracking-wider text-xs">
                  Missing items flagged for claims
                </span>
              </div>
            )}

            <button
              onClick={resetProcess}
              disabled={isUploading}
              className={`w-full max-w-xs min-h-14 text-sm font-black uppercase tracking-[0.15em] rounded-lg shadow-lg flex items-center justify-center space-x-3 transition-all ${
                isUploading
                  ? "bg-gray-400 cursor-not-allowed text-gray-200"
                  : "bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-transform active:scale-95"
              }`}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Uploading Evidence...</span>
                </>
              ) : (
                <>
                  <span>Process Next Order</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [activeSopAlertId, setActiveSopAlertId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const fetchAlerts = useCallback(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        if (d.alerts) setAlerts(d.alerts);
        if (d.sopMap) setSopMap(d.sopMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    if (!resolutionText.trim()) return;
    setResolvingId(alertId);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText }),
      });
      if (res.ok) {
        setResolutionText('');
        setActiveSopAlertId(null);
        fetchAlerts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-10 pt-6 px-4">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">Active Alerts</h2>
        <span className="bg-white border border-[#FF6700]/20 text-[#FF6700] px-3 py-1 font-mono text-xs rounded-full shadow-sm font-bold">{alerts.length} ALERTS</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">Loading Alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-xl">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">All Systems Normal</h3>
          <p className="text-xs text-[#313079]/60 mt-1 uppercase tracking-wider">No pending notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isSopOpen = activeSopAlertId === alert.id;
            const steps = sopMap[alert.type] || [];

            return (
              <div key={alert.id} className={`bg-white border ${alert.level === 'L4' || alert.level === 'L3' ? 'border-red-300' : 'border-[#313079]/10'} p-4 flex flex-col space-y-3 relative overflow-hidden rounded-xl shadow-sm`}>
                <div className={`absolute inset-y-0 left-0 w-1.5 ${alert.level === 'L4' || alert.level === 'L3' ? 'bg-red-500 animate-pulse' : 'bg-[#FF6700]'}`} />
                <div className="flex justify-between items-start pl-3">
                  <div>
                    <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                      alert.level === 'L4' ? 'bg-red-100 text-red-700' :
                      alert.level === 'L3' ? 'bg-red-50 text-red-600' :
                      alert.level === 'L2' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {alert.level} - {alert.type}
                    </span>
                    <h4 className="font-bold text-[#313079] mt-1 text-sm">{alert.title}</h4>
                    <p className="text-xs text-[#313079]/70 mt-1">{alert.description}</p>
                    {alert.manifest?.trackingId && (
                      <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase">Tracking: {alert.manifest.trackingId}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => setActiveSopAlertId(isSopOpen ? null : alert.id)}
                    className="text-xs text-[#FF6700] hover:text-[#FF6700]/80 font-black uppercase tracking-widest px-3 py-1 border border-[#FF6700]/20 rounded-lg hover:bg-[#FF6700]/5 transition-all"
                  >
                    {isSopOpen ? 'Close SOP' : 'View SOP'}
                  </button>
                </div>

                {isSopOpen && (
                  <div className="mt-3 pl-3 pt-3 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6700]">Standard Operating Procedure (SOP):</p>
                      <ul className="space-y-1.5">
                        {steps.map((step: any, idx: number) => (
                          <li key={step.id || idx} className="text-xs text-[#313079]/90 font-medium flex items-start space-x-2">
                            <span className="font-mono font-bold text-[#FF6700]">{step.stepOrder}.</span>
                            <span>{step.instruction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolve Alert</p>
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          placeholder="ENTER RESOLUTION DETAILS" 
                          value={resolutionText}
                          onChange={e => setResolutionText(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs uppercase tracking-widest font-bold focus:outline-none focus:border-[#FF6700] text-slate-900"
                        />
                        <button 
                          onClick={() => handleResolve(alert.id)}
                          disabled={!resolutionText.trim() || resolvingId === alert.id}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center min-w-[80px]"
                        >
                          {resolvingId === alert.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'Resolve'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
