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
  Activity,
  SwitchCamera,
  VideoIcon,
  RefreshCw,
  Home,
  Menu,
  ShieldAlert,
  Info,
  Pencil,
  ChevronRight,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/app/components/AccessDenied";
import LanguagePreference from "@/app/components/LanguagePreference";
import { getStoredLanguage, translateInstruction, PreferredLanguage } from "@/lib/i18n";

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
    return <AccessDenied message="Invalid Role Authorization" />;
  }

  return <InspectorDashboard role={role} />;
}

function StepVisualGuide({
  step,
  className = "relative w-56 h-36 rounded-lg overflow-hidden border border-[#FF6700]/20 bg-[#313079] flex items-center justify-center shrink-0 shadow-lg",
}: {
  step: { id: number; title: { en: string; hi: string } | string; desc: { en: string; hi: string } | string; sampleImg: string | string[] | null };
  className?: string;
}) {
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  useEffect(() => {
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

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

  const renderBoxContentsPlaceholder = () => {
    return (
      <svg viewBox="0 0 200 110" className="w-48 h-24 text-[#313079]/30">
        <rect
          x="40"
          y="20"
          width="120"
          height="70"
          rx="6"
          fill="none"
          stroke="#FF6700"
          strokeWidth="2"
          strokeDasharray="4,4"
        />
        <text
          x="100"
          y="50"
          textAnchor="middle"
          fill="#FF6700"
          className="text-[10px] font-black tracking-widest font-mono uppercase"
        >
          [ Open Box ]
        </text>
        <text
          x="100"
          y="68"
          textAnchor="middle"
          fill="#e2e8f0"
          className="text-[8px] font-bold uppercase tracking-wider opacity-75"
        >
          Contents Placeholder
        </text>
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
        return renderBoxContentsPlaceholder();
      default:
        return null;
    }
  };

  if (step.sampleImg) {
    const images = Array.isArray(step.sampleImg) ? step.sampleImg : [step.sampleImg];
    return (
      <div className="flex flex-col space-y-2 items-center justify-center w-full h-full p-2 bg-slate-950/5 rounded-lg border border-[#313079]/10">
        {images.map((imgSrc, index) => (
          <div key={index} className="relative flex-1 w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <img
              src={imgSrc}
              alt={`Sample reference ${index + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-[#FF6700]/80 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest text-center py-1">
              {t("Reference Sample")} {images.length > 1 ? `#${index + 1}` : ""}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
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
        <span>{t("HUD Visual Assist Active")}</span>
      </div>
    </div>
  );
}

function ProfileModal({
  user,
  onClose,
  preferredLanguage,
}: {
  user: { name: string; email: string; role: string };
  onClose: () => void;
  preferredLanguage: PreferredLanguage;
}) {
  const [profile, setProfile] = useState<any>(null);
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setProfile(d.user);
      })
      .catch(() => {});
  }, []);

  const resolvedName = profile?.name || (user.name !== user.email ? user.name : "") || user.email;
  const isEmail = resolvedName.includes("@");
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-black to-slate-900 p-8 text-white relative border-b border-black/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
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
              {user.role.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-[#FF6700]/5 border-t border-[#313079]/5 text-left">
          {profile ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-[#FF6700]/10 shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <PackageOpen size={14} className="text-[#FF6700]" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/50 leading-tight">
                      {preferredLanguage === 'hi' ? 'प्रसंस्कृत आइटम' : 'Items Inspected'}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-[#313079] font-mono">
                    {profile.itemsProcessed ?? 0}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp size={14} className="text-green-500" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/50 leading-tight">
                      {preferredLanguage === 'hi' ? 'सटीकता दर' : 'Accuracy Rate'}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-green-600 font-mono">
                    {profile.accuracyRate?.toFixed(1) ?? "100.0"}%
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity size={14} className="text-slate-400" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/50 leading-tight">
                    {preferredLanguage === 'hi' ? 'सदस्यता तिथि' : 'Member Since'}
                  </p>
                </div>
                <p className="text-sm font-bold text-[#313079]">
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs uppercase tracking-widest animate-pulse">
              {preferredLanguage === 'hi' ? 'प्रोफ़ाइल लोड हो रहा है...' : 'Loading profile...'}
            </div>
          )}

          <div className="pt-2 border-t border-[#313079]/10">
            <LanguagePreference />
          </div>

          <div className="h-px bg-[#313079]/10" />
          <p className="text-[10px] text-slate-400 text-center font-medium">
            {preferredLanguage === 'hi'
              ? 'प्रोफ़ाइल केवल पढ़ने के लिए है। विवरण अपडेट करने के लिए एडमिन से संपर्क करें।'
              : 'Profile is read-only. Contact Admin to update details.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  id,
  icon,
  label,
  activeTab,
  setActive,
  badge,
  isMinimized = false,
}: {
  id: any;
  icon: any;
  label: string;
  activeTab: any;
  setActive: any;
  badge?: number;
  isMinimized?: boolean;
}) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActive(id)}
      title={label}
      className={`w-full flex items-center ${
        isMinimized ? "justify-center" : "justify-between"
      } px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
        isActive
          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? "text-[#FFF700]" : "text-[#FF6700]/70 shrink-0"}>{icon}</span>
        {!isMinimized && <span className="truncate">{label}</span>}
      </div>
      {!isMinimized && badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold shrink-0">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {isMinimized && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-black" />
      )}
    </button>
  );
}

function InspectorDashboard({ role }: { role: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "home" | "takeover" | "inspect" | "ledger" | "alerts"
  >("home");
  const [isQaActive, setIsQaActive] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  const [ledgerCount, setLedgerCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedRole, setSelectedRole] = useState(role);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("isSidebarMinimized") === "true";
    }
    return false;
  });

  const handleLogout = async () => {
    localStorage.removeItem("userRole");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    router.push("/login");
  };

  const activeTabRef = useRef(activeTab);
  const preferredLanguageRef = useRef(preferredLanguage);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    preferredLanguageRef.current = preferredLanguage;
  }, [preferredLanguage]);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);

      if (activeTabRef.current !== "home") {
        setActiveTab("home");
      } else {
        const confirmLogout = window.confirm(
          preferredLanguageRef.current === "hi"
            ? "क्या आप लॉगआउट करना चाहते हैं?"
            : "Do you want to logout?"
        );
        if (confirmLogout) {
          handleLogout();
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const toggleSidebarMinimized = () => {
    setIsSidebarMinimized((prev) => {
      const next = !prev;
      localStorage.setItem("isSidebarMinimized", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("userRole");
      if (stored) {
        setSelectedRole(stored);
      }
    }
  }, []);

  useEffect(() => {
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserData(data.user);
      })
      .catch(console.error);

    const fetchLedgerCount = () => {
      fetch("/api/inspector/ledger")
        .then((r) => r.json())
        .then((d) => {
          if (d.ledger) setLedgerCount(d.ledger.length);
        })
        .catch(console.error);
    };

    fetchLedgerCount();
    const interval = setInterval(fetchLedgerCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = useCallback(() => {
    fetch("/api/alerts", {
      headers: { "x-user-language": preferredLanguage },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.alerts) {
          setAlerts(d.alerts);
          setAlertCount(d.alerts.length);
        }
        if (d.sopMap) setSopMap(d.sopMap);
      })
      .catch(console.error);
  }, [preferredLanguage]);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const displayName = userData?.name || (userData?.email !== userData?.name ? userData?.name : "") || userData?.email || "Inspector";
  const isEmail = displayName.includes("@");
  const initials = isEmail
    ? displayName.slice(0, 2).toUpperCase()
    : displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

  return (
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative">
      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={{ name: displayName, email: userData?.email || "", role }}
          onClose={() => setShowProfile(false)}
          preferredLanguage={preferredLanguage}
        />
      )}

      {/* Left Navigation Sidebar */}
      {!isQaActive && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 lg:z-20 ${
            isSidebarMinimized ? "lg:w-16 w-64" : "w-64"
          } bg-black text-white flex flex-col border-r border-black/10 transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Brand */}
          <div
            className={`flex items-center ${
              isSidebarMinimized ? "justify-center" : "justify-between"
            } px-6 h-16 border-b border-white/10 shrink-0`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
                <ScanEye className="text-white" size={16} />
              </div>
              {!isSidebarMinimized && (
                <div className="text-left animate-in fade-in duration-200">
                  <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none">
                    {preferredLanguage === "hi" ? "इंस्पेक्टर" : "INSPECTOR"}
                  </h1>
                </div>
              )}
            </div>
            {/* Collapse toggle (only desktop) */}
            <button
              onClick={toggleSidebarMinimized}
              className="hidden lg:block text-white/50 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
              title={
                isSidebarMinimized
                  ? preferredLanguage === "hi"
                    ? "नेविगेशन विस्तृत करें"
                    : "Expand Sidebar"
                  : preferredLanguage === "hi"
                    ? "नेविगेशन छोटा करें"
                    : "Collapse Sidebar"
              }
            >
              {isSidebarMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden text-white/50 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            <TabButton
              id="home"
              icon={<Home size={14} />}
              label={preferredLanguage === "hi" ? "होम" : "Home"}
              activeTab={activeTab}
              setActive={(tab: any) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              isMinimized={isSidebarMinimized}
            />
            <TabButton
              id="takeover"
              icon={<LinkIcon size={14} />}
              label={preferredLanguage === "hi" ? "कस्टडी टेकओवर" : "Custody Takeover"}
              activeTab={activeTab}
              setActive={(tab: any) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              isMinimized={isSidebarMinimized}
            />
            <TabButton
              id="ledger"
              icon={<FileText size={14} />}
              label={preferredLanguage === "hi" ? "कस्टडी लेजर" : "Custody Ledger"}
              activeTab={activeTab}
              setActive={(tab: any) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              badge={ledgerCount > 0 ? ledgerCount : undefined}
              isMinimized={isSidebarMinimized}
            />
            <TabButton
              id="inspect"
              icon={<ScanEye size={14} />}
              label={preferredLanguage === "hi" ? "गहन निरीक्षण" : "Deep Inspect"}
              activeTab={activeTab}
              setActive={(tab: any) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              isMinimized={isSidebarMinimized}
            />
            <TabButton
              id="alerts"
              icon={<Bell size={14} />}
              label={preferredLanguage === "hi" ? "सक्रिय अलर्ट" : "Active Alerts"}
              activeTab={activeTab}
              setActive={(tab: any) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              badge={alertCount > 0 ? alertCount : undefined}
              isMinimized={isSidebarMinimized}
            />
          </nav>

          {/* Sidebar Footer */}
          <div
            className={`p-4 border-t border-white/10 shrink-0 ${
              isSidebarMinimized ? "flex flex-col items-center space-y-4" : "space-y-3"
            }`}
          >
            {!isSidebarMinimized &&
              (role === "ADMIN" ||
                role === "SUPER_ACCESS" ||
                userData?.role === "ADMIN" ||
                userData?.role === "SUPER_ACCESS") && (
                <div className="flex flex-col space-y-1.5 px-2 w-full animate-in fade-in duration-200">
                  <label className="text-[9px] uppercase tracking-wider text-white/40 font-bold text-left">
                    {preferredLanguage === "hi" ? "भूमिका बदलें" : "Switch Role"}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedRole(val);
                        localStorage.setItem("userRole", val);
                        if (val === "SUPER_ACCESS") {
                          window.location.href = "/super-admin";
                        } else if (val === "ADMIN") {
                          window.location.href = "/admin";
                        } else if (val === "RECEIVER") {
                          window.location.href = "/receiver";
                        } else if (val === "CLAIMS_SPECIALIST") {
                          window.location.href = "/claims-specialist";
                        } else if (val === "RECOVERER") {
                          window.location.href = "/recoverer";
                        } else if (val === "QC_AGENT") {
                          window.location.href = "/qc-agent";
                        } else {
                          window.location.href = "/inspector";
                        }
                      }}
                      className="w-full bg-white/10 text-white/90 text-xs font-semibold px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-[#FF6700] hover:bg-white/20 transition-all cursor-pointer appearance-none pr-8 text-left"
                    >
                      <option value="SUPER_ACCESS" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "सुपर एक्सेस" : "Super Access"}
                      </option>
                      <option value="ADMIN" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "एडमिन" : "Admin"}
                      </option>
                      <option value="RECEIVER" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "रिसीवर" : "Receiver"}
                      </option>
                      <option value="INSPECTOR" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "इंस्पेक्टर" : "Inspector"}
                      </option>
                      <option value="CLAIMS_SPECIALIST" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "क्लेम्स स्पेशलिस्ट" : "Claims Specialist"}
                      </option>
                      <option value="RECOVERER" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "रिकवरर" : "Recoverer"}
                      </option>
                      <option value="QC_AGENT" className="bg-[#1e1d4b] text-white">
                        {preferredLanguage === "hi" ? "क्यूसी एजेंट" : "QC Agent"}
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/60">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
              )}

            {!isSidebarMinimized &&
              (role === "ADMIN" ||
                role === "SUPER_ACCESS" ||
                userData?.role === "ADMIN" ||
                userData?.role === "SUPER_ACCESS") && <div className="h-px bg-white/10 w-full"></div>}

            {/* Clickable Profile Section */}
            <button
              onClick={() => setShowProfile(true)}
              className={`w-full flex items-center ${
                isSidebarMinimized ? "justify-center" : "space-x-3 px-3"
              } py-2.5 rounded-lg hover:bg-white/10 transition-colors group text-left`}
              title={preferredLanguage === "hi" ? "प्रोफाइल देखें" : "View Profile"}
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black">
                {initials}
              </div>
              {!isSidebarMinimized && (
                <div className="min-w-0 flex-1 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-white leading-tight break-words">
                    {displayName}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-[#FF6700] font-bold mt-0.5">
                    {role.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {!isSidebarMinimized && (
                <User
                  size={12}
                  className="text-[#FF6700]/70 group-hover:text-white transition-colors shrink-0"
                />
              )}
            </button>

            <button
              onClick={handleLogout}
              className={`w-full ${
                isSidebarMinimized ? "flex justify-center p-2.5" : "px-3 py-2 text-center"
              } bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md`}
              title={preferredLanguage === "hi" ? "लॉगआउट" : "Logout"}
            >
              {isSidebarMinimized ? (
                <LogOut size={16} />
              ) : preferredLanguage === "hi" ? (
                "लॉगआउट"
              ) : (
                "Logout"
              )}
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && !isQaActive && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        {/* Mobile Top Header */}
        {!isQaActive && (
          <header className="lg:hidden bg-black text-white shrink-0 shadow-lg z-20 flex items-center justify-between px-6 h-14 border-b border-white/10 w-full">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
                <ScanEye className="text-white" size={16} />
              </div>
              <div className="text-left">
                <h1 className="text-xs font-black tracking-widest uppercase text-white leading-none truncate max-w-[120px]" title={displayName}>
                  {displayName}
                </h1>
                <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">
                  {role.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab("alerts")}
                className={`relative p-1 hover:text-white transition-colors ${activeTab === "alerts" ? "text-white" : "text-slate-400"}`}
                title={preferredLanguage === 'hi' ? "सक्रिय अलर्ट" : "Active Alerts"}
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
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#FF6700]/5 flex flex-col">
          {activeTab === "home" && (
            <div className="max-w-4xl mx-auto space-y-6 pt-10 px-6 pb-10 text-left w-full">
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-2xl p-8 relative overflow-hidden shadow-xl">
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
                  <Shield size={250} />
                </div>
                <div className="relative z-10 space-y-4">
                  <span className="px-3 py-1 bg-[#FF6700]/20 text-[#FF6700] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#FF6700]/30">
                    {preferredLanguage === 'hi' ? 'सिस्टम हब' : 'System Hub'}
                  </span>
                  <h1 className="text-3xl md:text-4xl font-black tracking-wide uppercase leading-tight">
                    {preferredLanguage === 'hi' ? 'इंस्पेक्टर वर्कस्पेस' : 'Inspector Workspace'}
                  </h1>
                  <p className="text-slate-300 text-sm max-w-xl leading-relaxed uppercase tracking-wider font-bold">
                    {preferredLanguage === 'hi'
                      ? 'डैशबोर्ड में आपका स्वागत है। कूरियर हैंडओवर, पैकेज लेज़र को प्रबंधित करें और साइडबार नियंत्रणों से गुणवत्ता आश्वासन निष्पादित करें।'
                      : 'Welcome to your dashboard. Access mechanical handshakes, package ledgers, and execute automated quality assurance from the sidebar controls.'}
                  </p>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-[#FF6700]/10 rounded-lg flex items-center justify-center text-[#FF6700]">
                      <LinkIcon size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase text-[#313079]">
                      {preferredLanguage === 'hi' ? 'कस्टडी टेकओवर' : 'Takeover Handshake'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal font-medium">
                      {preferredLanguage === 'hi'
                        ? 'प्राप्त स्टेशन से प्राप्त पैकेजों के भौतिक हैंडओवर की पुष्टि करें।'
                        : 'Confirm mechanical handover of packages received from the receiving station.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("takeover")}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors"
                  >
                    {preferredLanguage === 'hi' ? 'स्कैन पर जाएं' : 'Go to Scan'}
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                      <FileText size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase text-[#313079]">
                      {preferredLanguage === 'hi' ? 'कस्टडी लेजर' : 'Custody Ledger'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal font-medium">
                      {preferredLanguage === 'hi'
                        ? 'अपने वर्कस्टेशन को सौंपे गए उन सभी पैकेजों की समीक्षा करें जिनका निरीक्षण लंबित है।'
                        : 'Review all taken packages assigned to your workstation that are pending deep inspection.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("ledger")}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors"
                  >
                    {preferredLanguage === 'hi' ? `कतार देखें (${ledgerCount})` : `View Queue (${ledgerCount})`}
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                      <ScanEye size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase text-[#313079]">
                      {preferredLanguage === 'hi' ? 'गहन निरीक्षण' : 'Deep Inspect'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal font-medium">
                      {preferredLanguage === 'hi'
                        ? 'कैमरे कॉन्फ़िगर करें, सबूत वीडियो रिकॉर्ड करें और प्राप्त वस्तुओं की स्थिति को सूचीबद्ध करें।'
                        : 'Configure dual cameras, record evidence video, and catalog conditions of received items.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("inspect")}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors"
                  >
                    {preferredLanguage === 'hi' ? 'क्यूए शुरू करें' : 'Start QA'}
                  </button>
                </div>
              </div>

              {/* Status Board */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#313079]/50">
                    {preferredLanguage === 'hi' ? 'वर्कस्पेस मेट्रिक्स' : 'Workspace Metrics'}
                  </h4>
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                      {preferredLanguage === 'hi' ? 'प्रसंस्कृत' : 'Processed'}
                    </p>
                    <p className="text-2xl font-black font-mono text-[#313079] mt-1">{userData?.itemsProcessed ?? 0}</p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                      {preferredLanguage === 'hi' ? 'सटीकता' : 'Accuracy'}
                    </p>
                    <p className="text-2xl font-black font-mono text-green-600 mt-1">{userData?.accuracyRate?.toFixed(1) ?? "100.0"}%</p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                      {preferredLanguage === 'hi' ? 'कुल कतार' : 'Queue Size'}
                    </p>
                    <p className="text-2xl font-black font-mono text-[#FF6700] mt-1">{ledgerCount}</p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                      {preferredLanguage === 'hi' ? 'अलर्ट' : 'Alerts'}
                    </p>
                    <p className="text-2xl font-black font-mono text-red-600 mt-1">{alertCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "ledger" && <LedgerTab preferredLanguage={preferredLanguage} />}
          {activeTab === "takeover" && <TakeoverTab preferredLanguage={preferredLanguage} />}
          {activeTab === "inspect" && <InspectTab userId={userData?.id} setIsQaActive={setIsQaActive} setActiveTab={(tab: any) => { if (tab !== "profile") setActiveTab(tab); }} />}
          {activeTab === "alerts" && <NotificationsTab />}
        </div>
      </main>
    </div>
  );
}

function LedgerTab({ preferredLanguage = "en" }: { preferredLanguage?: string }) {
  const t = (text: string) => translateInstruction(text, preferredLanguage as any);
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
    <div className="h-full flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-[#313079]">
            {t("My Custody Ledger")}
          </h2>
          <p className="text-xs text-[#313079]/50 font-bold uppercase tracking-widest mt-1">
            {preferredLanguage === "hi" ? "आपके अधीन पैकेज जो निरीक्षण की प्रतीक्षा कर रहे हैं" : "Packages under your custody awaiting inspection"}
          </p>
        </div>
        <div className="bg-[#FF6700]/10 border border-[#FF6700]/20 rounded-lg px-5 py-3 text-center min-w-[80px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF6700]/70">
            {preferredLanguage === "hi" ? "पेंडिंग" : "Pending"}
          </p>
          <p className="text-3xl font-black font-mono text-[#FF6700]">{ledger.length}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#313079]/10" />

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-[#313079]/20 border-t-[#FF6700] rounded-full animate-spin" />
          <p className="text-[#313079]/60 text-xs uppercase tracking-widest font-bold animate-pulse">
            {t("Syncing Custody Ledger...")}
          </p>
        </div>
      ) : ledger.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-black uppercase tracking-widest text-[#313079]">
              {t("No Pending Inspections")}
            </h3>
            <p className="text-xs uppercase text-[#313079]/50 mt-2 font-medium max-w-xs mx-auto">
              {preferredLanguage === "hi"
                ? "कोई सक्रिय टेकओवर पैकेज नहीं है। रिसीवर से लेने के लिए टेकओवर टैब पर जाएं।"
                : "You have no active taken packages. Proceed to Takeover to pull from Receiver."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {ledger.map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                className="bg-white border border-[#313079]/10 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group"
              >
                {/* Left accent bar */}
                <div
                  className={`absolute inset-y-0 left-0 w-1.5 ${item.status === "INSPECTING" ? "bg-[#FF6700] animate-pulse" : "bg-[#313079]/20"}`}
                />

                <div className="p-5 pl-6">
                  {/* Top row */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/50 mb-1">
                        {item.marketplace || "UNKNOWN"} &bull; ORDER {item.orderId}
                      </p>
                      <p className="font-mono text-lg text-[#313079] font-black leading-tight">
                        {item.trackingId}
                      </p>
                    </div>
                    <div>
                      {item.status === "INSPECTING" ? (
                        <span className="flex items-center gap-1.5 bg-[#FF6700]/10 text-[#FF6700] px-3 py-1.5 text-[10px] font-black uppercase border border-[#FF6700]/30 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6700] animate-pulse inline-block" />
                          {t("IN PROGRESS")}
                        </span>
                      ) : (
                        <span className="bg-[#313079]/5 text-[#313079]/60 px-3 py-1.5 text-[10px] font-black uppercase border border-[#313079]/10 rounded-full">
                          {t("PENDING")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#313079]/10">
                    <div>
                      <p className="text-[10px] uppercase text-[#313079]/40 font-bold tracking-wider">
                        {t("Items Scanned")}
                      </p>
                      <div className="font-mono text-sm mt-1 text-[#313079] font-bold flex items-baseline gap-1">
                        <span className="text-green-600 text-base font-black">{item.itemsInspected}</span>
                        <span className="text-[#313079]/40 text-xs">/ {item.itemsExpected}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-32 h-1.5 bg-[#313079]/10 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${item.itemsExpected > 0 ? Math.min(100, (item.itemsInspected / item.itemsExpected) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-[#313079]/40 font-bold tracking-wider">{t("Taken:")}</p>
                      <p className="font-mono text-sm text-[#313079]/70 font-bold mt-1">
                        {new Date(item.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="font-mono text-[10px] text-[#313079]/40">
                        {new Date(item.receivedAt).toLocaleDateString([], { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TakeoverTab({ preferredLanguage = "en" }: { preferredLanguage?: string }) {
  const t = (text: string) => translateInstruction(text, preferredLanguage as any);
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
        setError(t(data.error || "Takeover failed"));
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
      setError(t(err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="absolute inset-0 bg-green-500 z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
        <CheckCircle2 size={120} className="text-white mb-8 drop-shadow-2xl" />
        <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-widest text-center leading-tight drop-shadow-lg">
          {t("Custody Transferred")}
        </h2>
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase">
          {t("Successfully!")}
        </p>
        {takenManifest && (
          <div className="mt-6 bg-white/20 backdrop-blur px-6 py-3 rounded-lg text-white text-sm font-mono">
            <p>{t("Tracking ID:")} {takenManifest.trackingId}</p>
            <p>{t("Items to Inspect:")} {takenManifest.itemCount}</p>
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
            {t("Mechanical Handshake")}
          </h2>
          <p className="text-[#313079]/60 font-bold text-sm tracking-widest mt-2 uppercase">
            {t("Scan Box from Receiver")}
          </p>
        </div>

        <div className="flex flex-col space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input
              type="text"
              placeholder={t("ENTER TRACKING ID...")}
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
                  <span>{t("Confirm Takeover")}</span>
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

function InspectTab({
  userId,
  setIsQaActive,
  setActiveTab,
}: {
  userId?: string;
  setIsQaActive?: (active: boolean) => void;
  setActiveTab?: (tab: "home" | "takeover" | "inspect" | "profile" | "ledger" | "alerts") => void;
}) {
  const router = useRouter();
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  const [phase, setPhase] = useState<
    "START" | "BOX_EVIDENCE" | "ITEM_INSPECTION" | "COMPLETED"
  >("START");
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [cameraInitTrigger, setCameraInitTrigger] = useState(0);
  const forceCameraReinit = useCallback(() => {
    setCameraInitTrigger((prev) => prev + 1);
  }, []);

  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    if (setIsQaActive) {
      setIsQaActive(phase === "BOX_EVIDENCE" || phase === "ITEM_INSPECTION");
    }
    return () => {
      if (setIsQaActive) {
        setIsQaActive(false);
      }
    };
  }, [phase, setIsQaActive]);

  useEffect(() => {
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const [boxStep, setBoxStep] = useState(1);
  const [boxStep6Part, setBoxStep6Part] = useState<1 | 2>(1);

  const [itemStep, setItemStep] = useState(1);
  const [itemsProcessed, setItemsProcessed] = useState(0);
  const [currentLpn, setCurrentLpn] = useState("");
  const [currentCategory, setCurrentCategory] = useState<
    "GOOD" | "RECOVERY" | "BAD" | null
  >(null);
  const [selectedClaimReason, setSelectedClaimReason] = useState<string | null>(null);
  const [selectedClaimSubReason, setSelectedClaimSubReason] = useState<string | null>(null);
  const [showDefectDropdown, setShowDefectDropdown] = useState(false);
  const [showRecoveryDropdown, setShowRecoveryDropdown] = useState(false);
  const [missingAcknowledged, setMissingAcknowledged] = useState(false);
  const [showMissingConfirm, setShowMissingConfirm] = useState(false);

  // Dynamic expected items
  const [expectedItems, setExpectedItems] = useState(0);
  const [expectedFnskuQuantities, setExpectedFnskuQuantities] = useState<Record<string, number>>({});
  const [isValidatingLpn, setIsValidatingLpn] = useState(false);
  const [startError, setStartError] = useState("");
  const [manifestId, setManifestId] = useState("");
  const [activeOrderPlatformId, setActiveOrderPlatformId] = useState("");
  const [displayTrackingId, setDisplayTrackingId] = useState("");
  const [displayOrderId, setDisplayOrderId] = useState("");
  const [expectedLpnItems, setExpectedLpnItems] = useState<InspectorReturnItem[]>([]);
  const [lpnScanError, setLpnScanError] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentSku, setCurrentSku] = useState<string | null>(null);
  const [currentProductName, setCurrentProductName] = useState<string | null>(null);

  // ── PREVIEW STATE ADDITIONS ────────────────────────────────────────────────
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ type: "box" | "lpn" | "product", id?: string } | null>(null);

  // ── Camera refs ────────────────────────────────────────────────────────────
  const recVideoRef = useRef<HTMLVideoElement>(null);
  const capVideoRef = useRef<HTMLVideoElement>(null);
  const recCanvasRef = useRef<HTMLCanvasElement>(null);
  const capCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const capStreamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<any>(null);
  const reqAnimRecRef = useRef<number>(0);
  const reqAnimCapRef = useRef<number>(0);

  // ── Camera selection state ──────────────────────────────────────────────────
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraPermissionState, setCameraPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [recCameraId, setRecCameraId] = useState<string>("");
  const [imgCameraId, setImgCameraId] = useState<string>("");
  
  // Hydrate camera IDs from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRecCameraId(localStorage.getItem("recording_camera_id") || "");
      setImgCameraId(localStorage.getItem("capture_camera_id") || "");
    }
  }, []);

  const handleRecCameraChange = (id: string) => {
    setRecCameraId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("recording_camera_id", id);
    }
  };

  const handleImgCameraChange = (id: string) => {
    setImgCameraId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("capture_camera_id", id);
    }
  };

  const recCameraIdRef = useRef(recCameraId);
  const imgCameraIdRef = useRef(imgCameraId);
  useEffect(() => { recCameraIdRef.current = recCameraId; }, [recCameraId]);
  useEffect(() => { imgCameraIdRef.current = imgCameraId; }, [imgCameraId]);
  
  const [dualCameraMode, setDualCameraMode] = useState(true);
  useEffect(() => {
    if (recCameraId && imgCameraId) {
      setDualCameraMode(recCameraId !== imgCameraId);
    }
  }, [recCameraId, imgCameraId]);

  const [recStreamLive, setRecStreamLive] = useState(false);
  const [capStreamLive, setCapStreamLive] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const isCameraReady = !!recCameraId && !!imgCameraId && (recCameraId !== imgCameraId) && recStreamLive && capStreamLive;

  let hardwareStatus = "";
  if (!recCameraId || !imgCameraId) {
    hardwareStatus = "Please select both cameras to configure.";
  } else if (recCameraId === imgCameraId) {
    hardwareStatus = "Recording and Capture cameras must be different.";
  } else if (!recStreamLive && !capStreamLive) {
    hardwareStatus = "Check Hardware: Both camera streams are offline.";
  } else if (!recStreamLive) {
    hardwareStatus = "Check Hardware: Recording camera stream is offline.";
  } else if (!capStreamLive) {
    hardwareStatus = "Check Hardware: Capture camera stream is offline.";
  }

  // Force back to configuration panel if cameras disconnect during Awaiting Order phase
  useEffect(() => {
    if (!isCameraReady && phase === "START") {
      setShowConfigPanel(true);
    }
  }, [isCameraReady, phase]);
  const [isSwitchingCameras, setIsSwitchingCameras] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);

  const [shutterFlash, setShutterFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraConnectionError, setCameraConnectionError] = useState<
    "BOTH_DISCONNECTED" | "REC_DISCONNECTED" | "CAP_DISCONNECTED" | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const capturedImagesRef = useRef<
    { type: "box" | "lpn" | "product" | "collage"; id?: string; step?: number; blob: Blob }[]
  >([]);
  const lpnConditionsRef = useRef<Record<string, string>>({});
  const lpnRecoveryTypesRef = useRef<Record<string, string>>({});
  const scannedLpnsRef = useRef<Set<string>>(new Set());
  const isOrderCompleteRef = useRef(false);

  const orderIdRef = useRef(orderId);
  const userIdRef = useRef(userId);
  const manifestIdRef = useRef(manifestId);
  const activeOrderPlatformIdRef = useRef(activeOrderPlatformId);
  const itemsProcessedRef = useRef(itemsProcessed);
  const expectedItemsRef = useRef(expectedItems);
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { manifestIdRef.current = manifestId; }, [manifestId]);
  useEffect(() => { activeOrderPlatformIdRef.current = activeOrderPlatformId; }, [activeOrderPlatformId]);
  useEffect(() => { itemsProcessedRef.current = itemsProcessed; }, [itemsProcessed]);
  useEffect(() => { expectedItemsRef.current = expectedItems; }, [expectedItems]);

  const resetProcess = () => {
    setPhase("START");
    setOrderId("");
    setCameraConnectionError(null);
    setManifestId("");
    setActiveOrderPlatformId("");
    setDisplayTrackingId("");
    setDisplayOrderId("");
    setExpectedLpnItems([]);
    setExpectedFnskuQuantities({});
    setIsValidatingLpn(false);
    setLpnScanError("");
    setBoxStep(1);
    setBoxStep6Part(1);
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
    setCurrentImageUrl(null);
    setCurrentSku(null);
    setShowMissingConfirm(false);
    setCurrentProductName(null);
    setPreviewDataUrl(null);
    setPreviewBlob(null);
    setPreviewMeta(null);
    isOrderCompleteRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (e) { }
    }
    setIsRecording(false);
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

  const isCameraActive = phase === "START" || phase === "BOX_EVIDENCE" || phase === "ITEM_INSPECTION";

  const enumerateAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      setAvailableCameras(cams);

      if (phaseRef.current === "START") {
        if (cams.length >= 2) {
          const currentRec = recCameraIdRef.current;
          const currentImg = imgCameraIdRef.current;
          let nextRec = cams.some((c) => c.deviceId === currentRec) && currentRec !== "" ? currentRec : cams[0].deviceId;
          let nextImg = cams.some((c) => c.deviceId === currentImg) && currentImg !== "" ? currentImg : cams[1].deviceId;
          if (nextRec === nextImg) {
            const alternate = cams.find((c) => c.deviceId !== nextRec);
            if (alternate) nextImg = alternate.deviceId;
          }
          setRecCameraId(nextRec);
          setImgCameraId(nextImg);
          setDualCameraMode(true);
        } else if (cams.length === 1) {
          setRecCameraId(cams[0].deviceId);
          setImgCameraId(cams[0].deviceId);
          setDualCameraMode(false);
        } else {
          setDualCameraMode(false);
        }
      }
    } catch (e) {
      console.error("Failed to enumerate cameras:", e);
    }
  }, []);

  const requestCameraPermission = useCallback(async () => {
    try {
      setCameraPermissionState("prompt");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermissionState("granted");
      await enumerateAvailableCameras();
    } catch (err: any) {
      console.warn("Camera permission request failed:", err);
      setCameraPermissionState("denied");
    }
  }, [enumerateAvailableCameras]);

  useEffect(() => {
    if (!isCameraActive) return;

    const checkPermission = async () => {
      if (navigator.permissions && typeof navigator.permissions.query === "function") {
        try {
          const status = await navigator.permissions.query({ name: "camera" as any });
          if (status.state === "granted") {
            setCameraPermissionState("granted");
            enumerateAvailableCameras();
          } else if (status.state === "prompt") {
            requestCameraPermission();
          } else {
            setCameraPermissionState("denied");
          }

          status.onchange = () => {
            if (status.state === "granted") {
              setCameraPermissionState("granted");
              enumerateAvailableCameras();
            } else if (status.state === "denied") {
              setCameraPermissionState("denied");
            }
          };
        } catch (e) {
          requestCameraPermission();
        }
      } else {
        requestCameraPermission();
      }
    };

    checkPermission();
  }, [isCameraActive, enumerateAvailableCameras, requestCameraPermission]);

  const startCameraStream = (
    deviceId: string,
    videoEl: HTMLVideoElement,
    constraints?: MediaTrackConstraints,
  ): Promise<MediaStream> => {
    console.log(`[Watchdog] [startCameraStream] BEFORE getUserMedia. Device ID: "${deviceId || 'default'}", Constraints:`, constraints);
    return navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, ...constraints } : constraints ?? { facingMode: "environment" } })
      .then((stream) => {
        console.log(`[Watchdog] [startCameraStream] AFTER getUserMedia SUCCESS. Device ID: "${deviceId || 'default'}". Tracks:`, stream.getVideoTracks().map(t => ({ id: t.id, label: t.label, readyState: t.readyState })));
        videoEl.srcObject = stream;
        return new Promise<MediaStream>((resolve) => {
          videoEl.onloadedmetadata = () => {
            videoEl.play().catch(console.error);
            resolve(stream);
          };
        });
      })
      .catch((err) => {
        console.error(`[Watchdog] [startCameraStream] AFTER getUserMedia ERROR. Device ID: "${deviceId || 'default'}". Error:`, err);
        throw err;
      });
  };

  const checkCameraStreams = useCallback(() => {
    if (!isCameraActive) {
      setCameraConnectionError(null);
      setRecStreamLive(false);
      setCapStreamLive(false);
      return;
    }

    const isStreamActive = (stream: MediaStream | null, expectedDeviceId?: string) => {
      if (!stream) return false;
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) return false;
      return tracks.some((track) => {
        const settings = track.getSettings();
        const activeDeviceId = settings.deviceId;
        const isLive = track.readyState === "live" && track.enabled;
        if (expectedDeviceId && activeDeviceId && activeDeviceId !== expectedDeviceId) {
          return false;
        }
        return isLive;
      });
    };

    const isRecActive = isStreamActive(recStreamRef.current, recCameraId);
    const isCapActive = isStreamActive(capStreamRef.current, imgCameraId);

    setRecStreamLive(isRecActive);
    setCapStreamLive(isCapActive);

    if (dualCameraMode) {
      if (!isRecActive && !isCapActive) setCameraConnectionError("BOTH_DISCONNECTED");
      else if (!isRecActive) setCameraConnectionError("REC_DISCONNECTED");
      else if (!isCapActive) setCameraConnectionError("CAP_DISCONNECTED");
      else setCameraConnectionError(null);
    } else {
      if (!isRecActive) setCameraConnectionError("BOTH_DISCONNECTED");
      else setCameraConnectionError(null);
    }
  }, [isCameraActive, dualCameraMode, recCameraId, imgCameraId]);

  // Keep camera streams updated reactively
  useEffect(() => {
    if (!isCameraActive) return;
    const interval = setInterval(() => {
      checkCameraStreams();
    }, 1000);
    return () => clearInterval(interval);
  }, [isCameraActive, checkCameraStreams]);

  useEffect(() => {
    if (!isCameraActive || cameraPermissionState !== "granted") return;
    if (availableCameras.length === 0 && recCameraId === "") return;
    let cancelled = false;

    const init = async () => {
      const recVideo = recVideoRef.current;
      const recCanvas = recCanvasRef.current;
      const capVideo = capVideoRef.current;
      const capCanvas = capCanvasRef.current;
      if (!recVideo || !recCanvas) return;

      // 3. Hard-Stop Safety: Explicitly stop any running stream and set to null before starting
      console.log("[Watchdog] [Hard-Stop Safety] Explicitly stopping and resetting all active camera streams...");
      try {
        if (recStreamRef.current) {
          console.log("[Watchdog] Stopping existing Recording stream tracks...");
          recStreamRef.current.getTracks().forEach((t) => t.stop());
          recStreamRef.current = null;
        }
        if (capStreamRef.current) {
          console.log("[Watchdog] Stopping existing Capture stream tracks...");
          capStreamRef.current.getTracks().forEach((t) => t.stop());
          capStreamRef.current = null;
        }
        imageCaptureRef.current = null;
        setRecStreamLive(false);
        setCapStreamLive(false);
        console.log("[Watchdog] Hard-Stop Safety reset complete.");
      } catch (cleanupErr) {
        console.error("[Watchdog] Error during cleanup reset phase:", cleanupErr);
      }

      // 4. Wrap the entire camera boot sequence in a single try...catch
      try {
        // 1. Sequential Boot: Boot Recording camera first (ideal 1280x720 to reduce CPU/GPU load)
        console.log(`[Watchdog] Booting Recording Camera: "${recCameraId}"`);
        const recStream = await startCameraStream(
          recCameraId,
          recVideo,
          { width: { ideal: 1280 }, height: { ideal: 720 } },
        );
        if (cancelled) { 
          console.log("[Watchdog] Initialization cancelled during Recording Camera boot. Stopping tracks.");
          recStream.getTracks().forEach((t) => t.stop()); 
          return; 
        }
        recStreamRef.current = recStream;
        recStream.getVideoTracks().forEach((track) => {
          track.onended = () => { checkCameraStreams(); };
        });

        recCanvas.width = recVideo.videoWidth || 1280;
        recCanvas.height = recVideo.videoHeight || 720;
        console.log("[Watchdog] Recording Camera booted successfully.");

        // Safety Stagger Delay of 500ms before starting the Capture camera
        console.log("[Watchdog] Waiting 500ms safety stagger delay before starting Capture Camera...");
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 1. Sequential Boot: Boot Capture camera second (or clone Recording stream) (ideal 1080p instead of 4K to save resources)
        if (dualCameraMode && capVideo && capCanvas && imgCameraId) {
          console.log(`[Watchdog] Booting Capture Camera: "${imgCameraId}"`);
          const capStream = await startCameraStream(
            imgCameraId,
            capVideo,
            { width: { ideal: 1920 }, height: { ideal: 1080 } },
          );
          if (cancelled) { 
            console.log("[Watchdog] Initialization cancelled during Capture Camera boot. Stopping tracks.");
            capStream.getTracks().forEach((t) => t.stop()); 
            return; 
          }
          capStreamRef.current = capStream;
          capStream.getVideoTracks().forEach((track) => {
            track.onended = () => { checkCameraStreams(); };
          });
          const track = capStream.getVideoTracks()[0];
          if (track && typeof (window as any).ImageCapture !== "undefined") {
            imageCaptureRef.current = new (window as any).ImageCapture(track);
          }
          console.log("[Watchdog] Capture Camera booted successfully.");
        } else if (!dualCameraMode && capVideo && capCanvas) {
          console.log("[Watchdog] Cloning Recording stream for Capture view (Single Camera Mode)...");
          if (recStreamRef.current) {
            recVideo.onloadedmetadata = null;
            capVideo.srcObject = recStreamRef.current;
            capCanvas.width = recCanvas.width;
            capCanvas.height = recCanvas.height;
            await capVideo.play().catch(() => { });
            const track = recStreamRef.current.getVideoTracks()[0];
            if (track && typeof (window as any).ImageCapture !== "undefined") {
              imageCaptureRef.current = new (window as any).ImageCapture(track);
            }
          }
          console.log("[Watchdog] Capture View setup complete (cloned stream).");
        }

        checkCameraStreams();
        setBootError(null);
        console.log("[Watchdog] Sequential camera boot completed successfully.");
      } catch (err: any) {
        console.error("[Watchdog] CAMERA BOOT SEQUENCE FAILED:", err);
        setBootError(err.message || String(err));
      }

      try {
        if (!mediaRecorderRef.current && recStreamRef.current) {
          // ✅ Record directly from the raw camera MediaStream — eliminates the canvas draw loop
          // and offloads encoding to hardware-accelerated browser codecs, preventing OOM crashes.
          const recordingStream = recStreamRef.current;

          // Pick the best supported codec at a low bitrate to stay within laptop memory limits
          let options = { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 200000 };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: "video/webm", videoBitsPerSecond: 200000 };
          }

          const mr = new MediaRecorder(recordingStream, options);

          mediaRecorderRef.current = mr;
          chunksRef.current = [];
          mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          mr.onstop = () => {
            if (!isOrderCompleteRef.current) return;
            // ⚠️ Read all values from refs — onstop is a stale closure
            const activeOrderId = orderIdRef.current;
            const activeUserId = userIdRef.current || "";
            const activeUserRole = (typeof localStorage !== "undefined" ? localStorage.getItem("userRole") : null) || "INSPECTOR";
            const activeManifestId = manifestIdRef.current;
            const activePlatformOrderId = activeOrderPlatformIdRef.current;
            const capturedImages = [...capturedImagesRef.current];
            const lpnConditions = { ...lpnConditionsRef.current };
            const lpnRecoveryTypes = { ...lpnRecoveryTypesRef.current };
            const itemsScanned = itemsProcessedRef.current;
            const itemsExpected = expectedItemsRef.current;
            const isMissingItemFlagged = itemsProcessedRef.current < expectedItemsRef.current;

            resetProcess();

            const backgroundUpload = async () => {
              if (!activeOrderId) return;
              setIsUploading(true);
              const filesToUpload: { key: string; name: string; mimeType: string; lpn?: string; blob: Blob }[] = [];
              try {
                const videoChunks = chunksRef.current.length > 0 ? chunksRef.current : [new Blob(["empty-video-fallback"], { type: "video/webm" })];
                const blob = new Blob(videoChunks, { type: "video/webm" });
                filesToUpload.push({ key: "file", name: "video-proof.webm", mimeType: "video/webm", blob });

                let boxCounter = 1;
                const lpnCounters: Record<string, number> = {};
                capturedImages.forEach((img) => {
                  if (!img.blob || img.blob.size === 0) return;
                  if (img.type === "box") {
                    const stepNum = img.step || boxCounter;
                    filesToUpload.push({ key: `step_${stepNum}`, name: `step${stepNum}.jpg`, mimeType: "image/jpeg", blob: img.blob });
                    boxCounter++;
                  } else if ((img.type === "lpn" || img.type === "product") && img.id) {
                    const lpn = img.id;
                    if (!lpnCounters[lpn]) lpnCounters[lpn] = 1;
                    const stepNum = lpnCounters[lpn]++;
                    filesToUpload.push({ key: `${img.type}_img_${img.id}`, name: `step${stepNum}.jpg`, mimeType: "image/jpeg", blob: img.blob, lpn: img.id });
                  } else if (img.type === "collage" && img.id) {
                    const lpn = img.id;
                    if (!lpnCounters[lpn]) lpnCounters[lpn] = 1;
                    const stepNum = lpnCounters[lpn]++;
                filesToUpload.push({ key: `collage_img_${img.id}`, name: `step${stepNum}.jpg`, mimeType: "image/jpeg", blob: img.blob, lpn: img.id });
                  }
                });

                const filesMetaData = filesToUpload.map((f) => ({
                  key: f.key, name: f.name, mimeType: f.mimeType, lpn: f.lpn, condition: f.lpn ? lpnConditions[f.lpn] : undefined,
                }));

                const initRes = await fetch("/api/upload/init", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: activeOrderId, type: "INSPECTION_VIDEO", filesMetaData }),
                });
                if (!initRes.ok) throw new Error("Failed to initialize Google Drive upload");
                const { uploadUrls, folderLink, orderFolderId, lpnFolderLinks } = await initRes.json();

                try {
                  if (!activeUserId) throw new Error("[Evaluate] Missing user ID – cannot submit inspection results.");
                  const evalRes = await fetch("/api/inspector/evaluate", {
                    method: "POST", headers: { "Content-Type": "application/json", "x-user-role": activeUserRole, "x-user-id": activeUserId },
                    body: JSON.stringify({ manifestId: activeManifestId, orderPlatformId: activePlatformOrderId, itemsScanned, itemsExpected, isMissingItemFlagged, lpnConditions, lpnRecoveryTypes, evidenceUrl: folderLink || null, orderDriveLink: folderLink || null, lpnFolderLinks: lpnFolderLinks || null }),
                  });
                  if (!evalRes.ok) {
                    const errData = await evalRes.json().catch(() => ({}));
                    console.error("[BG Upload] Evaluate failed:", evalRes.status, errData);
                  } else {
                    console.log("[BG Upload] Evaluate succeeded.");
                  }
                } catch (evalErr) { console.error("[BG Upload] Early evaluate error:", evalErr); }

                // ─── Helper: compress a JPEG image blob client-side ───────────────────────
                // Reduces JPEG captures to ≤ 1 MB so they stay well under Vercel's 4.5 MB
                // request body limit when sent to /api/upload/raw.
                const compressImage = async (blob: Blob, quality = 0.65): Promise<Blob> => {
                  try {
                    const bmp = await createImageBitmap(blob);
                    const canvas = document.createElement("canvas");
                    canvas.width = bmp.width;
                    canvas.height = bmp.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return blob;
                    ctx.drawImage(bmp, 0, 0);
                    return await new Promise<Blob>((res, rej) =>
                      canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", quality)
                    );
                  } catch {
                    return blob; // fall back to original if compression fails
                  }
                };

                // ─── Helper: upload a small file (image) to /api/upload/raw ──────────────
                const uploadSmallFile = async (f: { key: string; name: string; blob: Blob }, url: string) => {
                  // Compress JPEG images to stay under Vercel's 4.5 MB body limit
                  let uploadBlob = f.blob;
                  if (f.blob.type === "image/jpeg" && f.blob.size > 1_000_000) {
                    uploadBlob = await compressImage(f.blob, 0.65);
                    console.log(`[Upload] Compressed ${f.name}: ${(f.blob.size / 1024).toFixed(0)} KB → ${(uploadBlob.size / 1024).toFixed(0)} KB`);
                  }
                  const timeoutMs = Math.max(30000, Math.min(120000, Math.ceil((uploadBlob.size / 100000) * 1000)));
                  let lastError = null;
                  for (let attempt = 1; attempt <= 3; attempt++) {
                    const controller = new AbortController();
                    const tid = setTimeout(() => controller.abort(), timeoutMs);
                    try {
                      const res = await fetch(url, { method: "PUT", body: uploadBlob, signal: controller.signal });
                      clearTimeout(tid);
                      if (res.ok) return;
                      lastError = new Error(`Status ${res.status}`);
                    } catch (err: any) {
                      clearTimeout(tid);
                      lastError = err;
                    }
                    if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
                  }
                  throw new Error(`Failed to upload ${f.name} after 3 attempts: ${lastError?.message || "unknown"}`);
                };

                // ─── Helper: upload video via Google Drive Resumable Upload ───────────────
                // 1. Ask server for a resumable session URI (only the token exchange hits Vercel)
                // 2. Send 5 MB chunks directly to Google's servers — no Vercel body size limit
                // 3. After upload completes, tell server to set public permissions
                const uploadVideoResumable = async (
                  f: { key: string; name: string; mimeType: string; blob: Blob },
                  targetFolderId: string
                ) => {
                  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — Google minimum for resumable is 256 KB
                  const totalSize = f.blob.size;

                  console.log(`[Resumable] Starting upload for ${f.name} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);

                  // Step 1: Get resumable session URI from our server
                  const sessionRes = await fetch("/api/upload/resumable-init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folderId: targetFolderId, name: f.name, mimeType: f.mimeType, fileSize: totalSize }),
                  });
                  if (!sessionRes.ok) {
                    throw new Error(`Failed to create resumable session: ${sessionRes.status}`);
                  }
                  const { sessionUri } = await sessionRes.json();

                  // Step 2: Upload chunks directly to Google
                  let uploadedBytes = 0;
                  const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));

                  for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, totalSize);
                    const chunk = f.blob.slice(start, end);

                    let chunkOk = false;
                    let lastErr: any = null;

                    for (let attempt = 1; attempt <= 3; attempt++) {
                      const controller = new AbortController();
                      const tid = setTimeout(() => controller.abort(), 120000); // 2 min per chunk
                      try {
                        const res = await fetch(sessionUri, {
                          method: "PUT",
                          headers: {
                            "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
                            "Content-Type": f.mimeType,
                          },
                          body: chunk,
                          signal: controller.signal,
                        });
                        clearTimeout(tid);
                        // 200/201 = complete, 308 = chunk accepted (resume incomplete)
                        if (res.status === 200 || res.status === 201 || res.status === 308) {
                          uploadedBytes = end;
                          chunkOk = true;
                          break;
                        }
                        lastErr = new Error(`Google returned status ${res.status}`);
                      } catch (err: any) {
                        clearTimeout(tid);
                        lastErr = err;
                      }
                      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
                    }

                    if (!chunkOk) {
                      throw new Error(`Chunk ${i + 1}/${totalChunks} failed after 3 attempts: ${lastErr?.message || "unknown"}`);
                    }
                    console.log(`[Resumable] Chunk ${i + 1}/${totalChunks} uploaded (${(uploadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
                  }

                  // Step 3: Set file permissions via server (client doesn't have OAuth token)
                  const finalizeRes = await fetch("/api/upload/resumable-finalize-by-name", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folderId: targetFolderId, name: f.name }),
                  });
                  if (!finalizeRes.ok) {
                    console.warn("[Resumable] Could not finalize/set permissions, but upload succeeded.");
                  } else {
                    const fd = await finalizeRes.json();
                    console.log(`[Resumable] Upload complete. webViewLink: ${fd.webViewLink}`);
                  }
                };

                for (const f of filesToUpload) {
                  if (f.key === "file") {
                    await uploadVideoResumable(f, orderFolderId);
                  } else {
                    const url = uploadUrls[f.key];
                    if (url) await uploadSmallFile(f, url);
                  }
                }

                const cleanUserId = activeUserId && activeUserId !== "undefined" && activeUserId !== "null" ? activeUserId : undefined;
                const finalizeRes = await fetch("/api/upload/finalize", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: activeOrderId, manifestId: activeManifestId, orderPlatformId: activePlatformOrderId, folderLink, orderFolderId, type: "INSPECTION_VIDEO", uploadedById: cleanUserId, reason: "Complete Order Inspection Folder", lpnConditions, lpnRecoveryTypes }),
                });
                if (!finalizeRes.ok) {
                  throw new Error(`Failed to finalize upload: ${finalizeRes.status}`);
                }
              } catch (e: any) {
                console.error("Silent background pipeline failed:", e);
                // Trigger local backup on failure — video is chunked to stay under Vercel body limits
                for (const f of filesToUpload) {
                  try {
                    if (f.blob.type.startsWith("video/") && f.blob.size > 2 * 1024 * 1024) {
                      // Chunk the video backup in 2 MB slices — Vercel hard limit is 4.5 MB,
                      // 2 MB leaves a safe margin for request headers and overhead.
                      const BACKUP_CHUNK = 2 * 1024 * 1024;
                      const totalChunks = Math.ceil(f.blob.size / BACKUP_CHUNK);
                      for (let i = 0; i < totalChunks; i++) {
                        const chunk = f.blob.slice(i * BACKUP_CHUNK, Math.min((i + 1) * BACKUP_CHUNK, f.blob.size));
                        const chunkName = `${f.name}.part${i}of${totalChunks}`;
                        const backupRes = await fetch(`/api/upload/backup?trackingId=${encodeURIComponent(activeOrderId)}&filename=${encodeURIComponent(chunkName)}`, {
                          method: "PUT",
                          body: chunk,
                        });
                        if (backupRes.ok) {
                          console.log(`[Local Backup] Saved video chunk ${i + 1}/${totalChunks} → failed_uploads/${activeOrderId}/${chunkName}`);
                        }
                      }
                    } else {
                      const backupRes = await fetch(`/api/upload/backup?trackingId=${encodeURIComponent(activeOrderId)}&filename=${encodeURIComponent(f.name)}`, {
                        method: "PUT",
                        body: f.blob,
                      });
                      if (backupRes.ok) {
                        console.log(`[Local Backup] Successfully saved ${f.name} locally to failed_uploads/${activeOrderId}`);
                      } else {
                        console.error(`[Local Backup] Failed to save ${f.name} locally: status ${backupRes.status}`);
                      }
                    }
                  } catch (backupErr: any) {
                    console.error(`[Local Backup] Error saving ${f.name} locally:`, backupErr);
                  }
                }
              } finally { setIsUploading(false); }
            };
            backgroundUpload();
          };
          if (phaseRef.current !== "START") {
            mr.start(1000);
            setIsRecording(true);
          }
        }
      } catch (e) { console.error("MediaRecorder init failed", e); }
      checkCameraStreams();
    };

    init();
    return () => {
      cancelled = true;
      if (reqAnimRecRef.current) cancelAnimationFrame(reqAnimRecRef.current);
      if (reqAnimCapRef.current) cancelAnimationFrame(reqAnimCapRef.current);
      if (phaseRef.current === "START" || isOrderCompleteRef.current) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsRecording(false);
      }
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
      capStreamRef.current?.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
      capStreamRef.current = null;
      imageCaptureRef.current = null;
    };
  }, [isCameraActive, recCameraId, imgCameraId, dualCameraMode, cameraInitTrigger]);

  useEffect(() => {
    if ((phase === "BOX_EVIDENCE" || phase === "ITEM_INSPECTION") && mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
      try {
        chunksRef.current = [];
        mediaRecorderRef.current.start(1000);
        setIsRecording(true);
      } catch (e) { }
    }
  }, [phase]);

  // ── Canvas draw loop removed: MediaRecorder now records directly from the camera stream ──
  // The canvas + draw loop + captureStream pipeline was causing OOM STATUS_BREAKPOINT crashes
  // because it ran a 60Hz rAF loop + GPU canvas compositing + VP8 software encoding simultaneously.
  // Direct stream recording lets the browser use hardware-accelerated codecs instead.

  const swapCameras = async () => {
    if (!dualCameraMode || isSwitchingCameras) return;
    setIsSwitchingCameras(true);
    setRecCameraId(imgCameraId);
    setImgCameraId(recCameraId);
    setTimeout(() => setIsSwitchingCameras(false), 1200);
  };

  // ✅ FIX: Removed the "devicechange" listener to prevent the infinite WebRTC crash loop
  useEffect(() => {
    if (!isCameraActive) { setCameraConnectionError(null); return; }
    checkCameraStreams();
    const interval = setInterval(() => { checkCameraStreams(); }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [isCameraActive, checkCameraStreams]);

  useEffect(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    const isRecDisconnected = cameraConnectionError === "BOTH_DISCONNECTED" || cameraConnectionError === "REC_DISCONNECTED";
    if (isRecDisconnected) {
      if (mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.pause(); } catch (e) { }
      }
    } else {
      if (mediaRecorderRef.current.state === "paused") {
        try { mediaRecorderRef.current.resume(); } catch (e) { }
      }
    }
  }, [cameraConnectionError]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const isRecDisconnected = cameraConnectionError === "BOTH_DISCONNECTED" || cameraConnectionError === "REC_DISCONNECTED";
    if (isRecording && !isRecDisconnected) {
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else if (!isRecording) {
      setTimeout(() => setRecordingTime(0), 0);
    }
    return () => clearInterval(interval);
  }, [isRecording, cameraConnectionError]);

  const pushCapturedBlob = (
    blob: Blob,
    type: "box" | "lpn" | "product",
    identifier?: string,
  ) => {
    capturedImagesRef.current!.push({ type, id: identifier, step: boxStep, blob });

    if (type === "product" && currentImageUrl && identifier) {
      const camImg = new Image();
      camImg.onload = () => {
        const shopifyImg = new Image();
        shopifyImg.crossOrigin = "anonymous";
        shopifyImg.onload = () => {
          const COLLAGE_H = 600;
          const camW = Math.round((camImg.width / camImg.height) * COLLAGE_H);
          const shopW = Math.round((shopifyImg.naturalWidth / shopifyImg.naturalHeight) * COLLAGE_H);
          const GAP = 12;
          const BADGE_H = 36;
          const collage = document.createElement("canvas");
          collage.height = COLLAGE_H + BADGE_H;
          collage.width = shopW + GAP + camW;
          const cCtx = collage.getContext("2d")!;
          cCtx.fillStyle = "#0f172a";
          cCtx.fillRect(0, 0, collage.width, collage.height);
          cCtx.drawImage(shopifyImg, 0, 0, shopW, COLLAGE_H);
          cCtx.fillStyle = "rgba(99,102,241,0.85)";
          cCtx.fillRect(0, COLLAGE_H, shopW, BADGE_H);
          cCtx.fillStyle = "#fff"; cCtx.font = "bold 13px sans-serif"; cCtx.textAlign = "center";
          cCtx.fillText(t("SHOPIFY REFERENCE"), shopW / 2, COLLAGE_H + 23);
          cCtx.fillStyle = "#1e293b";
          cCtx.fillRect(shopW, 0, GAP, collage.height);
          cCtx.drawImage(camImg, shopW + GAP, 0, camW, COLLAGE_H);
          cCtx.fillStyle = "rgba(239,68,68,0.85)";
          cCtx.fillRect(shopW + GAP, COLLAGE_H, camW, BADGE_H);
          cCtx.fillStyle = "#fff";
          cCtx.fillText(t("RECEIVED ITEM"), shopW + GAP + camW / 2, COLLAGE_H + 23);
          collage.toBlob((b) => {
            if (b) capturedImagesRef.current!.push({ type: "collage", id: identifier, blob: b });
          }, "image/jpeg", 0.88);
        };
        shopifyImg.onerror = () => { };
        shopifyImg.src = currentImageUrl!;
      };
      camImg.src = URL.createObjectURL(blob);
    }
  };

  const captureImage = (type: "box" | "lpn" | "product", identifier?: string) => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    const doCapture = async () => {
      let rawBlob: Blob | null = null;
      if (imageCaptureRef.current) {
        try {
          const ic = imageCaptureRef.current;
          const caps = await ic.getPhotoCapabilities?.();
          rawBlob = await ic.takePhoto(
            caps?.imageWidth?.max
              ? { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max }
              : {},
          );
        } catch { rawBlob = null; }
      }
      if (!rawBlob) {
        const video = capVideoRef.current;
        const canvas = capCanvasRef.current;
        if (video && canvas) {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            rawBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
          }
        }
      }
      if (!rawBlob) return;

      setPreviewBlob(rawBlob);
      setPreviewMeta({ type, id: identifier });
      setPreviewDataUrl(URL.createObjectURL(rawBlob));
    };

    doCapture();
  };

  const handleRetakePreview = () => {
    if (previewDataUrl) URL.revokeObjectURL(previewDataUrl);
    setPreviewDataUrl(null);
    setPreviewBlob(null);
    setPreviewMeta(null);
  };

  const handleConfirmPreview = () => {
    if (previewBlob && previewMeta) {
      pushCapturedBlob(previewBlob, previewMeta.type, previewMeta.id);
    }
    const type = previewMeta?.type;
    handleRetakePreview();

    if (type === "box") nextBoxStep();
    else nextItemStep();
  };

  const stopAndFinalizeRecording = () => {
    isOrderCompleteRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const triggerXp = (amount: number) => { };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setStartError("");

    if (!userId) {
      setStartError(t("Authentication error. Please log in again."));
      return;
    }

    if (!isCameraReady) {
      setStartError(t("Warning: Cameras are not ready. Please configure cameras correctly first."));
      return;
    }

    try {
      const res = await fetch(`/api/manifest/${encodeURIComponent(orderId.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const manifest = data.manifest;

        if (!manifest) { setStartError(t("This Order ID / Tracking ID is not found in the system.")); return; }
        if (manifest.status !== "IN_INSPECTION") { setStartError(t("This package is not active in your inspection stack. Take custody from the receiver before scanning.")); return; }
        if (manifest.inspection?.completedAt) { setStartError(t("This package has already been inspected.")); return; }

        setManifestId(manifest.id);
        setDisplayTrackingId(manifest.trackingId || "");
        setDisplayOrderId(manifest.removalOrderId || "");

        const resolvedOrderId = manifest.matchedOrderId || "";
        const manifestOrderIds = Array.from(new Set((manifest.returnItems || []).map((ri: any) => ri.orderId).filter(Boolean)));

        if (!resolvedOrderId && manifestOrderIds.length > 1) {
          setStartError(t("This tracking ID contains multiple orders. Please scan the exact Order ID before inspection."));
          return;
        }

        const scopedReturnItems = (manifest.returnItems || []).filter((ri: any) => resolvedOrderId ? ri.orderId === resolvedOrderId : true);

        setActiveOrderPlatformId(resolvedOrderId || (manifestOrderIds[0] as string) || "");
        setExpectedLpnItems(
          scopedReturnItems.filter((ri: any) => ri.lpn).map((ri: any) => ({
            lpn: String(ri.lpn).trim(), orderId: ri.orderId, sku: ri.sku, quantity: ri.quantity,
          })),
        );

        const totalExpected = manifest.totalExpectedQuantity || 1;
        setExpectedItems(totalExpected);

        const fnskuMap: Record<string, number> = {};
        if (manifest.expectedFnskus && Array.isArray(manifest.expectedFnskus)) {
          for (const item of manifest.expectedFnskus) {
            if (item.fnsku) fnskuMap[String(item.fnsku).trim().toUpperCase()] = item.quantity || 0;
          }
        }
        setExpectedFnskuQuantities(fnskuMap);
      } else {
        setStartError("This Order ID / Tracking ID is not found in the system.");
        return;
      }
    } catch {
      setStartError(t("Failed to verify custody. Please try again."));
      return;
    }

    setPhase("BOX_EVIDENCE");
    triggerXp(50);
  };

  const nextBoxStep = () => {
    triggerXp(20);
    setBoxStep6Part(1);
    if (boxStep < 8) setBoxStep((prev) => prev + 1);
    else setPhase("ITEM_INSPECTION");
  };

  const nextItemStep = async () => {
    if (itemStep === 1) {
      const ok = await confirmCurrentLpn();
      if (!ok) return;
    }
    triggerXp(30);
    if (itemStep < 7) setItemStep((prev) => prev + 1);
  };

  // ── UNIFIED BACK NAVIGATION ──────────────────────────────────────────────────
  const handleBack = () => {
    if (phase === "ITEM_INSPECTION") {
      if (itemStep > 1) {
        setItemStep((prev) => prev - 1);
      } else {
        setPhase("BOX_EVIDENCE");
        setBoxStep(BOX_STEPS.length);
      }
    } else if (phase === "BOX_EVIDENCE") {
      if (boxStep === 6 && boxStep6Part === 2) {
        setBoxStep6Part(1);
      } else if (boxStep > 1) {
        setBoxStep((prev) => prev - 1);
        if (boxStep - 1 === 6) setBoxStep6Part(2);
      }
    }
  };

  const normalizeLpn = (value: string) => value.trim().toUpperCase();

  const confirmCurrentLpn = async () => {
    const scannedLpn = currentLpn.trim().toUpperCase();
    if (!scannedLpn) { setLpnScanError(t("Scan or type the LPN before continuing.")); return false; }
    if (scannedLpnsRef.current.has(scannedLpn)) { setLpnScanError(t("This LPN has already been scanned for this order.")); return false; }

    setIsValidatingLpn(true);
    setLpnScanError("");

    try {
      const res = await fetch(`/api/product/status?lpn=${encodeURIComponent(scannedLpn)}&orderId=${encodeURIComponent(activeOrderPlatformId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLpnScanError(data.error || t("LPN validation failed."));
        setIsValidatingLpn(false);
        return false;
      }
      const itemInfo = await res.json();
      const resolvedFnsku = String(itemInfo.fnsku || "").trim().toUpperCase();
      const remainingQty = expectedFnskuQuantities[resolvedFnsku] ?? 0;

      if (!(resolvedFnsku in expectedFnskuQuantities)) {
        setLpnScanError(t(`This item (FNSKU: ${resolvedFnsku}) is not expected in this removal order.`));
        setIsValidatingLpn(false);
        return false;
      }
      if (remainingQty <= 0) {
        setLpnScanError(t(`All expected units of this item (FNSKU: ${resolvedFnsku}) have already been scanned.`));
        setIsValidatingLpn(false);
        return false;
      }

      setExpectedFnskuQuantities(prev => ({ ...prev, [resolvedFnsku]: remainingQty - 1 }));
      setCurrentImageUrl(itemInfo.imageUrl || null);
      setCurrentSku(itemInfo.sku || null);
      setCurrentProductName(itemInfo.productName || null);
      setCurrentLpn(scannedLpn);
      setLpnScanError("");
      setIsValidatingLpn(false);
      return true;
    } catch (err) {
      setLpnScanError(t("Connection error while validating LPN."));
      setIsValidatingLpn(false);
      return false;
    }
  };

  const CLAIM_REASONS = [
    {
      id: "damaged_used", label: "I received damaged/ used item(s)",
      subReasons: [{ value: "heavily_damaged", label: "Item(s) heavily damaged" }, { value: "minor_damages", label: "Item(s) with minor damages/dents/scratches" }, { value: "packaging_damaged", label: "Only product packaging damaged" }],
    },
    {
      id: "different_empty", label: "I received different item or empty box",
      subReasons: [{ value: "different_junk", label: "Different/junk item received" }, { value: "empty_box", label: "Empty box received" }, { value: "fake_counterfeit", label: "Fake/ replica/ counterfeit item received" }],
    },
    {
      id: "missing_quantity", label: "I received removal order with missing quantity/ accessories/parts",
      subReasons: [{ value: "missing_parts", label: "Missing parts/accessories/components" }, { value: "missing_main_item", label: "Missing main item" }],
    },
  ];

  const CLAIM_TRANSLATIONS: Record<string, string> = {
    "I received damaged/ used item(s)": "मुझे क्षतिग्रस्त/उपयोग किया हुआ सामान मिला",
    "Item(s) heavily damaged": "सामान भारी रूप से क्षतिग्रस्त है",
    "Item(s) with minor damages/dents/scratches": "सामान में मामूली नुकसान/डेंट/खरोंच हैं",
    "Only product packaging damaged": "केवल उत्पाद की पैकेजिंग क्षतिग्रस्त है",
    "I received different item or empty box": "मुझे दूसरा सामान या खाली बॉक्स मिला",
    "Different/junk item received": "दूसरा/कबाड़ सामान मिला",
    "Empty box received": "खाली बॉक्स मिला",
    "Fake/ replica/ counterfeit item received": "नकली/प्रतिकृति/जाली सामान मिला",
    "I received removal order with missing quantity/ accessories/parts": "मुझे कम मात्रा/सामग्री/पुर्जे के साथ रिमूवल ऑर्डर मिला",
    "Missing parts/accessories/components": "पुर्जे/सामग्री/घटक गायब हैं",
    "Missing main item": "मुख्य सामान गायब है"
  };

  const translateClaimLabel = (text: string | null): string => {
    if (!text) return "";
    if (lang === 'hi' && CLAIM_TRANSLATIONS[text]) {
      return CLAIM_TRANSLATIONS[text];
    }
    return text;
  };


  const handleCategory = (cat: "GOOD" | "RECOVERY" | "BAD") => {
    triggerXp(100);
    setCurrentCategory(cat);
    if (cat === "BAD") {
      setShowDefectDropdown(true); setShowRecoveryDropdown(false); setSelectedClaimReason(null); setSelectedClaimSubReason(null);
    } else if (cat === "RECOVERY") {
      lpnConditionsRef.current[currentLpn] = "PACKAGING_DAMAGED";
      setShowDefectDropdown(false); setShowRecoveryDropdown(true); setSelectedClaimReason(null); setSelectedClaimSubReason(null);
    } else {
      lpnConditionsRef.current[currentLpn] = "GOOD_SELLABLE";
      setShowDefectDropdown(false); setShowRecoveryDropdown(false); setSelectedClaimReason(null); setSelectedClaimSubReason(null);
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
    lpnConditionsRef.current[currentLpn] = `bad:${reason}::${subReason}`;
    setShowDefectDropdown(false);
    nextItemStep();
  };

  const handleBinning = () => {
    const finalizedLpn = currentLpn;
    const finalizedCondition = finalizedLpn ? lpnConditionsRef.current[finalizedLpn] : undefined;

    if (finalizedLpn && finalizedCondition) {
      void fetch("/api/product/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: finalizedLpn, condition: finalizedCondition, orderPlatformId: activeOrderPlatformId, recoveryType: finalizedLpn ? lpnRecoveryTypesRef.current[finalizedLpn] : undefined }),
      }).catch((error) => console.error("[Live Product Status] failed:", error));
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
    setCurrentImageUrl(null);
    setCurrentSku(null);
    setCurrentProductName(null);
    setItemStep(1);

    if (newProcessed >= expectedItems) stopAndFinalizeRecording();
  };

  const handleMissing = () => { stopAndFinalizeRecording(); setMissingAcknowledged(true); };

  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';

  const BOX_STEPS = [
    {
      id: 1,
      title: { en: "Top Side", hi: "ऊपरी साइड" },
      desc: { en: "Just a plain image showing no rotation. Lay the box flat and center the top face in the camera frame.", hi: "कोई घुमाव नहीं — बॉक्स को सपाट रखें और ऊपरी फेस को कैमरे में सेंटर करें।" },
      sampleImg: "/samples/1.png",
    },
    {
      id: 2,
      title: { en: "Bottom Side", hi: "निचली साइड" },
      desc: { en: "Look at the sample image. Rotate the box by following the arrow: move the side at the tail of the arrow to the position at the head.", hi: "सैंपल इमेज देखें। तीर के निर्देशानुसार बॉक्स घुमाएं: तीर की पूंछ वाली साइड को तीर के सिर की स्थिति में लाएं।" },
      sampleImg: "/samples/234.png",
    },
    {
      id: 3,
      title: { en: "Front Side", hi: "अगली साइड" },
      desc: { en: "Look at the sample image. Rotate the box by following the arrow: move the side at the tail of the arrow to the position at the head.", hi: "सैंपल इमेज देखें। तीर के निर्देशानुसार बॉक्स घुमाएं: तीर की पूंछ वाली साइड को तीर के सिर की स्थिति में लाएं।" },
      sampleImg: "/samples/234.png",
    },
    {
      id: 4,
      title: { en: "Back Side", hi: "पिछली साइड" },
      desc: { en: "Look at the sample image. Rotate the box by following the arrow: move the side at the tail of the arrow to the position at the head.", hi: "सैंपल इमेज देखें। तीर के निर्देशानुसार बॉक्स घुमाएं: तीर की पूंछ वाली साइड को तीर के सिर की स्थिति में लाएं।" },
      sampleImg: "/samples/234.png",
    },
    {
      id: 5,
      title: { en: "Left Side", hi: "बाईं साइड" },
      desc: { en: "Look at the sample image. Rotate the box by following the arrow: move the side at the tail of the arrow to the position at the head.", hi: "सैंपल इमेज देखें। तीर के निर्देशानुसार बॉक्स घुमाएं: तीर की पूंछ वाली साइड को तीर के सिर की स्थिति में लाएं।" },
      sampleImg: "/samples/566.png",
    },
    {
      id: 6,
      title: { en: "Right Side", hi: "दाईं साइड" },
      desc: { en: "Look at the sample image. Rotate the box by following the arrow: move the side at the tail of the arrow to the position at the head.", hi: "सैंपल इमेज देखें। तीर के निर्देशानुसार बॉक्स घुमाएं: तीर की पूंछ वाली साइड को तीर के सिर की स्थिति में लाएं।" },
      sampleImg: "/samples/566.png",
    },
    {
      id: 7,
      title: { en: "Delivery Label", hi: "डिलीवरी लेबल" },
      desc: { en: "Hold the DELIVERY LABEL clearly to the camera. All text must be readable. Ensure AWB matches scanned number.", hi: "डिलीवरी लेबल को कैमरे के सामने स्पष्ट रूप से पकड़ें। सारा टेक्स्ट पढ़ने योग्य होना चाहिए। AWB स्कैन किए नंबर से मेल खाना चाहिए।" },
      sampleImg: null,
    },
    {
      id: 8,
      title: { en: "Open Box & Contents", hi: "बॉक्स खोलें और सामग्री" },
      desc: { en: "Open the box completely and capture a clear image of the contents inside the box. Ensure all items are visible.", hi: "बॉक्स पूरी तरह खोलें और अंदर की सामग्री की स्पष्ट तस्वीर लें। सभी आइटम दिखाई देने चाहिए।" },
      sampleImg: null,
    },
  ] as const;

  const ITEM_STEPS = [
    {
      id: 1,
      title: { en: "Scan Item LPN", hi: "आइटम LPN स्कैन करें" },
      instruction: { en: "Type or scan the LPN barcode number printed on the item sticker. Verify it matches the order before proceeding.", hi: "आइटम स्टिकर पर छपा LPN बारकोड नंबर टाइप या स्कैन करें। आगे बढ़ने से पहले सुनिश्चित करें कि यह ऑर्डर से मेल खाता है।" },
    },
    {
      id: 2,
      title: { en: "Product Verification", hi: "उत्पाद सत्यापन" },
      instruction: { en: "Verify that the scanned LPN matches the expected product details shown below before continuing with inspection.", hi: "निरीक्षण जारी रखने से पहले सत्यापित करें कि स्कैन किया LPN नीचे दिखाए गए अपेक्षित उत्पाद विवरण से मेल खाता है।" },
    },
    {
      id: 3,
      title: { en: "Capture LPN Photo", hi: "LPN फोटो लें" },
      instruction: { en: "Point the camera at the LPN label on the item. Keep the LPN label in the RIGHT HALF of the frame. Hold steady and capture.", hi: "कैमरे को आइटम पर LPN लेबल की तरफ करें। LPN लेबल को फ्रेम के दाएं हिस्से में रखें। स्थिर रहें और तस्वीर लें।" },
      sampleImg: "/samples/inspector_lpn_scan.png",
    },
    {
      id: 4,
      title: { en: "Testing Instructions", hi: "परीक्षण निर्देश" },
      instruction: { en: "Perform the physical product check below before capturing the image. Ensure no step is skipped.", hi: "तस्वीर लेने से पहले नीचे दी गई भौतिक उत्पाद जांच करें। कोई भी चरण न छोड़ें।" },
    },
    {
      id: 5,
      title: { en: "Capture Product Image", hi: "उत्पाद की तस्वीर लें" },
      instruction: { en: "Place the product in the RIGHT HALF of the camera frame. Capture all visible sides — scratches, dents, missing parts must be visible.", hi: "उत्पाद को कैमरे फ्रेम के दाएं हिस्से में रखें। सभी दिखाई देने वाली साइड कैप्चर करें — खरोंच, डेंट, गायब हिस्से दिखने चाहिए।" },
      sampleImg: "/samples/inspector_product_photo.png",
    },
    {
      id: 6,
      title: { en: "Categorize Condition", hi: "स्थिति वर्गीकृत करें" },
      instruction: { en: "Based on your physical test and visual inspection, select the correct condition grade. This determines the bin the item goes into.", hi: "भौतिक परीक्षण और दृश्य निरीक्षण के आधार पर सही स्थिति ग्रेड चुनें। इससे तय होता है कि आइटम किस बिन में जाएगा।" },
    },
    {
      id: 7,
      title: { en: "Physical Binning", hi: "भौतिक बिनिंग" },
      instruction: { en: "Place the item into the labelled bin shown below. Confirm once placed — this cannot be undone without a supervisor override.", hi: "आइटम को नीचे दिखाए गए लेबल वाले बिन में रखें। रखने के बाद पुष्टि करें — सुपरवाइज़र ओवरराइड के बिना इसे पूर्ववत नहीं किया जा सकता।" },
    },
  ] as const;

  return (
    <div className="absolute inset-0 z-40 flex flex-row bg-slate-900 select-none overflow-hidden text-slate-800">

      {/* ═══════════════════════════════════════════════════════════════════
           LEFT PANEL — Cameras
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-1/2 bg-black flex flex-col border-r border-slate-800 shadow-2xl relative">
        {cameraPermissionState === "denied" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-8 text-center space-y-6 animate-in fade-in duration-200">
            <div className="bg-red-500/10 p-4 rounded-full text-red-500 border border-red-500/20 shadow-inner">
              <AlertOctagon size={48} />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-black uppercase tracking-wider text-white">{lang === 'hi' ? 'कैमरा अनुमति अवरुद्ध है' : 'Camera Permission Blocked'}</h3>
              <p className="text-white/60 font-bold text-xs uppercase tracking-wide leading-relaxed">
                {lang === 'hi' ? 'यह वेबसाइट वीडियो रिकॉर्ड करने और बॉक्स की सामग्री की तस्वीरें लेने के लिए आपके कैमरे की अनुमति आवश्यक है।' : 'This website requires access to your camera to record video and take pictures of the box contents and products.'}
              </p>
              <p className="text-amber-500 text-[10px] font-black uppercase tracking-wider">
                {lang === 'hi' ? 'कृपया ब्राउज़र के एड्रेस बार में कैमरा/अनुमति आइकन पर क्लिक करें, "Allow" चुनें, फिर पुनः प्रयास करें।' : 'Please click the camera/permission icon in your browser\'s address bar, select "Allow", then click retry.'}
              </p>
            </div>
            <button
              onClick={requestCameraPermission}
              className="px-6 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white font-extrabold uppercase tracking-widest text-xs rounded-lg transition-all shadow-md flex items-center space-x-2 border border-[#FF6700]/20"
            >
              <RefreshCw size={12} />
              <span>{lang === 'hi' ? 'पुनः प्रयास करें' : 'Retry Permission'}</span>
            </button>
          </div>
        )}
        <div className="h-1/2 flex shrink-0 border-b border-white/10 relative">
          <div className="relative w-full overflow-hidden bg-black">
            <video
              ref={recVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            <canvas ref={recCanvasRef} className="hidden" />

            <div className={`absolute top-2 left-2 backdrop-blur text-white px-2 py-1 text-[9px] font-black uppercase tracking-widest flex items-center space-x-1.5 rounded shadow-lg z-10 transition-colors duration-300 ${isRecording ? "bg-red-600/90" : "bg-slate-700/95"}`}>
              <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-white animate-pulse" : "bg-slate-400"}`} />
              <span>{isRecording ? (lang === 'hi' ? 'रिकॉर्ड' : 'REC') : (lang === 'hi' ? 'प्रतीक्षा' : 'STANDBY')}</span>
            </div>

            <div className="absolute top-2 right-2 bg-black/70 border border-white/20 text-white px-2 py-1 text-[10px] font-mono tracking-widest rounded flex items-center space-x-1.5 z-10">
              {isRecording && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
              <span>{String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}</span>
            </div>

            {availableCameras.length > 0 && (
              <button
                onClick={() => setShowConfigPanel((v) => !v)}
                className="absolute bottom-2 left-2 z-10 text-[8px] font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors border border-white/10 hover:border-white/20 bg-black/50 px-2 py-1 rounded"
              >
                {showConfigPanel ? (lang === 'hi' ? 'कॉन्फ़िग छुपाएं' : 'Hide Config') : (lang === 'hi' ? 'कैमरे कॉन्फ़िगर करें' : 'Configure Cameras')}
              </button>
            )}
            <div className="absolute bottom-2 right-2 z-10 flex items-center space-x-1 bg-black/50 text-white/60 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
              <VideoIcon size={9} />
              <span>{lang === 'hi' ? 'रिकॉर्डिंग कैम' : 'REC CAM'}</span>
            </div>
          </div>

          <div className="hidden shrink-0 bg-slate-950 border-l border-white/10 flex-col overflow-hidden" style={{ width: "50%" }}>
            <div className="px-3 pt-2 pb-1 border-b border-white/5 flex items-center shrink-0">
              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{lang === 'hi' ? 'उत्पाद संदर्भ' : 'Product Reference'}</span>
            </div>
            {phase === "ITEM_INSPECTION" ? (
              <div className="flex-1 overflow-y-auto p-2">
                {isValidatingLpn ? (
                  <div className="flex animate-pulse gap-2 h-full items-center">
                    <div className="w-1/2 h-24 bg-indigo-900/40 rounded-lg" />
                    <div className="w-1/2 space-y-2">
                      <div className="h-2 bg-indigo-900/40 rounded w-1/2" />
                      <div className="h-2 bg-indigo-900/40 rounded w-3/4" />
                      <div className="h-2 bg-indigo-900/40 rounded w-full" />
                    </div>
                  </div>
                ) : !currentSku ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <ScanEye size={24} className="text-indigo-500 mb-1.5 animate-bounce" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{lang === 'hi' ? 'LPN स्कैन करें' : 'Scan LPN'}</p>
                    <p className="text-[8px] text-white/30 font-bold uppercase mt-0.5">{lang === 'hi' ? 'इनपुट की प्रतीक्षा' : 'Awaiting input'}</p>
                  </div>
                ) : (
                  <div className="flex gap-2 h-full">
                    <div className="w-[45%] rounded-lg border border-indigo-800/50 bg-slate-900 flex items-center justify-center p-1 shrink-0">
                      {currentImageUrl
                        ? <img src={currentImageUrl} alt="ref" className="max-w-full max-h-full object-contain" />
                        : <span className="text-white/20 text-[8px] uppercase font-bold">{lang === 'hi' ? 'कोई इमेज नहीं' : 'No Image'}</span>}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
                      <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{lang === 'hi' ? 'शॉपिफाई संदर्भ' : 'Shopify Reference'}</p>
                      <p className="text-[10px] font-black text-white leading-snug line-clamp-3">{currentProductName || "Product"}</p>
                      {currentSku && (
                        <p className="text-[8px] font-mono text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded w-fit truncate">SKU: {currentSku}</p>
                      )}
                      <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 px-1.5 py-0.5 rounded w-fit">{lang === 'hi' ? 'दृश्य जांच सक्रिय' : 'Visual Check Active'}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                <Camera size={20} className="text-white/20 mb-2" />
                <p className="text-[8px] font-black uppercase tracking-widest text-white/20">
                  {phase === "START" ? (lang === 'hi' ? 'ऑर्डर की प्रतीक्षा' : 'Awaiting Order') : (lang === 'hi' ? 'बॉक्स साक्ष्य चरण' : 'Box Evidence Phase')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── IMAGE CAPTURE CAMERA w/ PREVIEW OVERLAY ── */}
        <div className="flex-1 relative overflow-hidden bg-black">
          <video
            ref={capVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover bg-black transition-opacity ${previewDataUrl ? "opacity-0" : "opacity-100"}`}
          />
          <canvas ref={capCanvasRef} className="hidden" />
          <canvas ref={hiddenCanvasRef} className="hidden" />

          {/* Captured Image Preview Overlay */}
          {previewDataUrl && (
            <img
              src={previewDataUrl}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-contain bg-slate-950 z-20 animate-in fade-in duration-200"
            />
          )}

          {dualCameraMode && (
            <button
              onClick={swapCameras}
              disabled={isSwitchingCameras}
              className="absolute top-4 right-4 z-30 bg-gradient-to-r from-[#FF6700] to-[#ff8c3b] hover:from-[#ff8c3b] hover:to-[#FF6700] active:scale-95 text-white disabled:opacity-40 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-full shadow-lg flex items-center space-x-2 transition-all border border-[#FF6700]/30"
            >
              <SwitchCamera size={14} className={isSwitchingCameras ? "animate-spin" : ""} />
              <span>{isSwitchingCameras ? (lang === 'hi' ? 'बदल रहे हैं...' : 'Switching...') : (lang === 'hi' ? 'कैमरे बदलें' : 'Swap Cameras')}</span>
            </button>
          )}

          {shutterFlash && (
            <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150" />
          )}

          <div className="absolute bottom-3 left-3 z-30 flex items-center space-x-1.5 bg-black/60 backdrop-blur text-white/70 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-white/10">
            <Camera size={10} />
            <span>{dualCameraMode ? (lang === 'hi' ? 'इमेज कैम' : 'Image Cam') : (lang === 'hi' ? 'कैमरा' : 'Camera')}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           RIGHT PANEL — Workflow UI
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-1/2 bg-white flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
        <div className="bg-white border-b border-[#313079]/10 p-4 flex justify-between items-center shrink-0 shadow-sm relative z-10">
          <div className="flex items-center space-x-2">
            <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]">
              <Box size={16} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">
                {phase === "ITEM_INSPECTION" ? "LPN" : (lang === 'hi' ? 'ट्रैकिंग ID' : 'Tracking ID')}
              </p>
              <p className="text-sm font-black font-mono text-[#313079]">
                {phase === "ITEM_INSPECTION"
                  ? (itemStep > 1 && currentLpn ? currentLpn : "—")
                  : (manifestId ? displayTrackingId : "—")}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-right">
            <div>
              <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">
                {lang === 'hi' ? 'ऑर्डर ID' : 'Order ID'}
              </p>
              <p className="text-sm font-black font-mono text-[#FF6700]">
                {manifestId ? displayOrderId : "—"}
              </p>
            </div>
            <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]">
              <FileText size={16} />
            </div>
          </div>
        </div>

        {phase === "START" && (
          showConfigPanel ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 bg-white text-[#313079]">
              <div className="bg-[#FF6700]/10 p-4 rounded-full mb-6 border border-[#FF6700]/25">
                <Camera size={48} className="text-[#FF6700]" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest text-[#313079] mb-1 text-center">
                {lang === 'hi' ? 'कैमरा सेटअप' : 'Camera Configuration'}
              </h2>
              <p className="text-[#313079]/60 font-bold tracking-wider mb-8 uppercase text-xs">
                {lang === 'hi' ? 'रिकॉर्डिंग और कैप्चर फ़ीड सेट करें' : 'Configure Recording & Capture Feeds'}
              </p>

              <div className="w-full max-w-sm space-y-4">
                <div className="flex flex-col space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#313079]/50">{lang === 'hi' ? 'रिकॉर्डिंग कैमरा' : 'Recording Camera'}</label>
                  <select 
                    value={recCameraId} 
                    onChange={(e) => handleRecCameraChange(e.target.value)} 
                    className="w-full bg-white border border-[#313079]/25 text-[#313079] text-xs font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF6700]"
                  >
                    <option value="">{lang === 'hi' ? '-- रिकॉर्डिंग कैमरा चुनें --' : '-- Select Recording Camera --'}</option>
                    {availableCameras.map((c) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label || `Camera ${availableCameras.indexOf(c) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#313079]/50">{lang === 'hi' ? 'कैप्चर कैमरा' : 'Capture Camera'}</label>
                  <select 
                    value={imgCameraId} 
                    onChange={(e) => handleImgCameraChange(e.target.value)} 
                    className="w-full bg-white border border-[#313079]/25 text-[#313079] text-xs font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#FF6700]"
                  >
                    <option value="">{lang === 'hi' ? '-- कैप्चर कैमरा चुनें --' : '-- Select Capture Camera --'}</option>
                    {availableCameras.map((c) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label || `Camera ${availableCameras.indexOf(c) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Check Hardware Status Bar */}
                {!isCameraReady && (
                  <div className="w-full bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-wider text-center p-3 rounded-lg border border-red-200">
                    {hardwareStatus || (lang === 'hi' ? 'हार्डवेयर जांचें: सेटअप अधूरा है' : 'Check Hardware: Setup incomplete')}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!isCameraReady}
                  onClick={() => setShowConfigPanel(false)}
                  className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white disabled:bg-[#313079]/5 disabled:text-[#313079]/30 transition-all text-sm font-black uppercase tracking-[0.15em] shadow-md flex justify-center items-center space-x-2 rounded-lg"
                >
                  <span>{lang === 'hi' ? 'निरीक्षण शुरू करें' : 'Proceed to Inspection'}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 bg-[#FF6700]/5">
              <div className="bg-[#FF6700]/10 p-4 rounded-full mb-6">
                <ScanEye size={48} className="text-[#FF6700]" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest text-[#313079] mb-1 text-center">
                {lang === 'hi' ? 'ऑर्डर ID स्कैन करें' : 'Scan Order ID'}
              </h2>
              <p className="text-[#313079]/60 font-bold tracking-wider mb-8 uppercase text-xs">
                {lang === 'hi' ? 'निरंतर साक्ष्य शुरू करने के लिए' : 'To Begin Continuous Evidence'}
              </p>
              <form onSubmit={handleStart} className="w-full flex flex-col space-y-4 max-w-sm">
                <input
                  type="text"
                  placeholder={lang === 'hi' ? 'ऑर्डर ID डालें...' : "ENTER ORDER ID..."}
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  autoFocus
                  className="w-full min-h-12 bg-white border-2 border-[#313079]/20 text-[#313079] px-4 py-3 text-center text-lg font-mono focus:outline-none focus:border-[#FF6700] uppercase placeholder-[#313079]/30 rounded-lg shadow-inner transition-colors"
                />
                
                {/* Hide Initialize button and show Check Hardware status bar if cameras fail */}
                {!isCameraReady ? (
                  <div className="w-full bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-wider text-center p-3 rounded-lg border border-red-200">
                    {hardwareStatus || (lang === 'hi' ? 'हार्डवेयर जांचें: सेटअप अधूरा है' : 'Check Hardware: Setup incomplete')}
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!orderId.trim() || !isCameraReady}
                    className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white disabled:bg-[#313079]/10 disabled:text-[#313079]/40 transition-all text-sm font-black uppercase tracking-[0.15em] shadow-md flex justify-center items-center space-x-2 rounded-lg"
                  >
                    <span>{lang === 'hi' ? 'शुरू करें' : 'Initialize'}</span>
                    <ArrowRight size={18} />
                  </button>
                )}

                {startError && (
                  <div className="w-full text-red-600 text-xs font-black uppercase tracking-wider text-center bg-red-50 border-2 border-red-200 p-3 rounded-lg shadow-sm animate-in fade-in duration-200 mt-2">
                    {startError}
                  </div>
                )}
              </form>
            </div>
          )
        )}

        {(phase === "BOX_EVIDENCE" || phase === "ITEM_INSPECTION") && (() => {
          if (showMissingConfirm) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-red-50/50 animate-in fade-in duration-300 text-center">
                <div className="bg-red-100 p-4 rounded-full mb-6 text-red-600 border border-red-200 shadow-inner">
                  <AlertTriangle size={48} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-widest text-[#313079] mb-2">
                  {lang === 'hi' ? 'गायब आइटम की पुष्टि करें' : 'Confirm Missing Items'}
                </h2>
                <p className="text-[#313079]/70 font-bold uppercase tracking-wider text-xs max-w-sm mb-8 leading-relaxed">
                  {lang === 'hi' ? 'आप निरीक्षण जल्दी समाप्त कर रहे हैं। आप स्वीकार करते हैं कि बॉक्स में अब कोई आइटम/उत्पाद नहीं बचा है।' : 'You are ending the inspection early. You acknowledge that no more items/products are left in the box.'}
                </p>
                <div className="bg-white border border-[#313079]/10 rounded-xl p-4 w-full max-w-sm text-left mb-8 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#313079]/50">{lang === 'hi' ? 'निरीक्षण आँकड़े' : 'Inspection Stats'}</p>
                  <div className="flex justify-between text-xs font-bold text-[#313079]">
                    <span>{lang === 'hi' ? 'स्कैन किए गए आइटम:' : 'Scanned Items:'}</span>
                    <span>{itemsProcessed} / {expectedItems}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#313079]">
                    <span>{lang === 'hi' ? 'गायब आइटम:' : 'Missing Items:'}</span>
                    <span className="text-red-600 font-black">{expectedItems - itemsProcessed}</span>
                  </div>
                </div>
                <div className="flex space-x-4 w-full max-w-sm">
                  <button
                    onClick={() => setShowMissingConfirm(false)}
                    className="flex-1 min-h-12 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-500 font-extrabold uppercase tracking-widest text-xs rounded-lg transition-all active:scale-95 shadow-sm"
                  >
                    {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMissingConfirm(false);
                      handleMissing();
                    }}
                    className="flex-1 min-h-12 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black uppercase tracking-widest text-xs rounded-lg transition-all shadow-md flex justify-center items-center space-x-2 border border-red-700"
                  >
                    <span>{lang === 'hi' ? 'स्वीकार करें और समाप्त करें' : 'Acknowledge & End'}</span>
                  </button>
                </div>
              </div>
            );
          }

          const activeStepsList = phase === "BOX_EVIDENCE" ? BOX_STEPS : ITEM_STEPS;
          const activeStepIndex = phase === "BOX_EVIDENCE" ? boxStep : itemStep;
          const activeStepObj = phase === "BOX_EVIDENCE" ? BOX_STEPS[boxStep - 1] : ITEM_STEPS[itemStep - 1];
          const activeBoxStepObj = phase === "BOX_EVIDENCE" ? BOX_STEPS[boxStep - 1] : null;

          if (!activeStepObj) return null;

          const instructionText = phase === "BOX_EVIDENCE"
            ? (activeBoxStepObj?.desc as any)?.[lang] || ""
            : "instruction" in activeStepObj
              ? (activeStepObj as any).instruction[lang] || ""
              : "";

          const hideBottomRef = phase === "ITEM_INSPECTION" && [1, 2, 4, 6, 7].includes(activeStepObj.id);

          return (
            <div className="flex-1 flex flex-col overflow-hidden bg-white relative animate-in fade-in duration-300">

              {/* ── PHASE HEADER & NODE PROGRESS BAR ────────────────────── */}
              <div className="px-6 pt-1 pb-4 bg-slate-50 border-b border-[#313079]/10 shrink-0 shadow-sm z-10">
                <h3 className="text-xs uppercase font-black tracking-widest text-[#313079]">
                  {phase === "BOX_EVIDENCE" ? (lang === 'hi' ? 'चरण 1: बॉक्स साक्ष्य' : 'Phase 1: Box Evidence') : (lang === 'hi' ? 'चरण 2: उत्पाद सत्यापन' : 'Phase 2: Product Verification')}
                </h3>

                <div className="mt-4 relative w-full h-2 flex items-center justify-between px-2">
                  {/* Background progress line */}
                  <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[3px] bg-slate-200 z-0 rounded-full" />

                  {/* Active progress line */}
                  <div
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-[3px] bg-gradient-to-r from-[#FF6700] to-orange-500 z-0 transition-all duration-500 rounded-full shadow-[0_1px_2px_rgba(255,103,0,0.2)]"
                    style={{ width: `calc(${((activeStepIndex - 1) / (activeStepsList.length - 1)) * 100}% - 16px)` }}
                  />

                  {/* Progress Nodes */}
                  {activeStepsList.map((s, index) => {
                    const stepNum = index + 1;
                    const isCurrent = activeStepIndex === stepNum;
                    const isPast = activeStepIndex > stepNum;

                    return (
                      <div
                        key={s.id}
                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-300 ${isCurrent
                          ? "bg-[#FF6700] text-white ring-4 ring-orange-500/20 shadow-md"
                          : isPast
                            ? "bg-[#FF6700] text-white"
                            : "bg-white border-2 border-slate-200 text-slate-400"
                          }`}
                      >
                        {isPast ? <Check size={12} strokeWidth={4} /> : s.id}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SPLIT INSTRUCTIONS SECTION ─────────────────────── */}
              <div className="flex-1 w-full flex flex-col min-h-0 shrink-0 bg-white">

                {/* 1st Part: Instructions (Top) */}
                <div className={`${hideBottomRef ? "h-full" : "h-[40%]"} w-full p-6 overflow-y-auto custom-scrollbar flex flex-col justify-between`}>
                  <div className="space-y-6">
                    {/* Items Processed Counter */}
                    {phase === "ITEM_INSPECTION" && (
                      <div className="flex justify-between items-center text-xs font-bold text-[#313079]/60 uppercase tracking-wider">
                        <span>{lang === 'hi' ? 'संसाधित आइटम:' : 'Items Processed:'}</span>
                        <span className="font-mono text-[#313079] font-black">{itemsProcessed} / {expectedItems}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Big Instruction Text */}
                      <p className="text-3xl font-black text-[#313079] leading-tight uppercase tracking-wide">
                        {instructionText}
                      </p>

                      {phase === "ITEM_INSPECTION" && activeStepObj.id === 1 && (
                        <div className="space-y-4 pt-2">
                          <input
                            type="text"
                            placeholder={lang === 'hi' ? 'LPN स्कैन करें या टाइप करें...' : 'SCAN OR TYPE LPN...'}
                            value={currentLpn}
                            onChange={(e) => {
                              setCurrentLpn(e.target.value);
                              setLpnScanError("");
                            }}
                            autoFocus
                            className={`w-full min-h-12 bg-white border text-[#313079] px-4 py-2 text-center text-sm font-mono focus:outline-none focus:border-[#FF6700] uppercase rounded-lg ${lpnScanError ? "border-red-400" : "border-[#313079]/20"}`}
                          />
                          {lpnScanError && (
                            <p className="text-xs font-bold text-red-600 text-center uppercase tracking-wider">{lpnScanError}</p>
                          )}
                          {activeOrderPlatformId && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#313079]/50 text-center">
                              {lang === 'hi' ? 'ऑर्डर:' : 'Order:'} {activeOrderPlatformId}
                            </p>
                          )}
                        </div>
                      )}

                      {phase === "ITEM_INSPECTION" && activeStepObj.id === 2 && (
                        <div className="pt-2">
                          <div className="rounded-2xl border border-[#313079]/10 bg-slate-50 p-4 shadow-sm">
                            <div className="flex items-stretch gap-4 min-h-[280px]">
                              <div className="w-1/2 shrink-0 rounded-xl border border-[#313079]/10 bg-white flex items-center justify-center overflow-hidden p-2">
                                {currentImageUrl ? (
                                  <img src={currentImageUrl} alt="Expected product" className="w-full h-full object-contain" />
                                ) : (
                                  <Box size={28} className="text-[#313079]/25" />
                                )}
                              </div>
                              <div className="w-1/2 min-w-0 flex flex-col justify-between py-1">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6700]">{lang === 'hi' ? 'उत्पाद विवरण' : 'Product Details'}</p>
                                  <p className="text-base font-black text-[#313079] leading-snug line-clamp-4">{currentProductName || (lang === 'hi' ? 'उत्पाद नाम अनुपलब्ध' : 'Product name unavailable')}</p>
                                </div>
                                <div className="space-y-2 mt-4">
                                  <div className="flex flex-col gap-1.5">
                                    <span className="px-2 py-1 rounded border border-[#313079]/10 bg-white text-[10px] font-mono font-black text-[#313079] w-fit truncate">LPN: {currentLpn || "—"}</span>
                                    <span className="px-2 py-1 rounded border border-[#313079]/10 bg-white text-[10px] font-mono font-black text-[#313079] w-fit truncate">SKU: {currentSku || "—"}</span>
                                  </div>
                                  <p className="text-xs font-bold text-[#313079]/70 uppercase tracking-wide leading-tight">
                                     {lang === 'hi' ? 'जारी रखने से पहले सुनिश्चित करें कि स्कैन किया उत्पाद अपेक्षित आइटम से मेल खाता है।' : 'Confirm the scanned product matches this expected item before continuing.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {phase === "ITEM_INSPECTION" && activeStepObj.id === 4 && (
                        <ul className="text-[#313079]/80 font-bold space-y-4 text-2xl list-none pt-2 text-left uppercase tracking-wide">
                          <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-1">1.</span><span>{lang === 'hi' ? 'खरोंच या दरारों के लिए सभी कोनों और सतहों का निरीक्षण करें।' : 'Inspect all corners and surfaces for scratches or cracks.'}</span></li>
                          <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-1">2.</span><span>{lang === 'hi' ? 'सभी यांत्रिक भागों और बटनों के सही चलने/क्लिक करने की जांच करें।' : 'Verify all mechanical parts and buttons move/click correctly.'}</span></li>
                          <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-1">3.</span><span>{lang === 'hi' ? 'स्लिप पर सूचीबद्ध सभी सहायक उपकरण मौजूद हैं, इसकी पुष्टि करें।' : 'Confirm all accessories listed on the slip are present.'}</span></li>
                        </ul>
                      )}

                      {phase === "ITEM_INSPECTION" && activeStepObj.id === 6 && (
                        <div className="space-y-4 pt-2">
                          {!showDefectDropdown && !showRecoveryDropdown && (
                            <div className="flex flex-col space-y-3">
                              <button onClick={() => handleCategory("GOOD")} className="w-full min-h-12 bg-green-600 hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                <CheckCircle2 size={18} /> <span>{lang === 'hi' ? 'अच्छा — पुनः बिक्री योग्य' : 'Good - Resellable'}</span>
                              </button>
                              <button onClick={() => handleCategory("RECOVERY")} className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                <AlertTriangle size={18} /> <span>{lang === 'hi' ? 'रिकवरी — मामूली क्षति' : 'Recovery - Minor Damage'}</span>
                              </button>
                              <button onClick={() => handleCategory("BAD")} className="w-full min-h-12 bg-red-600 hover:bg-red-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                <AlertOctagon size={18} /> <span>{lang === 'hi' ? 'खराब — मरम्मत अयोग्य' : 'Bad - Unsalvageable'}</span>
                              </button>
                            </div>
                          )}

                          {showRecoveryDropdown && (
                            <div className="flex flex-col space-y-3 animate-in fade-in duration-200">
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-[#FF6700] mb-1">{lang === 'hi' ? 'रिकवरी प्रकार चुनें' : 'Select Recovery Type'}</p>
                                <p className="text-[10px] text-orange-700 leading-relaxed font-bold">{lang === 'hi' ? 'LPN के लिए आवश्यक रिकवरी/नवीनीकरण प्रक्रिया चुनें:' : 'Select the required recovery/refurbishment process for LPN:'} {currentLpn}</p>
                              </div>
                              <div className="space-y-1.5">
                                <button onClick={() => handleRecoverySelected("Barcode Damaged")} className="w-full min-h-11 bg-white border-2 border-orange-200 hover:border-[#FF6700] hover:bg-orange-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]">
                                  <span className="flex-1 pr-2">{lang === 'hi' ? 'बारकोड क्षतिग्रस्त' : 'Barcode Damaged'}</span>
                                  <ArrowRight size={14} className="text-orange-400 shrink-0" />
                                </button>
                                <button onClick={() => handleRecoverySelected("Packaging Damaged")} className="w-full min-h-11 bg-white border-2 border-orange-200 hover:border-[#FF6700] hover:bg-orange-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]">
                                  <span className="flex-1 pr-2">{lang === 'hi' ? 'पैकेजिंग क्षतिग्रस्त' : 'Packaging Damaged'}</span>
                                  <ArrowRight size={14} className="text-orange-400 shrink-0" />
                                </button>
                              </div>
                              <button onClick={() => { setShowRecoveryDropdown(false); setCurrentCategory(null); }} className="w-full min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/70 text-xs font-bold uppercase tracking-widest rounded transition-colors">
                                {lang === 'hi' ? 'ग्रेड चयन पर वापस जाएं' : 'Back to Grade Selection'}
                              </button>
                            </div>
                          )}

                          {showDefectDropdown && (
                            <div className="flex flex-col space-y-3">
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-red-700 mb-1">{selectedClaimReason ? (lang === 'hi' ? '2) क्लेम उप-कारण चुनें' : '2) Select Claim Sub-Reason') : (lang === 'hi' ? '1) क्लेम कारण चुनें' : '1) Select Claim Reason')}</p>
                                <p className="text-[10px] text-red-600 leading-relaxed font-bold">{selectedClaimReason ? `${lang === 'hi' ? 'चुना गया कारण:' : 'Selected Reason:'} ${translateClaimLabel(selectedClaimReason)}` : (lang === 'hi' ? 'Amazon के IDR पोर्टल से मेल खाती प्राथमिक क्लेम श्रेणी चुनें' : "Select the primary claim category matching Amazon's IDR portal")}</p>
                              </div>
                              <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                {!selectedClaimReason
                                  ? CLAIM_REASONS.map((cr) => (
                                    <button key={cr.id} onClick={() => setSelectedClaimReason(cr.label)} className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]">
                                      <span className="flex-1 pr-2">{translateClaimLabel(cr.label)}</span>
                                      <ArrowRight size={14} className="text-red-400 shrink-0" />
                                    </button>
                                  ))
                                  : CLAIM_REASONS.find((r) => r.label === selectedClaimReason)?.subReasons.map((csr) => (
                                    <button key={csr.value} onClick={() => handleDefectSelected(selectedClaimReason, csr.label)} className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]">
                                      <span className="flex-1 pr-2">{translateClaimLabel(csr.label)}</span>
                                      <ArrowRight size={14} className="text-red-400 shrink-0" />
                                    </button>
                                  ))}
                              </div>
                              <div className="flex space-x-2">
                                {selectedClaimReason ? (
                                  <button onClick={() => setSelectedClaimReason(null)} className="flex-1 min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/85 text-xs font-bold uppercase tracking-widest rounded transition-colors">{lang === 'hi' ? 'कारणों पर वापस जाएं' : 'Back to Reasons'}</button>
                                ) : (
                                  <button onClick={() => { setShowDefectDropdown(false); setCurrentCategory(null); }} className="flex-1 min-h-10 bg-[#313079]/5 hover:bg-[#313079]/10 text-[#313079]/70 text-xs font-bold uppercase tracking-widest rounded transition-colors">{lang === 'hi' ? 'ग्रेड चयन पर वापस जाएं' : 'Back to Grade Selection'}</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {phase === "ITEM_INSPECTION" && activeStepObj.id === 7 && (
                        <div className="flex flex-col items-center justify-center space-y-4 py-2">
                          <div className="bg-[#FF6700]/5 p-6 rounded-xl border-2 border-[#313079]/15 text-center w-full">
                            <p className="text-sm font-bold text-[#313079]/60 uppercase tracking-widest mb-2">{lang === 'hi' ? 'आइटम यहाँ रखें:' : 'Place item in:'}</p>
                            <p className={`text-3xl font-black uppercase tracking-widest ${currentCategory === "GOOD" ? "text-green-600" : currentCategory === "RECOVERY" ? "text-[#FF6700]" : "text-red-600"}`}>
                              {currentCategory ? (lang === 'hi' ? (currentCategory === 'GOOD' ? 'अच्छा बिन' : currentCategory === 'RECOVERY' ? 'रिकवरी बिन' : 'खराब बिन') : `${currentCategory} BIN`) : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2nd Part: Image / Future Animation (Bottom) */}
                {!hideBottomRef && (
                  <div className="h-[60%] w-full flex items-center justify-center p-4 bg-slate-50 border-t border-[#313079]/10 shrink-0 relative">
                    {phase === "BOX_EVIDENCE" && activeBoxStepObj ? (
                      <StepVisualGuide
                        step={activeBoxStepObj}
                        className="w-full h-full max-w-sm mx-auto bg-slate-900 rounded-lg flex flex-col items-center justify-center relative overflow-hidden shadow-inner"
                      />
                    ) : (
                      "sampleImg" in activeStepObj && activeStepObj.sampleImg ? (
                        <div className="relative w-full h-full max-w-sm mx-auto rounded-lg overflow-hidden border border-[#313079]/10 bg-white flex items-center justify-center">
                          <img src={activeStepObj.sampleImg} alt="Reference sample" className="max-w-full max-h-full object-contain" />
                          <div className="absolute bottom-0 left-0 right-0 bg-[#FF6700]/80 text-white text-[9px] font-bold uppercase tracking-widest text-center py-1">
                            {lang === 'hi' ? 'संदर्भ नमूना' : 'Reference Sample'}
                          </div>
                        </div>
                      ) : currentImageUrl ? (
                        <div className="relative w-full h-full max-w-sm mx-auto rounded-lg overflow-hidden border border-[#313079]/10 bg-white flex items-center justify-center p-2">
                          <img src={currentImageUrl} alt="Product reference" className="max-w-full max-h-full object-contain" />
                          <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-white text-[9px] font-bold uppercase tracking-widest text-center py-1">
                            {lang === 'hi' ? 'उत्पाद संदर्भ इमेज' : 'Product Ref Image'}
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full max-w-sm mx-auto rounded-lg overflow-hidden border border-dashed border-[#313079]/20 bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
                          <Box size={24} className="text-[#313079]/30 mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#313079]/40">{lang === 'hi' ? 'कोई संदर्भ इमेज नहीं' : 'No Reference Image'}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* ── UNIFIED NAVIGATION & ACTION BAR (LOWER TAB) ─────────────────────── */}
              <div className="h-12 w-full shrink-0 border-t border-[#313079]/10 bg-white flex items-center px-4 gap-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-30">

                {/* LEFT BUTTON: Cancel / Back / Retake */}
                <div className="w-[30%] h-full py-1">
                  {(phase === "BOX_EVIDENCE" && activeStepIndex === 1 && !previewDataUrl) ? (
                    <button
                      onClick={resetProcess}
                      className="w-full h-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all border border-red-200 flex items-center justify-center space-x-2 active:scale-95"
                    >
                      <X size={16} /> <span>{lang === 'hi' ? 'निरीक्षण रद्द करें' : 'Cancel Inspection'}</span>
                    </button>
                  ) : previewDataUrl ? (
                    <button
                      onClick={handleRetakePreview}
                      className="w-full h-full bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-extrabold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
                    >
                      <RefreshCw size={16} /> <span>{lang === 'hi' ? 'दोबारा लें' : 'Retake'}</span>
                    </button>
                  ) : (phase === "ITEM_INSPECTION" && activeStepObj.id === 1) ? (
                    <button
                      onClick={() => setShowMissingConfirm(true)}
                      className="w-full h-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-extrabold uppercase tracking-widest text-[10px] flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <AlertTriangle size={14} /> <span>{lang === 'hi' ? 'कोई आइटम शेष नहीं' : 'No Item Left'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleBack}
                      className="w-full h-full bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-xl font-extrabold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
                    >
                      <ArrowLeft size={16} /> <span>{lang === 'hi' ? 'वापस' : 'Back'}</span>
                    </button>
                  )}
                </div>

                {/* RIGHT BUTTON: Contextual Next / Action */}
                <div className="w-[70%] h-full py-1">
                  {previewDataUrl ? (
                    <button
                      onClick={handleConfirmPreview}
                      className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <CheckCircle2 size={18} /> <span>{lang === 'hi' ? 'पुष्टि करें और आगे बढ़ें' : 'Confirm & Next'}</span>
                    </button>
                  ) : (
                    (() => {
                      if (phase === "BOX_EVIDENCE") {
                        if (activeStepObj.id === 6 && boxStep6Part === 1) {
                          return (
                            <button onClick={() => setBoxStep6Part(2)} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2">
                              <span>{lang === 'hi' ? 'अगला रोटेशन →' : 'Next Rotation ->'}</span>
                            </button>
                          );
                        }
                        return (
                          <button onClick={() => captureImage("box")} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2">
                            <Camera size={16} /> <span>{lang === 'hi' ? 'तस्वीर लें' : 'Capture Image'}</span>
                          </button>
                        );
                      } else {
                        // ITEM_INSPECTION phase handling
                        if (activeStepObj.id === 1) {
                          return (
                            <button onClick={nextItemStep} disabled={!currentLpn.trim() || isValidatingLpn} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest disabled:bg-[#313079]/10 disabled:text-[#313079]/40 rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 active:scale-95">
                              {isValidatingLpn ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span>{lang === 'hi' ? 'LPN पुष्टि हुई →' : 'LPN Confirmed ->'}</span>}
                            </button>
                          );
                        } else if (activeStepObj.id === 2) {
                          return (
                            <button onClick={nextItemStep} disabled={!currentLpn.trim() || !currentSku} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest disabled:bg-[#313079]/10 disabled:text-[#313079]/40 rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 active:scale-95">
                              <CheckCircle2 size={16} /> <span>{lang === 'hi' ? 'उत्पाद सत्यापित →' : 'Product Verified ->'}</span>
                            </button>
                          );
                        } else if (activeStepObj.id === 3) {
                          return (
                            <button onClick={() => captureImage("lpn", currentLpn)} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md flex justify-center items-center space-x-2 transition-all active:scale-95">
                              <Camera size={16} /> <span>{lang === 'hi' ? 'LPN फोटो लें' : 'Capture LPN Photo'}</span>
                            </button>
                          );
                        } else if (activeStepObj.id === 4) {
                          return (
                            <button onClick={nextItemStep} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95">
                              {lang === 'hi' ? 'परीक्षण पूर्ण →' : 'Testing Done ->'}
                            </button>
                          );
                        } else if (activeStepObj.id === 5) {
                          return (
                            <button onClick={() => captureImage("product", currentLpn)} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md flex justify-center items-center space-x-2 transition-all active:scale-95">
                              <Camera size={16} /> <span>{lang === 'hi' ? 'उत्पाद की तस्वीर लें' : 'Capture Product Image'}</span>
                            </button>
                          );
                        } else if (activeStepObj.id === 6) {
                          return (
                            <div className="w-full h-full bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center px-4">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#313079]/40 text-center leading-normal">
                                {showRecoveryDropdown ? (lang === 'hi' ? 'ग्रेड: रिकवरी चयनित' : 'Grade: Recovery Selected') : showDefectDropdown ? (lang === 'hi' ? 'ग्रेड: खराब (क्लेम सेटअप)' : 'Grade: Bad (Claim Setup)') : (lang === 'hi' ? 'ग्रेड चयन की प्रतीक्षा' : 'Awaiting Grade Selection')}
                              </span>
                            </div>
                          );
                        } else if (activeStepObj.id === 7) {
                          return (
                            <button onClick={handleBinning} className="w-full h-full bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-md flex justify-center items-center space-x-2 transition-all active:scale-95">
                              <span>{lang === 'hi' ? 'बिनिंग पुष्टि करें' : 'Confirm Binning'}</span> <ArrowRight size={18} />
                            </button>
                          );
                        }
                      }
                    })()
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {phase === "COMPLETED" && (
          <div className="flex-1 flex flex-col justify-center items-center p-8 bg-green-50 animate-in fade-in zoom-in-95 duration-300 text-center">
            <div className="bg-green-100 p-6 rounded-full mb-6 shadow-inner border-4 border-green-200">
              <CheckCircle2 size={64} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-green-700 uppercase tracking-widest mb-3">{lang === 'hi' ? 'ऑर्डर पूर्ण' : 'Order Complete'}</h2>
            <p className={`text-xs font-bold tracking-widest uppercase mb-10 bg-white px-4 py-2 rounded-full shadow-sm ${isUploading ? "text-amber-600 border border-amber-200" : "text-green-600 border border-green-200"}`}>
              {isUploading ? (lang === 'hi' ? 'Drive पर साक्ष्य अपलोड हो रहा है...' : 'Uploading evidence to Drive...') : (lang === 'hi' ? 'साक्ष्य सफलतापूर्वक अपलोड हुआ' : 'Evidence successfully uploaded')}
            </p>

            {missingAcknowledged && (
              <div className="bg-[#FFF700]/15 border border-[#FFF700]/50 text-[#313079] p-4 rounded-lg mb-8 flex items-center space-x-3 w-full justify-center text-left">
                <AlertTriangle size={20} className="shrink-0 text-[#FF6700]" />
                <span className="font-bold uppercase tracking-wider text-xs">{lang === 'hi' ? 'गायब आइटम क्लेम के लिए फ्लैग किए गए' : 'Missing items flagged for claims'}</span>
              </div>
            )}

            <button
              onClick={resetProcess}
              disabled={isUploading}
              className={`w-full max-w-xs min-h-14 text-sm font-black uppercase tracking-[0.15em] rounded-lg shadow-lg flex items-center justify-center space-x-3 transition-all ${isUploading ? "bg-gray-400 cursor-not-allowed text-gray-200" : "bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-transform active:scale-95"}`}
            >
              {isUploading ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>{lang === 'hi' ? 'साक्ष्य अपलोड हो रहा है...' : 'Uploading Evidence...'}</span></>
              ) : (
                <><span>{lang === 'hi' ? 'अगला ऑर्डर प्रोसेस करें' : 'Process Next Order'}</span><ArrowRight size={18} /></>
              )}
            </button>
          </div>
        )}

      </div>

      {phase !== "START" && cameraConnectionError && (cameraConnectionError === "REC_DISCONNECTED" || cameraConnectionError === "BOTH_DISCONNECTED") && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-red-500 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center flex flex-col items-center space-y-6 transform scale-100 transition-all duration-300">
            <div className="bg-red-50 p-4 rounded-full text-red-500 animate-bounce">
              <AlertOctagon size={48} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-wider text-slate-900">{lang === 'hi' ? 'कैमरा ऑफलाइन' : 'Camera Offline'}</h3>
              <p className="text-[#313079]/80 font-bold text-xs mt-3 leading-relaxed uppercase tracking-wider">
                {dualCameraMode
                  ? (cameraConnectionError === "BOTH_DISCONNECTED" ? (lang === 'hi' ? 'चेतावनी: दोनों कैमरे निष्क्रिय हैं। कृपया निरीक्षण पुनः शुरू करें।' : 'Warning: Both cameras are inactive. Please restart the inspection.') : (lang === 'hi' ? 'चेतावनी: रिकॉर्डिंग कैमरा निष्क्रिय है। कृपया निरीक्षण पुनः शुरू करें।' : 'Warning: Recording camera is inactive. Please restart the inspection.'))
                  : (lang === 'hi' ? 'चेतावनी: कैमरा निष्क्रिय है। कृपया निरीक्षण पुनः शुरू करें।' : 'Warning: Camera is inactive. Please restart the inspection.')}
              </p>
            </div>
            <button
              onClick={() => { resetProcess(); setCameraConnectionError(null); }}
              className="w-full min-h-12 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold uppercase tracking-widest text-xs rounded-lg transition-all shadow-md flex justify-center items-center space-x-2 border border-red-700"
            >
              <RefreshCw size={14} /><span>{lang === 'hi' ? 'निरीक्षण पुनः शुरू करें' : 'Restart Inspection'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Hindi Alert Translations ────────────────────────────────────────────────
const HINDI_ALERT_DESCRIPTIONS: Record<string, string> = {
  DELIVERY_ETA_BREACH_48H: "पैकेज {trackingId} अपनी अपेक्षित डिलीवरी तिथि (ऑर्डर तिथि + 5 दिन) से 48 घंटे अधिक विलंबित है। कूरियर के साथ तुरंत फॉलो-अप की आवश्यकता है।",
  DELIVERY_ETA_BREACH_72H: "पैकेज {trackingId} अपनी अपेक्षित डिलीवरी तिथि (ऑर्डर तिथि + 5 दिन) से 72 घंटे अधिक विलंबित है। मौजूदा थ्रेड में एस्केलेशन मेल भेज दिया गया है।",
  DELIVERY_ETA_BREACH_96H: "पैकेज {trackingId} अपनी अपेक्षित डिलीवरी तिथि से 96 घंटे अधिक विलंबित है। प्रबंधन को सूचित कर दिया गया है। त्वरित समाधान आवश्यक है।",
  GHOST_DELIVERY_T1_6H: "पैकेज {trackingId} को कूरियर द्वारा डिलीवर चिह्नित किया गया है लेकिन रिसीवर द्वारा स्कैन नहीं किया गया है। डिलीवरी मार्क के 6 घंटे के भीतर कोई क्लेम दायर नहीं किया गया है।",
  GHOST_DELIVERY_T1_12H: "पैकेज {trackingId} को कूरियर द्वारा डिलीवर चिह्नित किया गया है लेकिन रिसीवर द्वारा स्कैन नहीं किया गया है। 12 घंटे बीत जाने के बाद भी क्लेम दायर नहीं किया गया है।",
  GHOST_DELIVERY_T1_24H: "पैकेज {trackingId} को कूरियर द्वारा डिलीवर चिह्नित किया गया है लेकिन रिसीवर द्वारा स्कैन नहीं किया गया है। 24 घंटे बीत जाने के बाद भी क्लेम दायर नहीं किया गया है। नेतृत्व को एस्केलेट कर दिया गया है।",
  GHOST_DELIVERY_T2_6H: "पैकेज {trackingId} रिसीवर द्वारा QC में फेल हो गया था। कूरियर द्वारा इसे डिलीवर/अनडिलीवर चिह्नित किया गया है। 6 घंटे के भीतर कोई क्लेम दायर नहीं किया गया है।",
  GHOST_DELIVERY_T2_12H: "पैकेज {trackingId} रिसीवर द्वारा QC में फेल हो गया था। 12 घंटे के भीतर कोई क्लेम दायर नहीं किया गया है। मौजूदा थ्रेड में एस्केलेशन भेजा गया है।",
  GHOST_DELIVERY_T2_24H: "पैकेज {trackingId} रिसीवर द्वारा QC में फेल हो गया था। 24 घंटे के भीतर कोई क्लेम दायर नहीं किया गया है। नेतृत्व को एस्केलेट कर दिया गया है।",
  RECEIVE_UPDATE_PENDING_2H: "पैकेज {trackingId} का QC पास हो चुका है लेकिन 2 घंटे से अधिक समय से सिस्टम में डिलीवरी की पुष्टि नहीं की गई है।",
  RECEIVE_UPDATE_PENDING_6H: "पैकेज {trackingId} का QC पास हो चुका है लेकिन 6 घंटे से अधिक समय से डिलीवरी की पुष्टि नहीं की गई है। एडमिन को सूचित कर दिया गया है।",
  RECV_INSP_HANDSHAKE_10AM: "कल प्राप्त एक या अधिक पैकेजों को आज सुबह 10 बजे तक इंस्पेक्टर को नहीं सौंपा गया है।",
  RECV_INSP_HANDSHAKE_12PM: "कल प्राप्त पैकेजों को दोपहर 12 बजे तक इंस्पेक्टर को नहीं सौंपा गया है। एडमिन को सूचित कर दिया गया है।",
  RECV_INSP_HANDSHAKE_3PM: "कल प्राप्त पैकेजों को दोपहर 3 बजे तक भी इंस्पेक्टर को नहीं सौंपा गया है। एस्केलेशन शुरू किया गया है।",
  RECV_INSP_HANDSHAKE_NEXT_DAY: "पैकेज बिना निरीक्षण हैंडओवर के एक पूरा दिन अतिरिक्त बीत चुके हैं। नेतृत्व को एस्केलेट कर दिया गया है।",
  INSPECTION_PENDING_6H: "पैकेज {trackingId} को 6+ घंटे पहले इंस्पेक्टर को सौंपा गया था लेकिन निरीक्षण अभी तक पूरा नहीं हुआ है।",
  INSPECTION_PENDING_12H: "पैकेज {trackingId} 12+ घंटे से इंस्पेक्टर के पास लंबित है। एडमिन को सूचित कर दिया गया है।",
  INSPECTION_PENDING_18H: "पैकेज {trackingId} का निरीक्षण 18 घंटे बाद भी लंबित है। एस्केलेशन ईमेल भेज दिया गया है।",
  INSPECTION_PENDING_24H: "पैकेज {trackingId} का 24+ घंटे से निरीक्षण नहीं हुआ है। नेतृत्व को एस्केलेट कर दिया गया है।",
  INSPECTION_QC_FAILED_6H: "पैकेज {trackingId} निरीक्षण QC में फेल हो गया। निरीक्षण विफलता के 6 घंटे बाद भी कोई क्लेम दायर नहीं किया गया है।",
  INSPECTION_QC_FAILED_12H: "पैकेज {trackingId} निरीक्षण QC में फेल हो गया। विफलता के 12 घंटे बाद भी कोई क्लेम दायर नहीं किया गया है। मौजूदा थ्रेड में एस्केलेशन भेजा गया है।",
  INSPECTION_QC_FAILED_24H: "पैकेज {trackingId} 24+ घंटे पहले QC में फेल हुआ था और कोई क्लेम नहीं उठाया गया है। नेतृत्व को एस्केलेट कर दिया गया है।",
  INSP_RECOVERY_HANDSHAKE_12H: "निरीक्षण के बाद {trackingId} से प्राप्त SKU को रिकवरी के लिए चिह्नित किया गया था लेकिन 12 घंटे के भीतर रिकवरी टीम को नहीं सौंपा गया है।",
  INSP_RECOVERY_HANDSHAKE_18H: "निरीक्षण के बाद {trackingId} से प्राप्त SKU को रिकवरी के लिए चिह्नित किया गया था लेकिन 18 घंटे बाद भी नहीं सौंपा गया है। एडमिन को सूचित किया गया है।",
  RECOVERY_REJECTION_1_REALTIME: "रिकवरी टीम को सौंपा गया {trackingId} का एक SKU क्षतिग्रस्त चिह्नित किया गया है। एडमिन कार्रवाई आवश्यक है।",
  RECOVERY_REJECTION_1_6H: "रिकवरी में SKU {trackingId} को 6+ घंटे पहले क्षतिग्रस्त चिह्नित किया गया था। कोई एडमिन कार्रवाई नहीं की गई है। एस्केलेशन शुरू किया गया है।",
  RECOVERY_REJECTION_2_1H: "एडमिन ने {trackingId} के लिए रिकवरी क्षति को स्वीकार कर लिया है लेकिन 1 घंटे के भीतर क्लेम नहीं उठाया गया है।",
  RECOVERY_REJECTION_2_6H: "एडमिन ने 6+ घंटे पहले {trackingId} के लिए रिकवरी क्षति स्वीकार की थी लेकिन कोई क्लेम दायर नहीं हुआ है। एस्केलेशन शुरू किया गया है।",
  RECOVERY_REJECTION_2_12H: "स्वीकृत रिकवरी क्षति {trackingId} के लिए 12 घंटे बाद भी क्लेम दायर नहीं हुआ है। नेतृत्व को एस्केलेट कर दिया गया है।",
  RECOVERY_QC_HANDSHAKE_24H: "एक पुनःप्राप्ति योग्य SKU {trackingId} रिकवरी टीम के पास 24+ घंटे से है और इसे इन्वेंटराइजेशन के लिए QC को नहीं सौंपा गया है।",
  RECOVERY_QC_HANDSHAKE_36H: "पुनर्याप्त करने योग्य SKU {trackingId} को 36+ घंटे से QC को नहीं सौंपा गया है। एडमिन को सूचित कर दिया गया है।",
  INSP_QC_HANDSHAKE_24H: "निरीक्षण के बाद इन्वेंटराइजेशन के लिए चिह्नित SKU {trackingId} को 24 घंटे के भीतर QC टीम को नहीं सौंपा गया है।",
  INSP_QC_HANDSHAKE_36H: "QC को इन्वेंटराइजेशन हैंडओवर {trackingId} 36+ घंटे से विलंबित है। एडमिन को सूचित कर दिया गया है।",
  QC_REJECTION_1_REALTIME: "QC टीम को सौंपा गया {trackingId} का SKU क्षतिग्रस्त पाया गया है। तत्काल एडमिन कार्रवाई आवश्यक है।",
  INSP_QC_DAMAGE_REALTIME: "QC टीम को सौंपा गया {trackingId} का SKU क्षतिग्रस्त पाया गया है। तत्काल एडमिन कार्रवाई आवश्यक है।",
  QC_REJECTION_1_24H: "QC में SKU {trackingId} को 24+ घंटे पहले क्षतिग्रस्त चिह्नित किया गया था। कोई एडमिन कार्रवाई नहीं हुई। एस्केलेशन शुरू किया गया है।",
  QC_REJECTION_2_1H: "एडमिन ने {trackingId} के लिए QC क्षति स्वीकार की लेकिन 1 घंटे के भीतर क्लेम दायर नहीं किया।",
  QC_REJECTION_2_6H: "एडमिन ने 6+ घंटे पहले {trackingId} के लिए QC क्षति स्वीकार की थी। क्लेम अभी भी दायर नहीं हुआ। एस्केलेशन शुरू किया गया है।",
  QC_REJECTION_2_24H: "स्वीकृत QC क्षति {trackingId} के लिए 24 घंटे बाद भी क्लेम दायर नहीं हुआ है। नेतृत्व को एस्केलेट कर दिया गया है।",
  INVENTORISATION_PENDING_12H: "SKU {trackingId} को QC टीम के पास 12+ घंटे से रखा गया है और अभी तक इन्वेंटराइजेशन नहीं हुआ है।",
  INVENTORISATION_PENDING_18H: "SKU {trackingId} को QC में 18+ घंटे बीत चुके हैं और इन्वेंटराइजेशन लंबित है। एडमिन को सूचित कर दिया गया है।",
  INVENTORISATION_PENDING_24H: "SKU {trackingId} को QC में 24+ घंटे बीत चुके हैं और इन्वेंटराइजेशन लंबित है। एस्केलेशन शुरू किया गया है।",
  INVENTORISATION_PENDING_48H: "SKU {trackingId} को QC में 48+ घंटे बीत चुके हैं और इन्वेंटराइजेशन लंबित है। नेतृत्व को एस्केलेट कर दिया गया है।",
  ORDER_NOT_SHIPPED_5D: "रिमूवल ऑर्डर {orderId} के लिए अनुरोध भेजा गया था लेकिन Amazon ने 5 दिनों के बाद भी इस शिपमेंट को डिस्पैच नहीं किया है। रिम्बर्समेंट विंडो ~9 दिनों में बंद हो जाएगी।",
  ORDER_NOT_SHIPPED_10D: "रिमूवल ऑर्डर {orderId} के लिए अनुरोध भेजा गया था लेकिन 10 दिनों के बाद भी कोई डिस्पैच नहीं हुआ है। Amazon रिम्बर्समेंट विंडो ~4-5 दिनों में बंद हो जाएगी। तत्काल कार्रवाई आवश्यक है।",
  ORDER_NO_TRACKING_ID: "रिमूवल ऑर्डर {orderId} का Amazon डेटा में शिपमेंट रिकॉर्ड है लेकिन कोई ट्रैकिंग नंबर असाइन नहीं किया गया है।",
  RO_DISPATCH_BREACH_5D: "रिमूवल ऑर्डर {orderId} के लिए अनुरोध भेजा गया था लेकिन Amazon ने 5 दिनों के बाद भी इस शिपमेंट को डिस्पैच नहीं किया है। रिम्बर्समेंट विंडो ~9 दिनों में बंद हो जाएगी।",
  RO_DISPATCH_BREACH_10D: "रिमूवल ऑर्डर {orderId} के लिए अनुरोध भेजा गया था लेकिन 10 दिनों के बाद भी कोई डिस्पैच नहीं हुआ है। Amazon रिम्बर्समेंट विंडो ~4-5 दिनों में बंद हो जाएगी। तत्काल कार्रवाई आवश्यक है।",
  RO_TRACKING_NO_ASSIGNED: "रिमूवल ऑर्डर {orderId} का Amazon डेटा में शिपमेंट रिकॉर्ड है लेकिन कोई ट्रैकिंग नंबर असाइन नहीं किया गया है।"
};

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: any; label: string; action: string }> = {
  L4: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', icon: <ShieldAlert size={18} className="text-red-600" />, label: 'CRITICAL', action: 'Phone + WhatsApp' },
  L3: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: <AlertTriangle size={18} className="text-orange-600" />, label: 'HIGH', action: 'Dashboard Banner' },
  L2: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: <Bell size={18} className="text-amber-600" />, label: 'MEDIUM', action: 'Email / Push' },
  L1: { color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: <Info size={18} className="text-slate-500" />, label: 'LOW', action: 'In-app only' },
};

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  const [counts, setCounts] = useState<any>({ L1: 0, L2: 0, L3: 0, L4: 0, total: 0 });
  const [stats, setStats] = useState<any>({ resolvedToday: 0, sopFollowedToday: 0, adherenceRate: 100 });
  const [sopChecked, setSopChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const [editingSopType, setEditingSopType] = useState<string | null>(null);
  const [editingSopSteps, setEditingSopSteps] = useState<{ stepOrder: number; instruction: string }[]>([]);
  const [savingSop, setSavingSop] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolutionText, setBulkResolutionText] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [quickResolvingId, setQuickResolvingId] = useState<string | null>(null);
  const [resolveDataErrors, setResolveDataErrors] = useState<Record<string, string>>({});
  const [resolveError, setResolveError] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?resolved=${showResolved}&dashboard=true`, {
        headers: { "x-user-language": preferredLanguage },
      });
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.alerts || []);
        setSopMap(data.sopMap || {});
        if (data.counts) setCounts(data.counts);
        if (data.stats) setStats(data.stats);
      }
    } finally { setLoading(false); }
  }, [showResolved, preferredLanguage]);

  useEffect(() => {
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    queueMicrotask(() => { fetchAlerts(); });
    window.addEventListener('preferred-language-changed', syncLanguage);
    window.addEventListener('storage', syncLanguage);
    return () => {
      window.removeEventListener('preferred-language-changed', syncLanguage);
      window.removeEventListener('storage', syncLanguage);
    };
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolveError('');
    if (!resolutionText.trim()) {
      setResolveError('Resolution notes are required.');
      return;
    }
    if (!sopChecked) {
      setResolveError('You must acknowledge following the SOP.');
      return;
    }
    setResolving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText, sopAcknowledged: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || 'Failed to resolve');
        return;
      }
      setExpandedId(null);
      setResolutionText('');
      setSopChecked(false);
      fetchAlerts();
    } finally { setResolving(false); }
  };

  const startEditSop = (alertType: string) => {
    const existing = sopMap[alertType] || [];
    setEditingSopSteps(existing.length > 0
      ? existing.map(s => ({ stepOrder: s.stepOrder, instruction: s.instruction }))
      : [{ stepOrder: 1, instruction: '' }]
    );
    setEditingSopType(alertType);
  };

  const saveSop = async () => {
    if (!editingSopType) return;
    setSavingSop(true);
    try {
      await fetch('/api/alerts/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: editingSopType, steps: editingSopSteps }),
      });
      setEditingSopType(null);
      fetchAlerts();
    } finally { setSavingSop(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(alerts.map((a: any) => a.id)));
  const selectNone = () => setSelectedIds(new Set());
  const selectNext10 = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      alerts.filter((a: any) => !next.has(a.id)).slice(0, 10).forEach((a: any) => next.add(a.id));
      return next;
    });
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkResolutionText.trim() && !confirm(`Resolve ${selectedIds.size} alert${selectedIds.size > 1 ? 's' : ''} without notes?`)) return;
    setBulkResolving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(alertId =>
          fetch('/api/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId, resolution: bulkResolutionText.trim() || 'Bulk resolved by inspector', forceResolve: false }),
          })
        )
      );
      setSelectedIds(new Set());
      setBulkResolutionText('');
      fetchAlerts();
    } finally {
      setBulkResolving(false);
    }
  };

  const handleQuickResolve = async (alertId: string) => {
    setQuickResolvingId(alertId);
    setResolveDataErrors(prev => { const next = { ...prev }; delete next[alertId]; return next; });
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: 'Resolved by inspector', forceResolve: false }),
      });
      const data = await res.json();
      if (res.status === 422 && data.dataIssue) {
        setResolveDataErrors(prev => ({ ...prev, [alertId]: data.error }));
      } else if (res.ok) {
        setExpandedId(null);
        fetchAlerts();
      } else {
        setResolveDataErrors(prev => ({ ...prev, [alertId]: data.error || 'Failed to resolve alert.' }));
      }
    } catch {
      setResolveDataErrors(prev => ({ ...prev, [alertId]: 'Network error. Please try again.' }));
    } finally {
      setQuickResolvingId(null);
    }
  };

  const getSeverityLabel = (level: string) => {
    if (lang === 'hi') {
      if (level === 'L4') return 'गंभीर';
      if (level === 'L3') return 'उच्च';
      if (level === 'L2') return 'मध्यम';
      if (level === 'L1') return 'निम्न';
      return level;
    } else {
      if (level === 'L4') return 'CRITICAL';
      if (level === 'L3') return 'HIGH';
      if (level === 'L2') return 'MEDIUM';
      if (level === 'L1') return 'LOW';
      return level;
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (lang === 'hi') {
      if (mins < 1) return 'अभी-अभी';
      if (mins < 60) return `${mins} मिनट पहले`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} घंटे पहले`;
      return `${Math.floor(hrs / 24)} दिन पहले`;
    } else {
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Upper header section */}
      <div className="shrink-0 p-6 border-b border-slate-200 bg-slate-50 text-left">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">{lang === 'hi' ? 'अलर्ट केंद्र' : 'Alert Centre'}</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">{lang === 'hi' ? 'सिस्टम-व्यापी एस्केलेशन और घटनाएं · सभी स्तर दिखाई दे रहे हैं।' : 'System-wide escalations & incidents · All levels visible.'}</p>
          </div>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest border rounded transition-colors ${
              showResolved ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF6700]'
            }`}
          >
            {showResolved ? (lang === 'hi' ? 'सक्रिय दिखाएं' : 'Show Active') : (lang === 'hi' ? 'समाधानित दिखाएं' : 'Show Resolved')}
          </button>
        </div>

        {/* Bulk Selection Controls */}
        {!showResolved && alerts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {selectedIds.size > 0 ? (
              <>
                <span className="text-xs font-black text-[#FF6700] shrink-0">
                  {selectedIds.size} / {alerts.length} selected
                </span>
                <input
                  value={bulkResolutionText}
                  onChange={e => setBulkResolutionText(e.target.value)}
                  placeholder="Bulk resolution note (optional)..."
                  className="flex-1 min-w-[200px] bg-white border border-slate-300 px-3 py-1.5 text-xs rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700] text-slate-950"
                />
                <button
                  onClick={handleBulkResolve}
                  disabled={bulkResolving}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded transition-colors shadow-sm shrink-0"
                >
                  {bulkResolving ? (lang === 'hi' ? 'समाधान हो रहा है...' : 'Resolving...') : `✓ ${lang === 'hi' ? 'समाधान' : 'Resolve'} ${selectedIds.size}`}
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 border border-slate-300 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-slate-400 transition-colors shrink-0"
                >
                  {lang === 'hi' ? 'सभी चयन हटाएं' : 'Deselect All'}
                </button>
              </>
            ) : (
              <>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{lang === 'hi' ? 'बल्क चयन:' : 'Bulk Select:'}</span>
                <button
                  onClick={() => selectNext10()}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  + 10 Alerts
                </button>
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  Select All ({alerts.length})
                </button>
              </>
            )}
          </div>
        )}

        {!showResolved && (
          <div className="mb-4 bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6700]/15 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700]">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">{lang === 'hi' ? 'SOP अनुपालन स्कोर' : 'SOP Compliance Score'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{lang === 'hi' ? 'वास्तविक समय दैनिक अनुपालन स्टैक' : 'Real-time daily adherence stack'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'hi' ? 'आज समाधानित' : 'Resolved Today'}</p>
                <p className="text-lg font-mono font-black text-white mt-0.5">{stats.resolvedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'hi' ? 'SOP पालन' : 'SOP Followed'}</p>
                <p className="text-lg font-mono font-black text-green-400 mt-0.5">{stats.sopFollowedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'hi' ? 'अनुपालन दर' : 'Adherence Rate'}</p>
                <p className={`text-lg font-mono font-black mt-0.5 ${stats.adherenceRate >= 90 ? 'text-green-400' : stats.adherenceRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                  {stats.adherenceRate}%
                </p>
              </div>
            </div>
          </div>
        )}

        {!showResolved && (
          <div className="grid grid-cols-4 gap-3">
            {(['L1', 'L2', 'L3', 'L4'] as const).map(level => {
              const cfg = LEVEL_CONFIG[level];
              return (
                <div key={level} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg px-4 py-3 shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-2xl font-mono font-black ${cfg.color}`}>{counts[level] || 0}</p>
                    <div className="shrink-0">{cfg.icon}</div>
                  </div>
                  <p className={`text-[9px] uppercase tracking-widest font-black ${cfg.color}`}>{getSeverityLabel(level)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main scrolling alerts list section */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">{lang === 'hi' ? 'अलर्ट लोड हो रहे हैं...' : 'Loading alerts...'}</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-lg">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">
              {showResolved ? (lang === 'hi' ? 'कोई समाधानित अलर्ट नहीं' : 'No resolved alerts') : (lang === 'hi' ? 'सब ठीक है' : 'All Clear')}
            </h3>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.L1;
            const isExpanded = expandedId === alert.id;
            const sopSteps = sopMap[alert.type] || [];
            return (
              <div key={alert.id} className={`bg-white border ${cfg.borderColor} rounded-lg overflow-hidden shadow-sm transition-all ${alert.level === 'L4' ? 'ring-1 ring-red-200' : ''} ${selectedIds.has(alert.id) ? 'ring-2 ring-[#FF6700]/40' : ''}`}>
                <div className={`flex items-stretch ${cfg.bgColor}`}>
                  {/* Checkbox */}
                  {!showResolved && (
                    <div
                      className="flex items-center pl-4 pr-2 shrink-0 border-r border-black/5 cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleSelect(alert.id); }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(alert.id)}
                        onChange={() => toggleSelect(alert.id)}
                        className="w-4 h-4 cursor-pointer accent-[#FF6700] rounded"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {/* Expand Button */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); setResolveError(''); setSopChecked(false); }}
                    className={`flex-1 flex items-center justify-between ${!showResolved ? 'pl-3 pr-5' : 'px-5'} py-4 hover:brightness-95 transition-all text-left`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.bgColor} border ${cfg.borderColor}`}>{cfg.icon}</div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{getSeverityLabel(alert.level)}</span>
                          {alert.resolved && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">RESOLVED</span>}
                        </div>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{alert.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      {alert.manifest && <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{alert.manifest.trackingId}</span>}
                      <span className="text-[10px] text-slate-400 font-bold">{timeAgo(alert.createdAt)}</span>
                      {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {/* Quick Resolve Button */}
                  {!alert.resolved && !showResolved && (
                    <div
                      className="flex items-center px-3 shrink-0 border-l border-black/5"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleQuickResolve(alert.id)}
                        disabled={quickResolvingId === alert.id}
                        title="Quick Resolve"
                        className="text-[9px] font-black uppercase tracking-widest text-green-600 hover:text-green-800 disabled:opacity-50 border border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded transition-all whitespace-nowrap"
                      >
                        {quickResolvingId === alert.id ? '···' : (lang === 'hi' ? '✓ समाधान' : '✓ Resolve')}
                      </button>
                    </div>
                  )}
                </div>
                {/* Data-check error banner */}
                {resolveDataErrors[alert.id] && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-left">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0">⚠ Data Check:</span>
                    <p className="text-[10px] text-amber-700 flex-1 leading-snug">{resolveDataErrors[alert.id]}</p>
                    <button
                      onClick={() => setResolveDataErrors(prev => { const next = { ...prev }; delete next[alert.id]; return next; })}
                      className="text-amber-400 hover:text-amber-600 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                {isExpanded && (
                  <div className="px-5 py-5 space-y-4 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200 text-left">
                    <p className="text-sm text-slate-600 leading-relaxed text-left">
                      {lang === 'hi' ? (
                        HINDI_ALERT_DESCRIPTIONS[alert.type]
                          ? HINDI_ALERT_DESCRIPTIONS[alert.type]
                              .replace('{trackingId}', alert.manifest?.trackingId || alert.description.match(/\b\d{8,15}\b/)?.[0] || '')
                              .replace('{orderId}', alert.description.match(/Removal Order (\S+)/i)?.[1] || alert.manifest?.removalOrderId || '')
                          : translateInstruction(alert.description, 'hi')
                      ) : alert.description}
                    </p>
                    {editingSopType === alert.type ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">{lang === 'hi' ? 'समाधान चरण संपादित करें' : 'Edit Resolution Steps'}</h4>
                          <div className="flex space-x-2">
                            <button onClick={() => setEditingSopType(null)} className="text-[10px] uppercase font-bold text-slate-500">{lang === 'hi' ? 'रद्द' : 'Cancel'}</button>
                            <button onClick={saveSop} disabled={savingSop} className="text-[10px] uppercase font-bold text-[#FF6700]">{savingSop ? (lang === 'hi' ? 'सेव हो रहा है...' : 'Saving...') : (lang === 'hi' ? 'सेव करें' : 'Save')}</button>
                          </div>
                        </div>
                        {editingSopSteps.map((step, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400 w-6">{i + 1}.</span>
                            <input value={step.instruction} onChange={e => { const u = [...editingSopSteps]; u[i] = { ...u[i], instruction: e.target.value }; setEditingSopSteps(u); }} className="flex-1 bg-white border border-slate-300 px-3 py-2 text-sm rounded focus:border-[#FF6700] focus:outline-none text-slate-950" placeholder="Step instruction..." />
                            <button onClick={() => setEditingSopSteps(editingSopSteps.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                          </div>
                        ))}
                        <button onClick={() => setEditingSopSteps([...editingSopSteps, { stepOrder: editingSopSteps.length + 1, instruction: '' }])} className="text-[10px] uppercase font-bold text-[#FF6700] tracking-widest">+ Add Step</button>
                      </div>
                    ) : sopSteps.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">{lang === 'hi' ? 'समाधान SOP' : 'Resolution SOP'}</h4>
                          <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] flex items-center space-x-1"><Pencil size={10} /><span>{lang === 'hi' ? 'संपादित' : 'Edit'}</span></button>
                        </div>
                        <ol className="space-y-2 text-left">
                          {sopSteps.map((step: any, i: number) => (
                            <li key={step.id || i} className="flex items-start space-x-3">
                              <span className="shrink-0 w-6 h-6 bg-[#FF6700]/10 text-[#FF6700] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <p className="text-sm text-slate-700 leading-snug">{step.instruction}</p>
                            </li>
                          ))}
                        </ol>
                        {!alert.resolved && (
                          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`sop-check-${alert.id}`}
                              checked={sopChecked}
                              onChange={(e) => setSopChecked(e.target.checked)}
                              className="w-5 h-5 accent-green-600 rounded cursor-pointer shrink-0"
                            />
                            <label htmlFor={`sop-check-${alert.id}`} className="text-xs font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                              {lang === 'hi' ? 'मैंने उपर दिए गए सभी SOP चरणों को पढ़ा और उनका पालन किया है' : 'I have read and followed all standard operating procedure steps above'}
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">{lang === 'hi' ? 'इस अलर्ट प्रकार के लिए कोई SOP कॉन्य़िगर नहीं है।' : 'No SOP configured.'}</p>
                        <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] tracking-widest">+ Create SOP Steps</button>
                      </div>
                    )}
                    {!alert.resolved && (
                      <div className="space-y-2 text-left">
                        <div className="flex flex-col space-y-3 pt-2">
                          <div className="flex items-center space-x-3">
                            <input
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              placeholder="Resolution notes (required)..."
                              className="flex-1 bg-white border border-slate-300 px-4 py-3 text-sm rounded focus:border-[#FF6700] focus:outline-none text-slate-950"
                            />
                            <button
                              onClick={() => handleResolve(alert.id)}
                              disabled={resolving || !sopChecked || !resolutionText.trim()}
                              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors shadow-sm"
                            >
                              {resolving ? (lang === 'hi' ? 'समाधान हो रहा है...' : 'Resolving...') : (lang === 'hi' ? 'समाधान सुनिश्चित करें' : 'Confirm Resolve')}
                            </button>
                          </div>
                          {!sopChecked && (
                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                              {lang === 'hi' ? 'समाधान से पहले आपको उपर दिए गए SOP चरणों को मानना आवश्यक है।' : 'You must check "I have read and followed all standard operating procedure steps above" before resolving.'}
                            </p>
                          )}
                        </div>
                        {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
                      </div>
                    )}
                    {alert.resolved && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">{lang === 'hi' ? 'समाधानित' : 'Resolved'}</p>
                        <p className="text-sm text-green-800">{alert.resolution || 'No notes'}</p>
                        <p className="text-[10px] text-green-600 mt-2">By: {alert.resolvedBy?.name || alert.resolvedBy?.email || 'System'} • {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}