"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  ChevronDown,
  AlertOctagon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  Pencil,
  Info,
  ShieldAlert,
  Home,
  Box,
} from "lucide-react";
import LanguagePreference from "@/app/components/LanguagePreference";
import { getStoredLanguage, translateInstruction } from "@/lib/i18n";
import LogoutConfirmModal from "@/app/components/LogoutConfirmModal";

interface QcAgentDashboardProps {
  userId: string;
  role: string;
  name: string;
  email: string;
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

export default function QcAgentDashboard({
  userId,
  role,
  name,
  email,
}: QcAgentDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "qcaudit" | "alerts" | "profile">("home");
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const t = (text: string) => translateInstruction(text, preferredLanguage);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const minimized = localStorage.getItem("isSidebarMinimized") === "true";
      requestAnimationFrame(() => {
        setIsSidebarMinimized(minimized);
      });
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

  // Fetch active alerts count periodically
  useEffect(() => {
    const fetchAlertCount = () => {
      fetch("/api/alerts?resolved=false&dashboard=true")
        .then((r) => r.json())
        .then((d) => {
          if (d.alerts) {
            setAlertCount(d.alerts.length);
          }
        })
        .catch(console.error);
    };

    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem("userRole");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
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

  const claimsUrl = process.env.NEXT_PUBLIC_CLAIMS_PROCESS_URL || "http://localhost:5000";

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
            <CheckSquare className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[120px]" title={name}>
              {preferredLanguage === 'hi' ? 'क्यूसी एजेंट' : 'QC Agent'}
            </h1>
            <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">
              {role.replace(/_/g, ' ')}
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
              <CheckSquare className="text-white" size={16} />
            </div>
            {!isSidebarMinimized && (
              <div className="text-left animate-in fade-in duration-200">
                <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none">
                  {preferredLanguage === 'hi' ? 'क्यूसी एजेंट' : 'QC AGENT'}
                </h1>
              </div>
            )}
          </div>
          {/* Collapse toggle (only desktop) */}
          <button
            onClick={() => {
              setIsSidebarMinimized((prev) => {
                const next = !prev;
                localStorage.setItem("isSidebarMinimized", String(next));
                return next;
              });
            }}
            className="hidden lg:block text-white/50 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
            title={
              isSidebarMinimized
                ? preferredLanguage === 'hi' ? 'नेविगेशन विस्तृत करें' : 'Expand Sidebar'
                : preferredLanguage === 'hi' ? 'नेविगेशन छोटा करें' : 'Collapse Sidebar'
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
            label={preferredLanguage === 'hi' ? 'होम' : 'Home'} 
            activeTab={activeTab} 
            setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
            isMinimized={isSidebarMinimized} 
          />
          <TabButton 
            id="qcaudit" 
            icon={<CheckSquare size={14} />} 
            label={preferredLanguage === 'hi' ? 'क्यूसी ऑडिट' : 'QC Audit'} 
            activeTab={activeTab} 
            setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
            isMinimized={isSidebarMinimized} 
          />
          <TabButton 
            id="alerts" 
            icon={<Bell size={14} />} 
            label={preferredLanguage === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'} 
            activeTab={activeTab} 
            setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
            badge={alertCount > 0 ? alertCount : undefined}
            isMinimized={isSidebarMinimized} 
          />
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-4 border-t border-white/10 shrink-0 ${isSidebarMinimized ? 'flex flex-col items-center space-y-4' : 'space-y-3'}`}>
          {!isSidebarMinimized && (role === 'ADMIN' || role === 'SUPER_ACCESS') && (
            <div className="flex flex-col space-y-1.5 px-2 w-full animate-in fade-in duration-200">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                {preferredLanguage === 'hi' ? 'भूमिका बदलें' : 'Switch Role'}
              </label>
              <div className="relative">
                <select
                  value={typeof window !== 'undefined' ? (localStorage.getItem('userRole') || 'QC_AGENT') : 'QC_AGENT'}
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
                    {preferredLanguage === 'hi' ? 'सुपर एक्सेस' : 'Super Access'}
                  </option>
                  <option value="ADMIN" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'एडमिन' : 'Admin'}
                  </option>
                  <option value="RECEIVER" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'रिसीवर' : 'Receiver'}
                  </option>
                  <option value="INSPECTOR" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'इंस्पेक्टर' : 'Inspector'}
                  </option>
                  <option value="CLAIMS_SPECIALIST" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'क्लेम्स स्पेशलिस्ट' : 'Claims Specialist'}
                  </option>
                  <option value="RECOVERER" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'रिकवरर' : 'Recoverer'}
                  </option>
                  <option value="QC_AGENT" className="bg-[#1e1d4b] text-white">
                    {preferredLanguage === 'hi' ? 'क्यूसी एजेंट' : 'QC Agent'}
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/60">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          )}
          
          {!isSidebarMinimized && (role === 'ADMIN' || role === 'SUPER_ACCESS') && <div className="h-px bg-white/10 w-full"></div>}

          {/* Profile Section */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center ${isSidebarMinimized ? 'justify-center' : 'space-x-3 px-3'} py-2.5 rounded-lg hover:bg-white/10 transition-colors group text-left ${activeTab === 'profile' ? 'bg-white/10 font-bold text-white' : 'text-white/70'}`}
            title={preferredLanguage === 'hi' ? 'प्रोफ़ाइल देखें' : 'View Profile'}
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black">
              {name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "QC"}
            </div>
            {!isSidebarMinimized && (
              <div className="min-w-0 flex-1 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-white leading-tight break-words">{name}</p>
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
            title={preferredLanguage === 'hi' ? 'लॉगआउट' : 'Logout'}
          >
            {isSidebarMinimized ? <LogOut size={16} /> : preferredLanguage === 'hi' ? 'लॉगआउट' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className={`flex-1 flex flex-col min-w-0 ${activeTab === 'qcaudit' || activeTab === 'alerts' ? 'overflow-hidden p-0 bg-slate-50' : 'overflow-y-auto p-6 bg-[#FF6700]/5'}`}>
        {activeTab === "home" && (
          <div className="max-w-4xl mx-auto space-y-6 pt-10 px-6 pb-10 text-left w-full animate-in fade-in duration-300">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-2xl p-8 relative overflow-hidden shadow-xl">
              <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
                <CheckSquare size={250} />
              </div>
              <div className="relative z-10 space-y-4">
                <span className="px-3 py-1 bg-[#FF6700]/20 text-[#FF6700] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#FF6700]/30 animate-pulse">
                  {preferredLanguage === 'hi' ? 'गुणवत्ता नियंत्रण' : 'Quality Control'}
                </span>
                <h1 className="text-3xl md:text-4xl font-black tracking-wide uppercase leading-tight text-white">
                  {preferredLanguage === 'hi' ? 'क्यूसी एजेंट वर्कस्पेस' : 'QC Agent Workspace'}
                </h1>
                <p className="text-slate-300 text-sm max-w-xl leading-relaxed uppercase tracking-wider font-bold">
                  {preferredLanguage === 'hi'
                    ? 'डैशबोर्ड में आपका स्वागत है। यहाँ से गुणवत्ता ऑडिट करें, विसंगति समीक्षा करें, और सक्रिय अलर्ट प्रबंधित करें।'
                    : 'Welcome to your dashboard. Execute quality audits, review discrepancies, and manage active operational alerts.'}
                </p>
              </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-[#FF6700]/10 rounded-lg flex items-center justify-center text-[#FF6700] group-hover:scale-110 transition-transform">
                    <CheckSquare size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase text-[#313079]">
                    {preferredLanguage === 'hi' ? 'क्यूसी ऑडिट' : 'QC Audit'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-normal font-medium">
                    {preferredLanguage === 'hi'
                      ? 'निरीक्षित SKU की गुणवत्ता को स्वीकृत या अस्वीकृत करें और ऑडिट पूरा करें।'
                      : 'Audit inspected SKUs, approve sellable inventory, or verify damaged items.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("qcaudit")}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors"
                >
                  {preferredLanguage === 'hi' ? 'ऑडिट पर जाएं' : 'Go to QC Audit'}
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                    <Bell size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase text-[#313079]">
                    {preferredLanguage === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-normal font-medium">
                    {preferredLanguage === 'hi'
                      ? 'परिचालन में देरी, कूरियर स्टेटस विसंगतियों और एस्केलेशन की समीक्षा करें।'
                      : 'Review operational delays, delivery status breaches, and workflow escalations.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("alerts")}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{preferredLanguage === 'hi' ? 'अलर्ट देखें' : 'View Alerts'}</span>
                  {alertCount > 0 && (
                    <span className="bg-red-500 text-white font-mono px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 animate-pulse">
                      {alertCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <User size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase text-[#313079]">
                    {preferredLanguage === 'hi' ? 'प्रोफ़ाइल' : 'Profile Settings'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-normal font-medium">
                    {preferredLanguage === 'hi'
                      ? 'अपने खाते के क्रेडेंशियल, सिस्टम सेटिंग्स और भाषा प्राथमिकताओं को देखें।'
                      : 'Review user login details, role settings, and language localization preferences.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("profile")}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#313079] text-xs font-black uppercase tracking-wider rounded-lg transition-colors"
                >
                  {preferredLanguage === 'hi' ? 'सेटिंग्स प्रबंधित करें' : 'Manage Settings'}
                </button>
              </div>
            </div>

            {/* Status Board */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#313079]/50">
                  {preferredLanguage === 'hi' ? 'ऑपरेशन्स मेट्रिक्स' : 'Operations Metrics'}
                </h4>
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    {preferredLanguage === 'hi' ? 'लंबित क्यूसी' : 'Pending QC'}
                  </p>
                  <p className="text-2xl font-black font-mono text-[#313079] mt-1">0</p>
                </div>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    {preferredLanguage === 'hi' ? 'आज स्वीकृत' : 'Approved Today'}
                  </p>
                  <p className="text-2xl font-black font-mono text-green-600 mt-1">0</p>
                </div>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    {preferredLanguage === 'hi' ? 'आज अस्वीकृत' : 'Rejected Today'}
                  </p>
                  <p className="text-2xl font-black font-mono text-[#FF6700] mt-1">0</p>
                </div>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    {preferredLanguage === 'hi' ? 'सक्रिय अलर्ट' : 'Active Alerts'}
                  </p>
                  <p className="text-2xl font-black font-mono text-red-600 mt-1">{alertCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "qcaudit" && (
          <iframe
            src={`${claimsUrl}/qcaudittab?lang=${preferredLanguage}`}
            className="w-full h-full border-none animate-in fade-in duration-300"
            title="QC Audit"
          />
        )}

        {activeTab === "alerts" && (
          <AlertsTab preferredLanguage={preferredLanguage} />
        )}

        {activeTab === "profile" && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-4 pb-10 animate-in fade-in duration-300">
            {/* Profile Card */}
            <div className="bg-white border border-[#313079]/10 overflow-hidden rounded-2xl shadow-md">
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-black to-slate-900 p-8 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Box size={100} className="text-white" />
                </div>
                <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
                  {name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "QC"}
                </div>
                <h2 className="text-xl font-black text-white">
                  {name}
                </h2>
                <p className="text-slate-400 text-xs font-mono mt-1">{email}</p>
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
                  {role.replace(/_/g, " ")}
                </span>
              </div>

              {/* Details */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {preferredLanguage === 'hi' ? 'ईमेल पता' : 'Email Address'}
                    </label>
                    <p className="text-sm font-bold text-[#313079] mt-1">{email}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {preferredLanguage === 'hi' ? 'भूमिका' : 'Role'}
                    </label>
                    <p className="text-sm font-bold text-[#313079] mt-1">{role}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {preferredLanguage === 'hi' ? 'उपयोगकर्ता आईडी' : 'User ID'}
                    </label>
                    <p className="text-sm font-bold text-[#313079] mt-1 font-mono">{userId}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {preferredLanguage === 'hi' ? 'भाषा पसंद' : 'Language Preference'}
                    </label>
                    <LanguagePreference compact />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-medium pt-3 border-t border-slate-100 mt-4">
                  {preferredLanguage === 'hi' ? 'प्रोफ़ाइल केवल पढ़ने योग्य है · विवरण अपडेट करने के लिए एडमिन से संपर्क करें।' : 'Profile is read-only · Contact Admin to update details.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-4 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              {preferredLanguage === 'hi' ? 'लॉगआउट' : 'Logout'}
            </button>
          </div>
        )}
      </main>
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
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold animate-in fade-in duration-200'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? 'text-[#FFF700] font-bold' : 'text-[#FF6700]/70 shrink-0'}>{icon}</span>
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

// ─── Alerts Tab Sub-Component ────────────────────────────────────────────────
function AlertsTab({ preferredLanguage: propLanguage = "en" }: { preferredLanguage?: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [preferredLanguage, setPreferredLanguage] = useState(() => propLanguage);
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const t = (text: string) => translateInstruction(text, preferredLanguage as any);

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
    if (propLanguage) {
      requestAnimationFrame(() => {
        setPreferredLanguage(propLanguage);
      });
    }
  }, [propLanguage]);

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
            body: JSON.stringify({ alertId, resolution: bulkResolutionText.trim() || 'Bulk resolved by specialist', forceResolve: false }),
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
        body: JSON.stringify({ alertId, resolution: 'Resolved by specialist', forceResolve: false }),
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
    const current = now || new Date(date).getTime();
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

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
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
                        <p className="text-xs text-slate-400 mb-2">{lang === 'hi' ? 'इस अलर्ट प्रकार के लिए कोई SOP कॉन्फ़िगर नहीं है।' : 'No SOP configured.'}</p>
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
