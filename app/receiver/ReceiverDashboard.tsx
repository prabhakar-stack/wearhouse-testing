"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  QrCode,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Check,
  Box,
  User,
  ArrowLeft,
  Shield,
  ChevronDown,
  Bell,
  X,
  Activity,
  Menu,
  Home,
  ChevronRight,
  ChevronLeft,
  LogOut,
  ShieldAlert,
  Info,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import LanguagePreference from "@/app/components/LanguagePreference";
import { getStoredLanguage, translateInstruction, PreferredLanguage } from "@/lib/i18n";
import LogoutConfirmModal from "@/app/components/LogoutConfirmModal";
import { savePendingUpload } from "@/lib/indexedDb";
import PendingUploadsIndicator from "@/app/components/PendingUploadsIndicator";

// ─── Marketplace → tape image map ─────────────────────────────────────────────
const TAPE_IMAGES: Record<string, { good: string; bad: string }> = {
  AMAZON: {
    good: "/samples/tape_amazon_good.png",
    bad: "/samples/tape_amazon_bad.png",
  },
  SHOPIFY: {
    good: "/samples/tape_shopify_good.png",
    bad: "/samples/tape_shopify_bad.png",
  },
  DEFAULT: {
    good: "/samples/tape_amazon_good.png",
    bad: "/samples/tape_amazon_bad.png",
  },
};

function getTapeImages(marketplace: string) {
  return TAPE_IMAGES[marketplace?.toUpperCase()] ?? TAPE_IMAGES.DEFAULT;
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

// ─── Types ─────────────────────────────────────────────────────────────────────
type CheckState = "null" | "good" | "damaged";
type Marketplace = "AMAZON" | "SHOPIFY" | string;

// ─── Root component ─────────────────────────────────────────────────────────────
export default function ReceiverDashboard({
  userId,
  role,
  name,
  email,
}: {
  userId: string;
  role: string;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "home" | "receive" | "ledger" | "profile" | "expected" | "alerts"
  >("home");
  const [userData, setUserData] = useState<any>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';

  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    requestAnimationFrame(() => {
      setNow(Date.now());
    });
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
        setShowLogoutConfirm(true);
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
    const lang = getStoredLanguage();
    if (typeof window !== 'undefined') {
      const minimized = localStorage.getItem("isSidebarMinimized") === "true";
      requestAnimationFrame(() => {
        setPreferredLanguage(lang);
        setIsSidebarMinimized(minimized);
      });
    } else {
      requestAnimationFrame(() => {
        setPreferredLanguage(lang);
      });
    }
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const t = (text: string) => translateInstruction(text, preferredLanguage);
  const tt = (en: string, hi: string) => preferredLanguage === "hi" ? hi : en;
  // cache of trackingId → marketplace fetched from expected list
  const [trackingIdMarketplaceMap, setTrackingIdMarketplaceMap] = useState<
    Record<string, Marketplace>
  >({});

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUserData(d.user);
      })
      .catch(console.error);
  }, []);

  const resolvedName =
    userData?.name || (name !== email ? name : "") || "Receiver";
  const isEmail = resolvedName.includes("@");
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

  const [expectedCount, setExpectedCount] = useState(0);
  const [ledgerCount, setLedgerCount] = useState(0);

  // Pre-fetch expected and ledger counts with live stats updates
  useEffect(() => {
    const fetchLiveStats = () => {
      fetch("/api/dock/expected")
        .then((r) => r.json())
        .then((d) => {
          if (d.expected) {
            setExpectedCount(d.expected.length);
            const map: Record<string, Marketplace> = {};
            d.expected.forEach((item: any) => {
              const mp = item.returnItems?.[0]?.order?.marketplace ?? "AMAZON";
              map[item.trackingId] = mp;
            });
            setTrackingIdMarketplaceMap(map);
          }
        })
        .catch(console.error);

      fetch("/api/dock/ledger")
        .then((r) => r.json())
        .then((d) => {
          if (d.ledger) {
            setLedgerCount(d.ledger.length);
          }
        })
        .catch(console.error);
    };

    fetchLiveStats();
    const iv = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(iv);
  }, []);

  const [alertCount, setAlertCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [activeSopAlertId, setActiveSopAlertId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const fetchAlerts = useCallback(() => {
    fetch("/api/alerts", {
      headers: { "x-user-language": preferredLanguage }
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

  const handleResolve = async (alertId: string) => {
    if (!resolutionText.trim()) return;
    setResolvingId(alertId);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, resolution: resolutionText }),
      });
      if (res.ok) {
        setResolutionText("");
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
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative select-none">
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
          preferredLanguage={preferredLanguage}
        />
      )}
      {/* Mobile Top Header */}
      <header className="lg:hidden bg-black text-white shrink-0 shadow-lg z-20 flex items-center justify-between px-6 h-14 border-b border-white/10 w-full">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
            <QrCode className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[120px]" title={resolvedName}>{resolvedName}</h1>
            <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className={`relative p-1 hover:text-white transition-colors ${showNotifications ? 'text-white' : 'text-slate-400'}`}
            title="Notifications & Alerts"
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
        className={`fixed inset-y-0 left-0 z-50 lg:z-20 ${
          isSidebarMinimized ? 'lg:w-16 w-64' : 'w-64'
        } bg-black text-white flex flex-col border-r border-black/10 transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center ${isSidebarMinimized ? 'justify-center' : 'justify-between'} px-6 h-16 border-b border-white/10 shrink-0`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <QrCode className="text-white" size={16} />
            </div>
            {!isSidebarMinimized && (
              <div className="text-left animate-in fade-in duration-200">
                <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none">
                  {lang === 'hi' ? 'रिसीवर' : 'RECEIVER'}
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
                ? lang === 'hi' ? 'नेविगेशन विस्तृत करें' : 'Expand Sidebar'
                : lang === 'hi' ? 'नेविगेशन छोटा करें' : 'Collapse Sidebar'
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
          <TabButton id="home"     icon={<Home size={14} />}        label={lang === 'hi' ? 'होम' : 'Home'}                  activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} isMinimized={isSidebarMinimized} />
          <TabButton id="expected" icon={<FileText size={14} />}    label={lang === 'hi' ? 'अपेक्षित डिलीवरी' : 'Expected Deliveries'} activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={expectedCount > 0 ? expectedCount : undefined} isMinimized={isSidebarMinimized} />
          <TabButton id="receive"  icon={<QrCode size={14} />}      label={lang === 'hi' ? 'पैकेज प्राप्त करें' : 'Receive Package'} activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} isMinimized={isSidebarMinimized} />
          <TabButton id="ledger"   icon={<Box size={14} />}         label={lang === 'hi' ? 'हैंडओवर बही' : 'Handover Ledger'} activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={ledgerCount > 0 ? ledgerCount : undefined} isMinimized={isSidebarMinimized} />
          <TabButton id="alerts"   icon={<Bell size={14} />}        label={lang === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'} activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={alertCount > 0 ? alertCount : undefined} isMinimized={isSidebarMinimized} />
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-4 border-t border-white/10 shrink-0 ${isSidebarMinimized ? 'flex flex-col items-center space-y-4' : 'space-y-3'}`}>
          {!isSidebarMinimized && (role === 'ADMIN' || role === 'SUPER_ACCESS') && (
            <div className="flex flex-col space-y-1.5 px-2 w-full animate-in fade-in duration-200">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                {lang === 'hi' ? 'भूमिका बदलें' : 'Switch Role'}
              </label>
              <div className="relative">
                <select
                  value={typeof window !== 'undefined' ? (localStorage.getItem('userRole') || 'RECEIVER') : 'RECEIVER'}
                  onChange={(e) => {
                    const val = e.target.value;
                    localStorage.setItem('userRole', val);
                    if (val === 'SUPER_ACCESS') {
                      window.location.href = '/super-admin';
                    } else if (val === 'ADMIN') {
                      window.location.href = '/admin';
                    } else if (val === 'RECEIVER') {
                      window.location.href = '/receiver';
                    } else if (val === 'CLAIMS_SPECIALIST') {
                      window.location.href = '/claims-specialist';
                    } else if (val === 'RECOVERER') {
                      window.location.href = '/recoverer';
                    } else if (val === 'QC_AGENT') {
                      window.location.href = '/qc-agent';
                    } else {
                      window.location.href = '/inspector';
                    }
                  }}
                  className="w-full bg-white/10 text-white/90 text-xs font-semibold px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-[#FF6700] hover:bg-white/20 transition-all cursor-pointer appearance-none pr-8"
                >
                  <option value="SUPER_ACCESS" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'सुपर एक्सेस' : 'Super Access'}
                  </option>
                  <option value="ADMIN" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'एडमिन' : 'Admin'}
                  </option>
                  <option value="RECEIVER" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'रिसीवर' : 'Receiver'}
                  </option>
                  <option value="INSPECTOR" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'इंस्पेक्टर' : 'Inspector'}
                  </option>
                  <option value="CLAIMS_SPECIALIST" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'क्लेम्स स्पेशलिस्ट' : 'Claims Specialist'}
                  </option>
                  <option value="RECOVERER" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'रिकवरर' : 'Recoverer'}
                  </option>
                  <option value="QC_AGENT" className="bg-[#1e1d4b] text-white">
                    {lang === 'hi' ? 'क्यूसी एजेंट' : 'QC Agent'}
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/60">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          )}
          
          {!isSidebarMinimized && (role === 'ADMIN' || role === 'SUPER_ACCESS') && <div className="h-px bg-white/10 w-full"></div>}

          {/* Clickable Profile Section */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center ${isSidebarMinimized ? 'justify-center' : 'space-x-3 px-3'} py-2.5 rounded-lg hover:bg-white/10 transition-colors group text-left ${activeTab === 'profile' ? 'bg-white/10 font-bold' : ''}`}
            title={lang === 'hi' ? 'प्रोफ़ाइल देखें' : 'View Profile'}
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black">
              {initials}
            </div>
            {!isSidebarMinimized && (
              <div className="min-w-0 flex-1 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-white leading-tight break-words">{resolvedName}</p>
                <p className="text-[9px] uppercase tracking-widest text-[#FF6700] font-bold mt-0.5">
                  {role.replace(/_/g, ' ')}
                </p>
              </div>
            )}
            {!isSidebarMinimized && <User size={12} className="text-[#FF6700]/70 group-hover:text-white transition-colors shrink-0" />}
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={`w-full ${isSidebarMinimized ? 'flex justify-center p-2.5' : 'px-3 py-2 text-center'} bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md`}
            title={lang === 'hi' ? 'लॉगआउट' : 'Logout'}
          >
            {isSidebarMinimized ? <LogOut size={16} /> : lang === 'hi' ? 'लॉगआउट' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        {showNotifications && (
          <div className="absolute right-4 top-16 w-[calc(100vw-32px)] sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] flex flex-col max-h-[500px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <Bell className="text-[#FF6700]" size={16} />
                <span className="text-xs font-black uppercase tracking-widest text-[#313079]">
                  {lang === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'}
                </span>
                {alerts.length > 0 && (
                  <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                    {alerts.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowNotifications(false);
                  setActiveSopAlertId(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[440px] bg-slate-50/30">
              {alerts.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <CheckCircle2
                    size={36}
                    className="text-green-500 mb-2 opacity-50"
                  />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {lang === 'hi' ? 'सब ठीक है — कोई अलर्ट नहीं' : 'All Clear — No Pending Alerts'}
                  </p>
                </div>
              ) : (
                alerts.map((alert) => {
                  return (
                    <div
                      key={alert.id}
                      className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-1 relative pl-4 text-left"
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                            {alert.level} - {alert.type}
                          </span>
                          <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">
                            {alert.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                            {alert.description}
                          </p>
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

        <div className={`flex-1 custom-scrollbar bg-slate-50 ${activeTab === "alerts" ? "overflow-hidden p-0" : "overflow-y-auto p-6"}`}>
        {activeTab === "home" && (
          <div className="max-w-4xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom duration-300">
            {/* Header Banner */}
            <div className="flex flex-col space-y-2 text-left border-b border-[#313079]/10 pb-4">
              <h2 className="text-2xl font-black tracking-widest uppercase text-[#313079]">
                {lang === 'hi' ? 'रिसीवर कंट्रोल सेंटर' : 'Receiver Control Center'}
              </h2>
              <p className="text-xs font-mono uppercase tracking-widest text-[#313079]/50">
                {lang === 'hi' ? 'इनबाउंड लॉजिस्टिक्स और पैकेज अंतर्ग्रहण संचालन' : 'Inbound Logistics & Package Intake Operations'}
              </p>
            </div>

            {/* Grid of Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setActiveTab("expected")}
                className="relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 text-left flex items-center justify-between overflow-hidden rounded-2xl shadow-sm transform"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex-1 pr-4">
                  <h3 className="text-lg font-black uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                    {lang === 'hi' ? 'अपेक्षित डिलीवरी' : 'Expected Deliveries'}
                    <span className="ml-2.5 bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0">
                      {expectedCount}
                    </span>
                  </h3>
                  <p className="text-xs text-[#313079]/65 mt-2 tracking-wide font-medium">
                    {lang === 'hi' ? 'आज प्राप्त होने वाले शिपमेंट की अपेक्षित सूची देखें।' : 'Check scheduled returns and shipments expected at the loading dock today.'}
                  </p>
                </div>
                <FileText
                  size={36}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10 shrink-0"
                />
              </button>

              <button
                onClick={() => setActiveTab("receive")}
                className="relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 text-left flex items-center justify-between overflow-hidden rounded-2xl shadow-sm transform"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex-1 pr-4">
                  <h3 className="text-lg font-black uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">
                    {lang === 'hi' ? 'पैकेज प्राप्त करें' : 'Receive Package'}
                  </h3>
                  <p className="text-xs text-[#313079]/65 mt-2 tracking-wide font-medium">
                    {lang === 'hi' ? 'शिपमेंट बारकोड को स्कैन करने और स्थिति सत्यापन दर्ज करने के लिए कैमरा चालू करें।' : 'Launch camera scanning sequence to scan return codes and inspect packaging tape.'}
                  </p>
                </div>
                <QrCode
                  size={36}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10 shrink-0"
                />
              </button>

              <button
                onClick={() => setActiveTab("ledger")}
                className="relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 text-left flex items-center justify-between overflow-hidden rounded-2xl shadow-sm transform"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex-1 pr-4">
                  <h3 className="text-lg font-black uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                    {lang === 'hi' ? 'हैंडओवर बही' : 'Handover Ledger'}
                    <span className="ml-2.5 bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0">
                      {ledgerCount}
                    </span>
                  </h3>
                  <p className="text-xs text-[#313079]/65 mt-2 tracking-wide font-medium">
                    {lang === 'hi' ? 'प्राप्त पैकेजों को इंस्पेक्टरों को सौंपने के लिए वर्तमान बही सूची का प्रबंधन करें।' : 'View items in custody stack and prepare them for standard handover protocols.'}
                  </p>
                </div>
                <Box
                  size={36}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10 shrink-0"
                />
              </button>

              <button
                onClick={() => setActiveTab("alerts")}
                className="relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 text-left flex items-center justify-between overflow-hidden rounded-2xl shadow-sm transform"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex-1 pr-4">
                  <h3 className="text-lg font-black uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                    {lang === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'}
                    {alertCount > 0 && (
                      <span className="ml-2.5 bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0 animate-pulse">
                        {alertCount}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#313079]/65 mt-2 tracking-wide font-medium">
                    {lang === 'hi' ? 'महत्वपूर्ण विसंगतियों, समय सीमा के उल्लंघन और एस्केलेशन की समीक्षा करें।' : 'Monitor operational bottlenecks, delivery SLA breaches, and SLA escalations.'}
                  </p>
                </div>
                <Bell
                  size={36}
                  className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10 shrink-0"
                />
              </button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-4 pb-10">
            {/* Profile Card */}
            <div className="bg-white border border-[#313079]/10 overflow-hidden rounded-2xl shadow-md">
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-black to-slate-900 p-8 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Box size={100} className="text-white" />
                </div>
                <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
                  {initials}
                </div>
                <h2 className="text-xl font-black text-white">
                  {resolvedName}
                </h2>
                <p className="text-slate-400 text-xs font-mono mt-1">{email}</p>
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
                  {role.replace(/_/g, " ")}
                </span>
              </div>

              {/* Stats */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FF6700]/5 border border-[#FF6700]/10 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">
                      {lang === 'hi' ? 'प्राप्त आइटम' : 'Items Received'}
                    </p>
                    <p className="text-3xl font-black font-mono text-[#313079]">
                      {userData?.itemsProcessed ?? 0}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">
                      {lang === 'hi' ? 'सटीकता दर' : 'Accuracy Rate'}
                    </p>
                    <p className="text-3xl font-black font-mono text-green-600">
                      {userData?.accuracyRate?.toFixed(1) ?? "100.0"}%
                    </p>
                  </div>
                </div>
                {userData?.createdAt && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-1">
                      {lang === 'hi' ? 'सदस्यता तिथि' : 'Member Since'}
                    </p>
                    <p className="text-sm font-bold text-[#313079]">
                      {new Date(userData.createdAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                  </div>
                )}
                  <LanguagePreference />
                  <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
                    {lang === 'hi' ? 'प्रोफ़ाइल केवल पढ़ने योग्य है · विवरण अपडेट करने के लिए एडमिन से संपर्क करें।' : 'Profile is read-only · Contact Admin to update details.'}
                  </p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-4 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              {lang === 'hi' ? 'साइन आउट' : 'Sign Out'}
            </button>
          </div>
        )}

        {activeTab === "expected" && (
          <ExpectedTab preferredLanguage={preferredLanguage} />
        )}
        {activeTab === "alerts" && (
          <AlertsTab preferredLanguage={preferredLanguage} />
        )}
        {activeTab === "receive" && (
          <ReceiveTab
            userId={userId}
            trackingIdMarketplaceMap={trackingIdMarketplaceMap}
            preferredLanguage={preferredLanguage}
          />
        )}
        {activeTab === "ledger" && (
          <LedgerTab preferredLanguage={preferredLanguage} />
        )}
        </div>
      </main>
      <PendingUploadsIndicator preferredLanguage={preferredLanguage} />
    </div>
  );
}

function ExpectedTab({ preferredLanguage = "en" }: { preferredLanguage?: PreferredLanguage }) {
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const [expected, setExpected] = useState<any[]>([]);;
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    requestAnimationFrame(() => {
      setNow(Date.now());
    });
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetch_ = () => {
      fetch("/api/dock/expected")
        .then((r) => r.json())
        .then((d) => {
          if (d.expected) setExpected(d.expected);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    fetch_();
    const iv = setInterval(fetch_, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 px-2">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
          {lang === 'hi' ? 'आज के अपेक्षित' : 'Expected Today'}
        </h2>
        <span className="bg-white border border-[#FF6700]/20 text-[#FF6700] px-3 py-1 font-mono text-xs rounded-full shadow-sm font-bold">
          {expected.length} {lang === 'hi' ? 'इनबाउंड' : 'INBOUND'}
        </span>
      </div>
      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">
          {lang === 'hi' ? 'इनबाउंड लेजर सिंक हो रही है...' : 'Syncing Inbound Ledger...'}
        </div>
      ) : expected.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-xl">
          <CheckCircle2
            size={48}
            className="mx-auto text-green-500 mb-4 opacity-50"
          />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
            {lang === 'hi' ? 'कोई अपेक्षित डिलीवरी नहीं' : 'No Expected Deliveries'}
          </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {expected.map((item, idx) => {
            const trackingSnapshot = item.trackingData?.[0] || null;

            // 1. Courier ETA: trackingSnapshot.scheduledDelivery
            // 2. Database ETA: item.expectedDate
            // 3. Fallback: order.requestDate + 5 days or manifest.createdAt + 5 days
            const orderRequestDate = item.returnItems?.[0]?.order?.requestDate;
            const fallbackBaseDate = orderRequestDate || item.createdAt || new Date();
            const fallbackComputedDate = new Date(new Date(fallbackBaseDate).getTime() + 5 * 24 * 60 * 60 * 1000);

            let etaDate = null;
            if (trackingSnapshot?.scheduledDelivery) {
              const d = new Date(trackingSnapshot.scheduledDelivery);
              if (!isNaN(d.getTime())) etaDate = d;
            }
            if (!etaDate && item.expectedDate) {
              const d = new Date(item.expectedDate);
              if (!isNaN(d.getTime())) etaDate = d;
            }
            if (!etaDate) {
              etaDate = fallbackComputedDate;
            }

            const currentNow = now || (etaDate ? etaDate.getTime() : 0);
            const hoursOverdue = etaDate
              ? (currentNow - etaDate.getTime()) / 3600000
              : null;
            // Status: future ETA = ON TIME, past ETA within 7 days = OVERDUE, beyond 7 days = OVERDUE
            const deliveryStatus =
              hoursOverdue === null ? "no_eta"
              : hoursOverdue <= 0 ? "on_time"
              : hoursOverdue <= 168 ? "overdue"   // within 7 days overdue
              : "late";                            // very late / no meaningful ETA
            const marketplace =
              item.returnItems?.[0]?.order?.marketplace || "UNKNOWN";
            return (
              <div
                key={item.id || idx}
                className="bg-white border border-[#313079]/10 p-4 flex flex-col space-y-3 relative overflow-hidden rounded-xl shadow-sm"
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1.5 rounded-l-xl ${deliveryStatus === "overdue" || deliveryStatus === "late" ? "bg-[#FFF700]" : "bg-[#FF6700]"}`}
                />
                <div className="flex justify-between items-start pl-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#313079]/60">
                      {marketplace} &bull; {item.trackingId}
                    </p>
                    <p className="font-mono text-base text-[#313079] mt-0.5 font-bold">
                      {item.trackingId}
                    </p>
                    {trackingSnapshot ? (
                      <p className="text-[11px] text-[#313079]/70 mt-1 font-medium">
                        {trackingSnapshot.latestStatus ||
                          (lang === 'hi' ? 'ट्रैकिंग जारी है' : 'Tracking in progress')}
                        {trackingSnapshot.latestLocation
                          ? ` · ${trackingSnapshot.latestLocation}`
                          : ""}
                        {etaDate
                          ? ` · ETA ${new Date(etaDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#313079]/70 mt-1 font-medium">
                        {lang === 'hi' ? 'ट्रैकिंग लंबित' : 'Tracking pending'}
                        {etaDate
                          ? ` · ETA ${new Date(etaDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    {deliveryStatus === "overdue" || deliveryStatus === "late" ? (
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 text-xs font-bold uppercase border border-amber-200 rounded-full">
                        {lang === 'hi' ? 'समय सीमा पार' : 'OVERDUE'}
                      </span>
                    ) : deliveryStatus === "on_time" ? (
                      <span className="text-[#FF6700] text-xs font-bold uppercase">
                        {lang === 'hi' ? 'समय पर' : 'ON TIME'}
                      </span>
                    ) : (
                      <span className="text-[#313079]/40 text-xs font-bold uppercase">
                        {lang === 'hi' ? 'ETA नहीं' : 'NO ETA'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Receive Tab ──────────────────────────────────────────────────────────────
function ReceiveTab({
  userId,
  trackingIdMarketplaceMap,
  preferredLanguage = "en",
}: {
  userId: string;
  trackingIdMarketplaceMap: Record<string, Marketplace>;
  preferredLanguage?: PreferredLanguage;
}) {
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const [trackingId, setTrackingId] = useState("");
  const [scannedTrackingId, setScannedTrackingId] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace>("AMAZON");
  const [searchError, setSearchError] = useState("");
  const [loadingVerify, setLoadingVerify] = useState(false);

  const verifyAndSetTrackingId = async (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) return;
    setLoadingVerify(true);
    setSearchError("");
    try {
      const res = await fetch(
        `/api/dock/verify?trackingId=${encodeURIComponent(trimmedId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Failed to verify Tracking ID");
        setLoadingVerify(false);
        return;
      }
      setMarketplace(data.marketplace || "AMAZON");
      setScannedTrackingId(trimmedId);
      setTrackingId(trimmedId);
    } catch (err: any) {
      setSearchError("Network error or server unavailable");
    } finally {
      setLoadingVerify(false);
    }
  };

  // Three accordion checks — each advances automatically
  const [activeStep, setActiveStep] = useState(1);
  const [tapeState, setTapeState] = useState<CheckState>("null");
  const [boxState, setBoxState] = useState<CheckState>("null");
  const [tamperState, setTamperState] = useState<CheckState>("null");
  const [allChecked, setAllChecked] = useState(false);

  // Damage evidence camera
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // OTP
  const [otpState, setOtpState] = useState<
    "IDLE" | "FETCHING" | "NOT_REQUIRED" | "FETCHED" | "ERROR"
  >("IDLE");
  const [fetchedOtp, setFetchedOtp] = useState("");
  const [manualOtp, setManualOtp] = useState("");
  const [otpRecordId, setOtpRecordId] = useState<string | null>(null);
  const otpPollIntervalRef = useRef<number | null>(null);
  const otpPollTimeoutRef = useRef<number | null>(null);

  // Done screen + silent upload
  const [showDoneScreen, setShowDoneScreen] = useState(false);

  // Scanner
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const isDamaged =
    tapeState === "damaged" ||
    boxState === "damaged" ||
    tamperState === "damaged";
  const isAllGood =
    tapeState === "good" && boxState === "good" && tamperState === "good";

  const stopOtpPolling = useCallback(() => {
    if (otpPollIntervalRef.current !== null) {
      window.clearInterval(otpPollIntervalRef.current);
      otpPollIntervalRef.current = null;
    }

    if (otpPollTimeoutRef.current !== null) {
      window.clearTimeout(otpPollTimeoutRef.current);
      otpPollTimeoutRef.current = null;
    }
  }, []);

  // Derive marketplace from trackingIdMarketplaceMap as soon as trackingId is scanned
  useEffect(() => {
    if (scannedTrackingId && trackingIdMarketplaceMap[scannedTrackingId]) {
      requestAnimationFrame(() => {
        setMarketplace(trackingIdMarketplaceMap[scannedTrackingId]);
      });
    } else {
      requestAnimationFrame(() => {
        setMarketplace("AMAZON"); // default
      });
    }
  }, [scannedTrackingId, trackingIdMarketplaceMap]);


  // Camera for evidence panel
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showEvidencePanel && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(console.error);
          }
        })
        .catch(console.error);
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [showEvidencePanel]);

  const fetchSystemOTP = useCallback(() => {
    if (!scannedTrackingId) {
      setOtpState("ERROR");
      return;
    }

    stopOtpPolling();
    setOtpState("FETCHING");
    setFetchedOtp("");
    setOtpRecordId(null);

    const pollOtp = async () => {
      try {
        const params = new URLSearchParams();
        if (scannedTrackingId) {
          params.set("trackingId", scannedTrackingId);
        }

        const res = await fetch(
          `/api/otp/latest${params.toString() ? `?${params.toString()}` : ""}`,
        );
        if (!res.ok) {
          throw new Error("Failed to fetch OTP");
        }

        const data = await res.json();
        const record = data?.record;

        if (data?.available && record?.otp) {
          setOtpRecordId(record.id || null);
          setFetchedOtp(String(record.otp));
          setOtpState("FETCHED");
          stopOtpPolling();
        }
      } catch (error) {
        console.error("[OTP] Fetch failed:", error);
        setOtpState("ERROR");
        stopOtpPolling();
      }
    };

    void pollOtp();
    otpPollIntervalRef.current = window.setInterval(pollOtp, 1500);
    otpPollTimeoutRef.current = window.setTimeout(() => {
      setOtpState((current) =>
        current === "FETCHED" ? current : "NOT_REQUIRED",
      );
      stopOtpPolling();
    }, 20000);
  }, [scannedTrackingId, stopOtpPolling]);

  useEffect(() => {
    return () => {
      stopOtpPolling();
    };
  }, [stopOtpPolling]);

  const startScanner = async () => {
    setScanning(true);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H } = await import("html5-qrcode");
        scannerRef.current = new H("reader", {
          verbose: false,
          formatsToSupport: [5, 3, 9, 14],
        });
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 100 } },
        (text: string) => {
          stopScanner();
          verifyAndSetTrackingId(text);
        },
        () => {},
      );
    } catch {
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }
    try {
      scannerRef.current?.clear();
    } catch {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleManualSearch = (e: any) => {
    e.preventDefault();
    if (trackingId.trim()) {
      verifyAndSetTrackingId(trackingId.trim());
    }
  };

  // Mark step & auto-advance
  const handleStepMark = (step: number, value: CheckState) => {
    if (step === 1) {
      setTapeState(value);
      if (value === "damaged") {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else if (activeStep === 1) {
        setTimeout(() => setActiveStep(2), 150);
      }
    }
    if (step === 2) {
      setBoxState(value);
      if (value === "damaged") {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else if (activeStep === 2) {
        setTimeout(() => setActiveStep(3), 150);
      }
    }
    if (step === 3) {
      setTamperState(value);
      if (value === "damaged") {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else if (value === "good") {
        setTimeout(() => {
          setAllChecked(true);
          fetchSystemOTP();
        }, 150);
      }
    }
  };

  // Capture frame for preview
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Trigger shutter flash
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    // Save as data URL for preview screen
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
  };

  // Continue after preview -> submit silent background upload & show done screen
  const handleContinueReject = () => {
    if (!capturedImage) return;

    // Convert data URL to blob synchronously
    let blob: Blob;
    try {
      const arr = capturedImage.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error("Failed to convert image to blob:", e);
      return;
    }

    // Show done screen immediately
    setShowDoneScreen(true);

    const orderId = scannedTrackingId;
    const uid = userId;
    const ts = tapeState;
    const bs = boxState;
    const ts2 = tamperState;

    // Silent background upload
    (async () => {
      const timestamp = Date.now();
      const fileName = `rejection-${orderId}-${timestamp}.jpg`;
      try {
        const filesMetaData = [
          {
            key: "file",
            name: fileName,
            mimeType: "image/jpeg",
          },
        ];
        let folderLink = `https://mock.local/${orderId}`;
        let finalFileId = `folder-${orderId}`;
        let fileLink = "";
        let uploadSuccess = false;

        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            type: "RECEIVER_REJECTION",
            filesMetaData,
          }),
        });

        if (initRes.ok) {
          const d = await initRes.json();
          folderLink = d.folderLink;
          finalFileId = d.orderFolderId;
          if (d.uploadUrls?.["file"]) {
            const rawRes = await fetch(d.uploadUrls["file"], {
              method: "PUT",
              body: blob,
            });
            if (rawRes.ok) {
              const rd = await rawRes.json();
              fileLink = rd.webViewLink;
              finalFileId = rd.fileId || finalFileId;
              uploadSuccess = true;
            }
          }
        }

        if (!uploadSuccess) {
          throw new Error("Google Drive upload failed or skipped due to initialization issue.");
        }

        await fetch("/api/upload/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            folderLink: fileLink || folderLink,
            orderFolderId: finalFileId,
            type: "RECEIVER_REJECTION",
            uploadedById: uid,
            reason: "Package failed visual inspection",
            manifestId: orderId,
          }),
        }).catch(console.error);

        await fetch("/api/dock/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingId: orderId,
            tapeIntact: ts !== "damaged",
            boxCrushed: bs === "damaged",
            isTampered: ts2 === "damaged",
            evidenceUrl: fileLink || folderLink || "UPLOAD_FAILED",
          }),
        }).catch(console.error);
      } catch (e: any) {
        console.error("[Silent Rejection Upload] failed, triggering client IndexedDB backup:", e);
        
        // Save to client device storage (IndexedDB)
        try {
          const lpnConditions = {
            tapeIntact: String(ts !== "damaged"),
            boxCrushed: String(bs === "damaged"),
            isTampered: String(ts2 === "damaged"),
          };
          await savePendingUpload({
            id: `RECEIVER_REJECTION_${orderId}_file`,
            orderId,
            type: "RECEIVER_REJECTION",
            key: "file",
            name: fileName,
            mimeType: "image/jpeg",
            blob: blob,
            uploadedById: uid || undefined,
            reason: "Package failed visual inspection",
            lpnConditions,
            timestamp: Date.now(),
            status: "failed",
            error: e.message || String(e),
          });
          window.dispatchEvent(new Event("pending-uploads-changed"));
          console.log("[IndexedDB Backup] Successfully saved rejection photo to client device IndexedDB.");
        } catch (idbErr) {
          console.error("[IndexedDB Backup] Critical: failed to save to client IndexedDB:", idbErr);
        }

        // Database fallback registration
        try {
          await fetch("/api/upload/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              folderLink: `/api/uploads/${fileName}`,
              orderFolderId: `local_${fileName}`,
              type: "RECEIVER_REJECTION",
              uploadedById: uid,
              reason: "Package failed visual inspection (local backup)",
              manifestId: orderId,
            }),
          }).catch(console.error);

          await fetch("/api/dock/receive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackingId: orderId,
              tapeIntact: ts !== "damaged",
              boxCrushed: bs === "damaged",
              isTampered: ts2 === "damaged",
              evidenceUrl: `/api/uploads/${fileName}`,
            }),
          }).catch(console.error);
        } catch (dbErr) {
          console.error("Failed to register fallback receive status in database:", dbErr);
        }
      }
    })();
  };

  const handleAcceptGood = async () => {
    const trackingIdVal = scannedTrackingId;
    const finalOtp = otpState === "ERROR" ? manualOtp : fetchedOtp;
    // Show done screen immediately
    setShowDoneScreen(true);
    // Silent background submit
    (async () => {
      try {
        await fetch("/api/dock/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingId: trackingIdVal,
            tapeIntact: true,
            boxCrushed: false,
            isTampered: false,
            otpProvided: finalOtp,
            evidenceUrl: "",
          }),
        });

        if (otpRecordId) {
          await fetch("/api/otp/latest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: otpRecordId }),
          });
        }
      } catch (e) {
        console.error("[Silent Accept] failed:", e);
      }
    })();
  };

  const handleCancelCamera = () => {
    setShowEvidencePanel(false);
    setAllChecked(false);
    setCapturedImage(null);
    // Reset the damaged step state back to "null"
    if (tapeState === "damaged") {
      setTapeState("null");
      setActiveStep(1);
    } else if (boxState === "damaged") {
      setBoxState("null");
      setActiveStep(2);
    } else if (tamperState === "damaged") {
      setTamperState("null");
      setActiveStep(3);
    }
  };

  const handleBackFromOtp = () => {
    setAllChecked(false);
    setActiveStep(3);
    setOtpState("IDLE");
    setFetchedOtp("");
    setManualOtp("");
    setOtpRecordId(null);
    stopOtpPolling();
  };

  const resetForm = () => {
    setScannedTrackingId("");
    setTrackingId("");
    setTapeState("null");
    setBoxState("null");
    setTamperState("null");
    setActiveStep(1);
    setAllChecked(false);
    setShowEvidencePanel(false);
    setShowDoneScreen(false);
    setOtpState("IDLE");
    setFetchedOtp("");
    setOtpRecordId(null);
    stopOtpPolling();
    setMarketplace("AMAZON");
    setCapturedImage(null);
  };

  const tapeImgs = getTapeImages(marketplace);

  // ── DONE SCREENS ─────────────────────────────────────────────
  if (showDoneScreen) {
    const rejected = isDamaged;
    return (
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 ${rejected ? "bg-red-600" : "bg-green-600"}`}
      >
        {rejected ? (
          <AlertOctagon size={100} className="text-white mb-6" />
        ) : (
          <CheckCircle2 size={100} className="text-white mb-6" />
        )}
        <h2 className="text-4xl font-black text-white uppercase tracking-widest text-center leading-tight">
          {rejected ? (lang === 'hi' ? '🛑 अस्वीकृत' : '🛑 REJECTED') : (lang === 'hi' ? '✅ स्वीकृत' : '✅ ACCEPTED')}
        </h2>
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase text-center">
          {rejected
            ? (lang === 'hi' ? 'पैकेज कूरियर को वापस करें।' : 'Hand package back to courier.')
            : (lang === 'hi' ? 'पैकेज सफलतापूर्वक प्राप्त हुआ।' : 'Package received successfully.')}
        </p>
        <button
          onClick={resetForm}
          className="mt-12 w-full max-w-sm py-5 bg-white font-black uppercase tracking-widest rounded-2xl shadow-2xl text-xl hover:opacity-90 transition-opacity"
          style={{ color: rejected ? "#dc2626" : "#16a34a" }}
        >
          {lang === 'hi' ? 'अगला पैकेज प्रोसेस करें' : 'Process Next Package'}
        </button>
      </div>
    );
  }

  // ── SCANNER SCREEN ─────────────────────────────────────────────
  if (!scannedTrackingId) {
    return (
      <div className="max-w-2xl mx-auto px-2 sm:px-6 pb-10">
        <div className="border border-[#313079]/10 bg-white p-8 flex flex-col space-y-6 rounded-2xl shadow-sm">
          <div className="text-center">
            <h2 className="text-xl uppercase tracking-widest text-[#FF6700] font-black">
              {lang === 'hi' ? 'पैकेज ट्रैकिंग ID स्कैन करें' : 'Scan Package Tracking ID'}
            </h2>
            <p className="text-base text-[#313079]/70 font-medium mt-1">
              {lang === 'hi' ? 'बारकोड को फ्रेम में रखें' : 'Position barcode in frame'}
            </p>
          </div>
          <div className="relative bg-[#FF6700]/5 w-full aspect-square border-2 border-dashed border-[#313079]/10 overflow-hidden flex flex-col items-center justify-center rounded-xl">
            <div id="reader" className="absolute inset-0 w-full h-full" />
            {!scanning && (
              <Camera size={64} className="mb-3 text-[#313079]/30" />
            )}
            {!scanning && (
              <p className="text-base uppercase tracking-widest text-[#313079]/45 font-bold">
                {lang === 'hi' ? 'कैमरा बंद है' : 'Camera Offline'}
              </p>
            )}
          </div>
          {!scanning ? (
            <button
              onClick={startScanner}
              className="w-full py-6 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white transition-colors font-black uppercase tracking-widest text-lg flex items-center justify-center space-x-3 rounded-2xl shadow-md"
            >
              <Camera size={24} />
              <span>{lang === 'hi' ? 'कैमरा चालू करें' : 'Activate Camera'}</span>
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="w-full py-6 bg-red-500 hover:bg-red-600 text-white transition-colors font-black uppercase tracking-widest text-lg rounded-2xl"
            >
              {lang === 'hi' ? 'कैमरा बंद करें' : 'Stop Camera'}
            </button>
          )}
          <div className="relative flex items-center py-1">
            <div className="absolute border-t border-[#313079]/10 w-full" />
            <span className="bg-white px-4 text-[#313079]/45 text-sm uppercase font-bold tracking-widest relative z-10 mx-auto">
              {lang === 'hi' ? 'मैन्युअल ओवरराइड' : 'Manual Override'}
            </span>
          </div>
          <form
            onSubmit={handleManualSearch}
            className="flex flex-col space-y-4"
          >
            <input
              type="text"
              placeholder={lang === 'hi' ? 'ट्रैकिंग ID दर्ज करें' : 'ENTER TRACKING ID'}
              value={trackingId}
              onChange={(e) => {
                setTrackingId(e.target.value);
                setSearchError("");
              }}
              className="w-full bg-white border-2 border-[#313079]/20 text-[#313079] p-5 font-mono text-xl focus:outline-none focus:border-[#FF6700] text-center rounded-xl font-bold"
            />
            {searchError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-bold rounded flex items-center space-x-2 w-full">
                <AlertOctagon size={18} className="shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!trackingId || loadingVerify}
              className="w-full py-5 bg-[#FF6700]/5 border border-[#FF6700]/10 text-[#313079]/70 hover:text-[#FF6700] hover:border-[#FF6700] transition-colors uppercase tracking-widest text-base font-black disabled:opacity-50 rounded-2xl flex items-center justify-center space-x-2"
            >
              {loadingVerify ? (
                <div className="w-5 h-5 border-2 border-[#313079]/70 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{lang === 'hi' ? 'आगे बढ़ें' : 'Proceed'}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }


  const steps = [
    {
       id: 1,
       label: lang === 'hi' ? 'फ़ैक्टरी टेप अखंड है' : 'Factory Tape Intact',
       state: tapeState,
       instruction: lang === 'hi'
         ? 'जांचें कि बॉक्स की सभी सीम पर लगी फ़ैक्टरी सीलिंग टेप अटूट, चिकनी और निरंतर है। कोई भी कट, उखड़न, या दोबारा लगाई गई टेप = क्षतिग्रस्त।'
         : 'Check that the factory sealing tape across all box seams is unbroken, smooth, and continuous. Any cut, peel, or re-application means DAMAGED.',
       goodImg: tapeImgs.good,
       badImg: tapeImgs.bad,
    },
    {
       id: 2,
       label: lang === 'hi' ? 'बॉक्स संरचना ठीक है' : 'Box Structure OK',
       state: boxState,
       instruction: lang === 'hi'
         ? 'सभी 6 साइड और सभी कोनों पर कुचलन, गहरे डेंट, नमी का नुकसान, या फटे हुए किनारों की जांच करें। आंतरिक ढहने की जांच के लिए साइड पर हल्के से दबाएं।'
         : 'Inspect all 6 sides and all corners for crushing, deep dents, moisture damage, or torn edges. Press gently on sides to check for internal collapse.',
       goodImg: "/samples/box_good.png",
       badImg: "/samples/box_damaged.png",
    },
    {
       id: 3,
       label: lang === 'hi' ? 'छेड़छाड़ के कोई संकेत नहीं' : 'No Signs of Tampering',
       state: tamperState,
       instruction: lang === 'hi'
         ? 'मूल सीम पर लगाई गई अतिरिक्त टेप, फटे/दोबारा लगाए गए लेबल, VOID दिखाने वाले वॉयड स्टिकर, या मेल न खाने वाले टेप रंगों की जांच करें। इनमें से कोई भी = क्षतिग्रस्त।'
         : 'Look for extra tape applied over original seams, torn/re-applied labels, void stickers showing VOID, or mismatched tape colours. Any of these = DAMAGED.',
       goodImg: "/samples/tamper_good.png",
       badImg: "/samples/tamper_bad.png",
    },
  ];

  return (
    <div 
      className={`max-w-2xl mx-auto px-2 sm:px-6 pb-2 select-none flex flex-col ${allChecked ? "justify-start gap-y-4" : "justify-between"}`}
      style={{ height: "calc(100vh - 105px)", minHeight: "500px", gap: allChecked ? undefined : "1.66%" }}
    >
      {/* Tracking ID header - 15% height */}
      <div 
        style={{ height: "15%" }}
        className="border border-[#FF6700]/20 bg-[#FF6700]/5 px-5 py-3 flex justify-between items-center rounded-2xl shadow-sm shrink-0"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-[#313079]/60 font-black">
            {lang === 'hi' ? 'स्कैन किया ट्रैकिंग ID' : 'Scanned Tracking ID'} •{" "}
            <span className="text-[#FF6700]">{marketplace}</span>
          </p>
          <p className="font-mono text-2xl text-[#313079] font-black mt-0.5">
            {scannedTrackingId}
          </p>
        </div>
        <button
          onClick={resetForm}
          className="text-[#313079]/70 hover:text-red-600 text-xs uppercase tracking-widest font-black px-4 py-2 border border-[#313079]/20 rounded-xl transition-colors"
        >
          {lang === 'hi' ? 'रीसेट' : 'Reset'}
        </button>
      </div>

      {!allChecked && (
        <>
           {/* Horizontal Progress Bar - 5% height */}
          <div 
            style={{ height: "5%" }}
            className="px-6 bg-slate-50 border border-[#313079]/10 rounded-2xl shadow-sm overflow-hidden select-none shrink-0"
          >
            <div className="relative w-full h-full flex items-center justify-between">
              {/* Background progress line */}
              <div className="absolute left-[16.67%] right-[16.67%] top-1/2 -translate-y-1/2 h-[3px] bg-slate-200 z-0 rounded-full" />
              {/* Active progress overlay */}
              <div 
                className="absolute left-[16.67%] top-1/2 -translate-y-1/2 h-[3px] bg-gradient-to-r from-[#FF6700] to-orange-500 z-0 transition-all duration-500 rounded-full shadow-[0_1px_2px_rgba(255,103,0,0.2)]"
                style={{
                  width: activeStep === 1 ? "0%" : activeStep === 2 ? "33.33%" : "66.67%"
                }}
              />
              
              {steps.map((s, index) => {
                const stepNum = s.id;
                const isCurrent = activeStep === stepNum;
                const isDone = s.state !== "null";
                
                return (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => {
                      const isPrevDone = index === 0 || steps[index - 1].state !== "null";
                      if (isDone || isCurrent || isPrevDone) {
                        setActiveStep(stepNum);
                      }
                    }}
                    disabled={!(isDone || isCurrent || (index === 0 || steps[index - 1].state !== "null"))}
                    className="relative z-10 flex flex-col items-center justify-center focus:outline-none w-1/3 disabled:cursor-not-allowed h-full"
                  >
                    <div
                      className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                        isDone && s.state === "good"
                          ? "w-5 h-5 bg-green-500 border border-green-500 text-white scale-110 shadow-md"
                          : isDone && s.state === "damaged"
                            ? "w-5 h-5 bg-red-500 border border-red-500 text-white scale-110 shadow-md"
                            : isCurrent
                              ? "w-5 h-5 bg-white border-2 border-[#FF6700] scale-110 shadow-lg ring-4 ring-orange-500/20"
                              : "w-4 h-4 bg-white border border-slate-200 shadow-sm"
                      }`}
                    >
                      {isDone && s.state === "good" && (
                        <Check className="w-3 h-3 stroke-[4]" />
                      )}
                      {isDone && s.state === "damaged" && (
                        <X className="w-3 h-3 stroke-[4]" />
                      )}
                      {isCurrent && (
                        <div className="w-2 h-2 rounded-full bg-[#FF6700] animate-pulse" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Step Card - 65% height */}
          {steps.map((step) => {
            if (activeStep !== step.id) return null;
            
            return (
              <div
                key={step.id}
                style={{ height: "65%" }}
                className="rounded-2xl border border-[#FF6700]/20 shadow-lg shadow-[#FF6700]/5 bg-white overflow-hidden flex flex-col justify-between animate-in fade-in duration-300 animate-out fade-out shrink-0"
              >
                {/* Step Header */}
                <div className="w-full flex items-center justify-between px-5 py-4 bg-[#FF6700]/5 border-b border-[#313079]/10 shrink-0">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xl bg-[#FF6700] text-white">
                      {step.id}
                    </div>
                    <div className="text-left">
                      <p className="text-xl font-black uppercase tracking-widest text-[#FF6700]">
                        {step.label}
                      </p>
                      {step.state !== "null" && (
                        <p className={`text-sm font-bold uppercase tracking-wider ${step.state === "good" ? "text-green-600" : "text-red-600"}`}>
                          {step.state === "good" ? (lang === 'hi' ? '✅ अच्छा' : '✅ Good') : (lang === 'hi' ? '❌ क्षतिग्रस्त' : '❌ Damaged')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-5 py-4 flex-1 flex flex-col justify-between overflow-y-auto space-y-3">
                  <p className="text-base text-[#313079]/90 font-bold leading-relaxed px-1 shrink-0">
                    {step.instruction}
                  </p>

                  {/* Reference Images */}
                  <div className="grid grid-cols-2 gap-4 flex-1 min-h-[120px] max-h-[300px]">
                    <div className="flex flex-col space-y-1 h-full">
                      <div className="relative w-full flex-1 rounded-xl overflow-hidden border-2 border-green-200 bg-[#FF6700]/5 shadow-sm">
                        <Image
                          src={step.goodImg}
                          alt="Good example"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <p className="text-center text-sm font-black uppercase tracking-wider text-green-600 mt-1 shrink-0">
                        {lang === 'hi' ? '✅ अच्छा' : '✅ GOOD'}
                      </p>
                    </div>
                    <div className="flex flex-col space-y-1 h-full">
                      <div className="relative w-full flex-1 rounded-xl overflow-hidden border-2 border-red-200 bg-[#FF6700]/5 shadow-sm">
                        <Image
                          src={step.badImg}
                          alt="Damaged example"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <p className="text-center text-sm font-black uppercase tracking-wider text-red-600 mt-1 shrink-0">
                        {lang === 'hi' ? '❌ क्षतिग्रस्त' : '❌ DAMAGED'}
                      </p>
                    </div>
                  </div>

                  {/* GOOD / DAMAGED selection buttons */}
                  <div className="grid grid-cols-2 gap-4 pt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStepMark(step.id, "good")}
                      className={`py-5 font-black text-xl uppercase tracking-widest rounded-2xl shadow-sm border-2 transition-all active:scale-95 flex items-center justify-center space-x-2 ${
                        step.state === "good"
                          ? "bg-green-500 border-green-500 text-white shadow-md ring-4 ring-green-500/20"
                          : "bg-white border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      <Check size={24} strokeWidth={3} />
                       <span>{lang === 'hi' ? 'अच्छा' : 'GOOD'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepMark(step.id, "damaged")}
                      className={`py-5 font-black text-xl uppercase tracking-widest rounded-2xl shadow-sm border-2 transition-all active:scale-95 flex items-center justify-center space-x-2 ${
                        step.state === "damaged"
                          ? "bg-red-500 border-red-500 text-white shadow-md ring-4 ring-red-500/20"
                          : "bg-white border-red-200 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      <X size={24} strokeWidth={3} />
                       <span>{lang === 'hi' ? 'क्षतिग्रस्त' : 'DAMAGED'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Navigation Buttons - 10% height */}
          <div 
            style={{ height: "10%" }}
            className="flex items-center justify-between shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                if (activeStep > 1) {
                  setActiveStep(activeStep - 1);
                }
              }}
              className={`flex items-center space-x-2 px-6 py-4 rounded-xl border font-black text-sm uppercase tracking-widest transition-all ${
                activeStep === 1
                  ? "opacity-0 pointer-events-none"
                  : "border-[#313079]/20 text-[#313079]/70 hover:bg-[#FF6700]/5 hover:border-[#FF6700] hover:text-[#FF6700]"
              }`}
            >
              <ArrowLeft size={18} />
              <span>{lang === 'hi' ? 'वापस' : 'Back'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeStep < 3) {
                  setActiveStep(activeStep + 1);
                } else {
                  // Finish wizard
                  setAllChecked(true);
                  if (isDamaged) {
                    setShowEvidencePanel(true);
                  } else {
                    fetchSystemOTP();
                  }
                }
              }}
              disabled={steps[activeStep - 1].state === "null"}
              className={`flex items-center space-x-2 px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                steps[activeStep - 1].state === "null"
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                  : "bg-[#FF6700] hover:bg-[#FF6700]/95 text-white"
              }`}
            >
              <span>{activeStep === 3 ? (lang === 'hi' ? 'पूर्ण करें' : 'Complete') : (lang === 'hi' ? 'अगला' : 'Next')}</span>
            </button>
          </div>
        </>
      )}

      {/* Evidence camera — Full Screen Overlay */}
      {showEvidencePanel && !showDoneScreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
          {/* Shutter flash overlay */}
          {shutterFlash && (
            <div className="absolute inset-0 bg-white z-[100] animate-out fade-out duration-150" />
          )}

          {/* Floating Tracking ID header */}
          <div className="absolute top-10 left-0 right-0 z-10 flex flex-col items-center px-4">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 px-6 py-2.5 rounded-2xl text-center shadow-2xl max-w-sm flex items-center space-x-3">
              <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/50 font-black">
                  {lang === 'hi' ? 'क्षति अस्वीकृति साक्ष्य' : 'Damage Rejection Evidence'}
                </p>
                <p className="font-mono text-sm font-black text-white mt-0.5">
                  AWB: {scannedTrackingId}
                </p>
              </div>
            </div>
          </div>

          {/* Close/Reset Button (Floating Top Right) */}
          <button
            type="button"
            onClick={handleCancelCamera}
            className="absolute top-10 right-6 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center border border-white/10 shadow-lg focus:outline-none transition-colors"
          >
            <X size={20} />
          </button>

          {/* Main Visual Display (Live camera or captured preview) */}
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            {!capturedImage ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedImage}
                alt="Captured damage evidence"
                className="w-full h-full object-contain bg-black"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls Overlay (Floating Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-10 px-6 z-10 flex flex-col items-center justify-center">
            {!capturedImage ? (
              /* Circular Capture Button */
              <div className="flex flex-col items-center space-y-4">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-slate-300 shadow-2xl transition-all active:scale-90 focus:outline-none ring-8 ring-white/10 hover:brightness-95"
                >
                  <div className="w-14 h-14 bg-red-600 rounded-full transition-transform active:scale-95" />
                </button>
                <span className="text-[10px] uppercase tracking-widest font-black text-white/70 shadow-sm">
                  {lang === 'hi' ? 'तस्वीर लें' : 'Capture Image'}
                </span>
              </div>
            ) : (
              /* Retake & Continue Buttons */
              <div className="w-full max-w-sm flex items-center justify-between space-x-6">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                  }}
                  className="flex-1 py-4 bg-white/10 hover:bg-white/15 border border-white/30 text-white font-bold text-sm uppercase tracking-widest rounded-2xl shadow-lg focus:outline-none transition-all active:scale-95"
                >
                  {lang === 'hi' ? 'दोबारा लें' : 'Retake'}
                </button>
                
                <button
                  type="button"
                  onClick={handleContinueReject}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg focus:outline-none transition-all active:scale-95"
                >
                  {lang === 'hi' ? 'जारी रखें' : 'Continue'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTP + Accept section — only when all good */}
      {allChecked && isAllGood && !showDoneScreen && (
        <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-3 pt-2">
          <div className="border border-[#313079]/10 bg-white p-6 rounded-2xl shadow-sm">
            {otpState === "FETCHING" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="w-10 h-10 border-4 border-[#FF6700] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm uppercase font-black tracking-widest text-slate-500">
                  {lang === 'hi' ? 'डिलीवरी OTP प्राप्त हो रहा है...' : 'Fetching Delivery OTP...'}
                </p>
              </div>
            )}
            {otpState === "NOT_REQUIRED" && (
              <div className="flex flex-col items-center justify-center space-y-3 py-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 size={36} className="text-green-500" />
                <p className="text-sm uppercase font-black tracking-widest text-green-700 text-center">
                  {lang === 'hi' ? 'OTP आवश्यक नहीं' : 'OTP Not Required'}
                </p>
              </div>
            )}
            {otpState === "FETCHED" && (
              <div className="flex flex-col items-space-y-3 py-2">
                <p className="text-xs uppercase font-black tracking-widest text-[#313079]/60">
                  {lang === 'hi' ? 'सिस्टम OTP' : 'System OTP'}
                </p>
                <div className="w-full bg-[#FF6700]/5 border border-[#FF6700]/20 px-4 py-6 text-center text-4xl font-mono tracking-[0.3em] text-[#313079] rounded-xl shadow-inner">
                  {fetchedOtp}
                </div>
              </div>
            )}
            {otpState === "ERROR" && (
              <div className="flex flex-col items-center space-y-3 py-4 bg-red-50 border border-red-200 rounded-xl px-4">
                <AlertOctagon size={36} className="text-red-500" />
                <p className="text-sm uppercase font-black tracking-widest text-red-700 text-center">
                  {lang === 'hi' ? 'OTP प्राप्त नहीं हुआ' : 'OTP Fetch Failed'}
                </p>
                <p className="text-xs text-red-600 font-semibold text-center mb-2">
                  {lang === 'hi' ? 'सिस्टम ऑफलाइन है। OTP प्राप्त करने के लिए एडमिन/डिवाइस होल्डर को कॉल करें।' : 'System offline. Please call the Admin/Device Holder to get the OTP.'}
                </p>
                <input
                  type="text"
                  placeholder={lang === 'hi' ? 'OTP मैन्युअल दर्ज करें' : 'ENTER OTP MANUALLY'}
                  value={manualOtp}
                  onChange={(e) => setManualOtp(e.target.value)}
                  className="w-full bg-white border-2 border-red-300 text-red-700 p-3 font-mono text-lg focus:outline-none focus:border-red-500 text-center rounded-xl"
                />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between shrink-0 gap-4 mt-2">
            <button
              type="button"
              onClick={handleBackFromOtp}
              className="flex items-center space-x-2 px-6 py-5 rounded-2xl border border-[#313079]/20 text-[#313079]/70 hover:bg-[#FF6700]/5 hover:border-[#FF6700] hover:text-[#FF6700] font-black text-sm uppercase tracking-widest transition-all shadow-sm active:scale-95 shrink-0"
            >
              <ArrowLeft size={18} />
              <span>{lang === 'hi' ? 'वापस' : 'Back'}</span>
            </button>

            {(["NOT_REQUIRED", "FETCHED"].includes(otpState) || (otpState === "ERROR" && manualOtp.trim().length > 0)) ? (
              <button
                type="button"
                onClick={handleAcceptGood}
                className="flex-1 py-5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white uppercase font-black tracking-widest text-base sm:text-lg rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <CheckCircle2 size={22} />
                <span>{lang === 'hi' ? 'पूर्ण और स्वीकार करें' : 'Complete & Accept'}</span>
              </button>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────
function LedgerTab({ preferredLanguage = "en" }: { preferredLanguage?: PreferredLanguage }) {
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dock/ledger")
      .then((r) => r.json())
      .then((d) => {
        if (d.ledger) setLedger(d.ledger);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 px-2">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
          {lang === 'hi' ? 'हैंडओवर बही' : 'Handover Ledger'}
        </h2>
        <span className="bg-white border border-[#FF6700]/20 text-[#FF6700] px-3 py-1 font-mono text-xs font-bold rounded-full shadow-sm">
          {ledger.length} {lang === 'hi' ? 'आइटम' : 'ITEMS'}
        </span>
      </div>
      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">
          {lang === 'hi' ? 'लेजर सिंक हो रही है...' : 'Syncing Ledger...'}
        </div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/10 bg-white rounded-2xl">
          <CheckCircle2
            size={48}
            className="mx-auto text-green-500 mb-4 opacity-50"
          />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
            {lang === 'hi' ? 'सब ठीक है' : 'All Clear'}
          </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {ledger.map((item: any) => (
            <div
              key={item.id}
              className="bg-white border border-[#313079]/10 p-4 flex justify-between items-center relative overflow-hidden rounded-2xl shadow-sm"
            >
              <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-[#FF6700]" />
              <div className="pl-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[#313079]/60">
                  {item.returnItems?.[0]?.order?.marketplace || "UNKNOWN"}
                </p>
                <p className="font-mono text-lg text-[#313079] font-black mt-0.5">
                  {item.trackingId}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase text-[#313079]/60">
                  {lang === 'hi' ? 'प्राप्त' : 'Received'}
                </p>
                <p className="text-sm font-mono text-[#313079] font-bold">
                  {new Date(item.receivedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Alerts Tab ─────────────────────────────────────────────────────────────
function AlertsTab({ preferredLanguage = "en" }: { preferredLanguage?: PreferredLanguage }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  const [counts, setCounts] = useState<any>({ L1: 0, L2: 0, L3: 0, L4: 0, total: 0 });
  const [stats, setStats] = useState<any>({ resolvedToday: 0, sopFollowedToday: 0, adherenceRate: 100 });
  const [sopChecked, setSopChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
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
  const [subcomponentNow, setSubcomponentNow] = useState<number>(0);

  useEffect(() => {
    requestAnimationFrame(() => {
      setSubcomponentNow(Date.now());
    });
    const interval = setInterval(() => {
      setSubcomponentNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
    queueMicrotask(() => { fetchAlerts(); });
  }, [fetchAlerts]);

  useEffect(() => {
    if (alerts.length > 0) {
      if (!alerts.some((a) => a.id === selectedAlertId)) {
        const firstId = alerts[0].id;
        requestAnimationFrame(() => {
          setSelectedAlertId(firstId);
        });
      }
    } else {
      requestAnimationFrame(() => {
        setSelectedAlertId(null);
      });
    }
  }, [alerts, selectedAlertId]);

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
      setSelectedAlertId(null);
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
            body: JSON.stringify({ alertId, resolution: bulkResolutionText.trim() || 'Bulk resolved by receiver', forceResolve: false }),
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
        body: JSON.stringify({ alertId, resolution: 'Resolved by receiver', forceResolve: false }),
      });
      const data = await res.json();
      if (res.status === 422 && data.dataIssue) {
        setResolveDataErrors(prev => ({ ...prev, [alertId]: data.error }));
      } else if (res.ok) {
        setExpandedId(null);
        setSelectedAlertId(null);
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
    const current = subcomponentNow || new Date(date).getTime();
    const diff = current - new Date(date).getTime();
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

  const renderAlertDetail = (alert: any) => {
    if (!alert) return null;
    const sopSteps = sopMap[alert.type] || [];
    return (
      <div className="space-y-4 text-left">
        <p className="text-xs text-slate-600 leading-relaxed text-left">
          {(() => {
            if (lang !== 'hi') return alert.description;
            let baseDesc = HINDI_ALERT_DESCRIPTIONS[alert.type]
              ? HINDI_ALERT_DESCRIPTIONS[alert.type]
                  .replace('{trackingId}', alert.manifest?.trackingId || alert.description.match(/\b\d{8,15}\b/)?.[0] || '')
                  .replace('{orderId}', alert.description.match(/Removal Order (\S+)/i)?.[1] || alert.manifest?.removalOrderId || '')
              : translateInstruction(alert.description, 'hi');
            if (alert.description.includes('Missing items:')) {
              const parts = alert.description.split('Missing items:');
              if (parts.length > 1) {
                const missingInfo = 'Missing items:' + parts[1];
                const translatedInfo = translateInstruction(missingInfo, 'hi');
                if (!baseDesc.includes(translatedInfo)) {
                  baseDesc = baseDesc + ' ' + translatedInfo;
                }
              }
            }
            return baseDesc;
          })()}
        </p>

        {editingSopType === alert.type ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">{lang === 'hi' ? 'समाधान चरण संपादित करें' : 'Edit Resolution Steps'}</h4>
              <div className="flex space-x-2">
                <button onClick={() => setEditingSopType(null)} className="text-[9px] uppercase font-bold text-slate-500">{lang === 'hi' ? 'रद्द' : 'Cancel'}</button>
                <button onClick={saveSop} disabled={savingSop} className="text-[9px] uppercase font-bold text-[#FF6700]">{savingSop ? (lang === 'hi' ? 'सेव हो रहा है...' : 'Saving...') : (lang === 'hi' ? 'सेव करें' : 'Save')}</button>
              </div>
            </div>
            {editingSopSteps.map((step, i) => (
              <div key={i} className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}.</span>
                <input value={step.instruction} onChange={e => { const u = [...editingSopSteps]; u[i] = { ...u[i], instruction: e.target.value }; setEditingSopSteps(u); }} className="flex-1 bg-white border border-slate-300 px-2 py-1 text-xs rounded focus:border-[#FF6700] focus:outline-none text-slate-950" placeholder="Step instruction..." />
                <button onClick={() => setEditingSopSteps(editingSopSteps.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={12} /></button>
              </div>
            ))}
            <button onClick={() => setEditingSopSteps([...editingSopSteps, { stepOrder: editingSopSteps.length + 1, instruction: '' }])} className="text-[9px] uppercase font-bold text-[#FF6700] tracking-widest">+ Add Step</button>
          </div>
        ) : sopSteps.length > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">{lang === 'hi' ? 'समाधान SOP' : 'Resolution SOP'}</h4>
              <button onClick={() => startEditSop(alert.type)} className="text-[9px] uppercase font-bold text-[#FF6700] flex items-center space-x-1"><Pencil size={9} /><span>{lang === 'hi' ? 'संपादित' : 'Edit'}</span></button>
            </div>
            <ol className="space-y-1.5 text-left">
              {sopSteps.map((step: any, i: number) => (
                <li key={step.id || i} className="flex items-start space-x-2">
                  <span className="shrink-0 w-5 h-5 bg-[#FF6700]/10 text-[#FF6700] rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  <p className="text-[11px] text-slate-700 leading-snug">{step.instruction}</p>
                </li>
              ))}
            </ol>
            {!alert.resolved && (
              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`sop-check-${alert.id}`}
                  checked={sopChecked}
                  onChange={(e) => setSopChecked(e.target.checked)}
                  className="w-4 h-4 accent-green-600 rounded cursor-pointer shrink-0"
                />
                <label htmlFor={`sop-check-${alert.id}`} className="text-[10px] font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                  {lang === 'hi' ? 'मैंने उपर दिए गए सभी SOP चरणों को पढ़ा और उनका पालन किया है' : 'I have read and followed all standard operating procedure steps above'}
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-1">{lang === 'hi' ? 'इस अलर्ट प्रकार के लिए कोई SOP कॉन्फ़िगर नहीं है।' : 'No SOP configured.'}</p>
            <button onClick={() => startEditSop(alert.type)} className="text-[9px] uppercase font-bold text-[#FF6700] tracking-widest">+ Create SOP Steps</button>
          </div>
        )}

        {!alert.resolved && (
          <div className="space-y-2 text-left">
            <div className="flex flex-col space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <input
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  placeholder={t("RESOLVE NOTES (REQUIRED)")}
                  className="flex-1 bg-white border border-slate-300 px-3 py-1.5 text-xs rounded focus:border-[#FF6700] focus:outline-none text-slate-950"
                />
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolving || !sopChecked || !resolutionText.trim()}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors shadow-sm shrink-0"
                >
                  {resolving ? '···' : t("Confirm")}
                </button>
              </div>
              {!sopChecked && (
                <p className="text-[8px] text-amber-600 font-bold uppercase tracking-wider">
                  {lang === 'hi' ? 'समाधान से पहले आपको उपर दिए गए SOP चरणों को मानना आवश्यक है।' : 'You must check "I have read and followed all standard operating procedure steps above" before resolving.'}
                </p>
              )}
            </div>
            {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
          </div>
        )}

        {alert.resolved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
            <p className="text-[9px] font-bold uppercase tracking-widest text-green-700 mb-1">{lang === 'hi' ? 'समाधानित' : 'Resolved'}</p>
            <p className="text-xs text-green-800">{alert.resolution || 'No notes'}</p>
            <p className="text-[8px] text-green-600 mt-2">By: {alert.resolvedBy?.name || alert.resolvedBy?.email || 'System'} • {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full bg-slate-50">
      {/* Header section */}
      <div className="shrink-0 p-4 lg:p-6 border-b border-[#313079]/10 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm text-left">
        <div>
          <h2 className="text-sm lg:text-base font-black uppercase tracking-widest text-[#313079]">
            {t("Active Alerts")}
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            {t("Operational discrepancies and escalation warnings requiring attention.")}
          </p>
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`px-3 py-1.5 text-[9px] uppercase font-bold tracking-widest border rounded transition-colors self-start sm:self-auto ${
            showResolved ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF6700] hover:text-[#FF6700]'
          }`}
        >
          {showResolved ? (lang === 'hi' ? 'सक्रिय दिखाएं' : 'Show Active') : (lang === 'hi' ? 'समाधानित दिखाएं' : 'Show Resolved')}
        </button>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[#313079]/5 bg-white">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF6700]/15 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700]">
              <Activity size={18} />
            </div>
            <div className="text-left">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                {t("SOP Compliance Score")}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {t("Real-time daily adherence stack")}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-center">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {t("Resolved Today")}
              </p>
              <p className="text-lg font-mono font-black text-white mt-0.5">
                {stats.resolvedToday}
              </p>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {t("SOP Followed")}
              </p>
              <p className="text-lg font-mono font-black text-green-400 mt-0.5">
                {stats.sopFollowedToday}
              </p>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {t("Adherence Rate")}
              </p>
              <p
                className={`text-lg font-mono font-black mt-0.5 ${stats.adherenceRate >= 90 ? "text-green-400" : stats.adherenceRate >= 75 ? "text-amber-400" : "text-red-400"}`}
              >
                {stats.adherenceRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions and severity grid (active alerts only) */}
      {!showResolved && alerts.length > 0 && (
        <div className="shrink-0 p-4 border-b border-[#313079]/5 bg-white text-left">
          {/* Bulk select bar */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {selectedIds.size > 0 ? (
              <>
                <span className="text-[10px] font-black text-[#FF6700] shrink-0">
                  {selectedIds.size} / {alerts.length} selected
                </span>
                <input
                  value={bulkResolutionText}
                  onChange={e => setBulkResolutionText(e.target.value)}
                  placeholder="Bulk resolution note (optional)..."
                  className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs rounded focus:border-[#FF6700] focus:outline-none text-slate-900"
                />
                <button
                  onClick={handleBulkResolve}
                  disabled={bulkResolving}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest rounded transition-colors shadow-sm shrink-0"
                >
                  {bulkResolving ? '···' : `✓ ${t("Resolve")} ${selectedIds.size}`}
                </button>
                <button
                  onClick={selectNone}
                  className="px-2 py-1 border border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-widest rounded hover:border-slate-300 transition-colors shrink-0"
                >
                  {lang === 'hi' ? 'सभी चयन हटाएं' : 'Deselect All'}
                </button>
              </>
            ) : (
              <>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{lang === 'hi' ? 'बल्क चयन:' : 'Bulk Select:'}</span>
                <button
                  onClick={() => selectNext10()}
                  className="px-2 py-1 border border-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  + 10 Alerts
                </button>
                <button
                  onClick={selectAll}
                  className="px-2 py-1 border border-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  Select All ({alerts.length})
                </button>
              </>
            )}
          </div>

          {/* Severity Counts grid */}
          <div className="grid grid-cols-4 gap-2">
            {(['L1', 'L2', 'L3', 'L4'] as const).map(level => {
              const cfg = LEVEL_CONFIG[level];
              return (
                <div key={level} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg p-2.5 flex items-center justify-between shadow-xs`}>
                  <div>
                    <p className={`text-lg font-mono font-black leading-none ${cfg.color}`}>{counts[level] || 0}</p>
                    <p className={`text-[8px] uppercase tracking-widest font-black ${cfg.color} mt-1`}>{getSeverityLabel(level)}</p>
                  </div>
                  <div className="shrink-0">{cfg.icon}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main split-pane content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: List of Alerts */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-[#313079]/10 bg-white flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading && alerts.length === 0 ? (
              <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">
                {t("Syncing Alerts...")}
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-xl">
                <CheckCircle2
                  size={48}
                  className="mx-auto text-green-500 mb-4 opacity-50"
                />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">
                  {showResolved ? (lang === 'hi' ? 'कोई समाधानित अलर्ट नहीं' : 'No resolved alerts') : (lang === 'hi' ? 'सब ठीक है' : 'All Clear')}
                </h3>
              </div>
            ) : (
              alerts.map((alert) => {
                const isSelected = selectedAlertId === alert.id;
                const isExpanded = expandedId === alert.id;
                const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.L1;
                return (
                  <div
                    key={alert.id}
                    className={`bg-white border rounded-xl shadow-sm transition-all relative overflow-hidden flex flex-col cursor-pointer ${
                      isSelected
                        ? "border-[#FF6700] ring-2 ring-[#FF6700]/10 bg-orange-50/5"
                        : `${cfg.borderColor} hover:border-[#FF6700]/50`
                    }`}
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      setExpandedId(isExpanded ? null : alert.id);
                      setResolutionText("");
                      setResolveError("");
                      setSopChecked(false);
                    }}
                  >
                    <div className="flex items-stretch">
                      {/* Checkbox for bulk resolve (active only) */}
                      {!showResolved && (
                        <div
                          className="flex items-center pl-3 pr-1.5 shrink-0 border-r border-black/5"
                          onClick={e => { e.stopPropagation(); toggleSelect(alert.id); }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(alert.id)}
                            onChange={() => toggleSelect(alert.id)}
                            className="w-3.5 h-3.5 cursor-pointer accent-[#FF6700] rounded"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      )}

                      {/* Header block */}
                      <div className="flex-1 flex justify-between items-start p-3 pl-4 text-left">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${cfg.color}`}>{getSeverityLabel(alert.level)}</span>
                            {alert.resolved && <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">RESOLVED</span>}
                          </div>
                          <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">
                            {alert.title}
                          </h4>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <span className="text-[9px] text-slate-400 font-bold">{timeAgo(alert.createdAt)}</span>
                          <ChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform lg:hidden ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Quick Resolve Button */}
                      {!alert.resolved && !showResolved && (
                        <div
                          className="flex items-center px-2.5 shrink-0 border-l border-black/5"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleQuickResolve(alert.id)}
                            disabled={quickResolvingId === alert.id}
                            className="text-[9px] font-black uppercase text-green-600 hover:text-green-800 disabled:opacity-50 border border-green-200 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded transition-all whitespace-nowrap"
                          >
                            {quickResolvingId === alert.id ? '···' : (lang === 'hi' ? '✓ समाधान' : '✓ Resolve')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Data error checking inline */}
                    {resolveDataErrors[alert.id] && (
                      <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-1.5 text-left" onClick={e => e.stopPropagation()}>
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 shrink-0">⚠ Data Check:</span>
                        <p className="text-[9px] text-amber-700 flex-1 leading-snug">{resolveDataErrors[alert.id]}</p>
                        <button
                          onClick={() => setResolveDataErrors(prev => { const next = { ...prev }; delete next[alert.id]; return next; })}
                          className="text-amber-400 hover:text-amber-600 shrink-0"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}

                    {/* Mobile inline detail (Accordion style) */}
                    <div className="lg:hidden" onClick={(e) => e.stopPropagation()}>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                          {renderAlertDetail(alert)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Desktop Detail Viewer (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 flex-col h-full bg-slate-50/50 overflow-hidden">
          {selectedAlertId ? (
            (() => {
              const selectedAlert = alerts.find((a) => a.id === selectedAlertId);
              if (!selectedAlert) return null;
              return (
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                  <div className="bg-white p-6 border-b border-[#313079]/10 text-left shrink-0">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded bg-red-100 text-red-700">
                      {selectedAlert.level} - {selectedAlert.type}
                    </span>
                    <h3 className="text-base font-black text-[#313079] mt-2">
                      {selectedAlert.title}
                    </h3>
                    {selectedAlert.manifest?.trackingId && (
                      <div className="mt-2 text-xs font-mono text-slate-500 bg-slate-100 inline-block px-2.5 py-1 rounded border border-slate-200 uppercase">
                        AWB: {selectedAlert.manifest.trackingId}
                      </div>
                    )}
                  </div>
                  {resolveDataErrors[selectedAlert.id] && (
                    <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-left">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0">⚠ Data Check:</span>
                      <p className="text-[10px] text-amber-700 flex-1 leading-snug">{resolveDataErrors[selectedAlert.id]}</p>
                      <button
                        onClick={() => setResolveDataErrors(prev => { const next = { ...prev }; delete next[selectedAlert.id]; return next; })}
                        className="text-amber-400 hover:text-amber-600 shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                    {renderAlertDetail(selectedAlert)}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bell size={24} className="text-slate-400" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {t("Select an alert to view resolution guidelines")}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-normal">
                {t("Click on any warning card in the left sidebar to execute Standard Operating Procedure (SOP) validations.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ id, icon, label, activeTab, setActive, badge, isMinimized = false }: any) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActive(id)}
      title={label}
      className={`w-full flex items-center ${
        isMinimized ? "justify-center" : "justify-between"
      } px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
        isActive
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? 'text-[#FFF700]' : 'text-[#FF6700]/70 shrink-0'}>{icon}</span>
        {!isMinimized && <span className="truncate">{label}</span>}
      </div>
      {!isMinimized && badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {isMinimized && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-black" />
      )}
    </button>
  );
}
