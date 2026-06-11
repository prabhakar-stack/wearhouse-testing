"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, PackageSearch, FileWarning, Pencil, Search, Clock, Save, X, ExternalLink, Activity, Bell, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Info, CheckCircle2, Menu, User, Shield, Package, TrendingUp, Calendar, Trash2 } from 'lucide-react';
import Link from 'next/link';
import LanguagePreference from '@/app/components/LanguagePreference';
import { getStoredLanguage, translateInstruction, PreferredLanguage } from '@/lib/i18n';

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
  RO_DISPATCH_BREACH_5D: "रिमूवल ORDER {orderId} के लिए अनुरोध भेजा गया था लेकिन Amazon ने 5 दिनों के बाद भी इस शिपमेंट को डिस्पैच नहीं किया है। रिम्बर्समेंट विंडो ~9 दिनों में बंद हो जाएगी।",
  RO_DISPATCH_BREACH_10D: "रिमूवल ऑर्डर {orderId} के लिए अनुरोध भेजा गया था लेकिन 10 दिनों के बाद भी कोई डिस्पैच नहीं हुआ है। Amazon रिम्बर्समेंट विंडो ~4-5 दिनों में बंद हो जाएगी। तत्काल कार्रवाई आवश्यक है।",
  RO_TRACKING_NO_ASSIGNED: "रिमूवल ऑर्डर {orderId} का Amazon डेटा में शिपमेंट रिकॉर्ड है लेकिन कोई ट्रैकिंग नंबर असाइन नहीं किया गया है।"
};

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ user, onClose, preferredLanguage }: { user: { name: string; email: string; role: string }; onClose: () => void; preferredLanguage: PreferredLanguage }) {
  const [profile, setProfile] = useState<any>(null);
  const t = (text: string) => translateInstruction(text, preferredLanguage);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(d => {
      if (d.user) setProfile(d.user);
    }).catch(() => {});
  }, []);

  const roleLabel = user.role.replace(/_/g, ' ');
  const roleColors: Record<string, string> = {
    SUPER_ACCESS: 'bg-black text-[#FF6700] border-black',
    ADMIN: 'bg-slate-50 text-[#313079] border-slate-200',
    RECEIVER: 'bg-[#FF6700]/5 text-[#FF6700] border-[#FF6700]/10',
    INSPECTOR: 'bg-[#FF6700]/5 text-[#FF6700] border-[#FF6700]/10',
  };

  const resolvedName = profile?.name || (user.name !== user.email ? user.name : '') || user.email;
  const isEmail = resolvedName.includes('@');
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-black to-slate-900 p-8 text-white relative border-b border-black/10">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
            {initials}
          </div>
          <h2 className="text-xl font-black text-white">{resolvedName}</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-mono">{user.email}</p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
            {t(roleLabel)}
          </span>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4 bg-[#FF6700]/5 border-t border-[#313079]/5">
          {profile ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-[#FF6700]/10 shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package size={14} className="text-[#FF6700]" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">{t("Items Processed")}</p>
                  </div>
                  <p className="text-2xl font-black text-[#313079] font-mono">{profile.itemsProcessed ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp size={14} className="text-green-500" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">{t("Accuracy Rate")}</p>
                  </div>
                  <p className="text-2xl font-black text-green-600 font-mono">{profile.accuracyRate?.toFixed(1) ?? '100.0'}%</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar size={14} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">{t("Member Since")}</p>
                </div>
                <p className="text-sm font-bold text-[#313079]">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs uppercase tracking-widest animate-pulse">{t("Loading profile...")}</div>
          )}

          <LanguagePreference />

          <div className="h-px bg-[#313079]/10" />
          <p className="text-[10px] text-slate-400 text-center font-medium">
            {t("Profile is read-only. Contact Super Admin to update details.")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard({ role, name, email, userId }: { role: string; name: string; email: string; userId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'claims' | 'alerts' | 'triage' | 'smart-filing' | 'recovery' | 'qc'>('alerts');
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
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
  
  const userRoleLower = role?.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const isAdminOrSuper = userRoleLower === 'admin' || userRoleLower === 'super access' || userRoleLower === 'super_access' || userRoleLower === 'super-access';
  const canAccessTriage = userRoleLower === 'claims specialist' || isAdminOrSuper;
  const canAccessSmartFiling = userRoleLower === 'claims specialist' || isAdminOrSuper;
  const canAccessRecovery = userRoleLower === 'recoverer' || isAdminOrSuper;
  const canAccessQC = userRoleLower === 'qc agent' || userRoleLower === 'qcagent' || isAdminOrSuper;
  const [alertCount, setAlertCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [activeSopAlertId, setActiveSopAlertId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [selectedRole, setSelectedRole] = useState(role);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userRole');
      if (stored) {
        setSelectedRole(stored);
      }
    }
  }, []);

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUserData(d.user); })
      .catch(() => {});
  }, []);

  const displayName = userData?.name || (name !== email ? name : '') || 'Admin';
  const isEmail = displayName.includes('@');
  const initials = isEmail
    ? displayName.slice(0, 2).toUpperCase()
    : displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const fetchAlerts = useCallback(() => {
    fetch('/api/alerts', {
      headers: { 'x-user-language': preferredLanguage }
    })
      .then(r => r.json())
      .then(d => {
        if (d.alerts) {
          setAlerts(d.alerts);
          setAlertCount(d.alerts.length);
        }
        if (d.sopMap) setSopMap(d.sopMap);
      })
      .catch(() => {});
  }, [preferredLanguage]);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const handleResolveAlert = async (alertId: string) => {
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
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative">

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={{ name: displayName, email, role }}
          onClose={() => setShowProfile(false)}
          preferredLanguage={preferredLanguage}
        />
      )}

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
                return (
                  <div key={alert.id} className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-1 relative pl-4 text-left">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                          {(() => {
                            if (lang === 'hi') {
                              if (alert.level === 'L4') return 'गंभीर';
                              if (alert.level === 'L3') return 'उच्च';
                              if (alert.level === 'L2') return 'मध्यम';
                              if (alert.level === 'L1') return 'निम्न';
                              return alert.level;
                            } else {
                              if (alert.level === 'L4') return 'CRITICAL';
                              if (alert.level === 'L3') return 'HIGH';
                              if (alert.level === 'L2') return 'MEDIUM';
                              if (alert.level === 'L1') return 'LOW';
                              return alert.level;
                            }
                          })()} - {alert.type}
                        </span>
                        <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                          {lang === 'hi' ? (
                            HINDI_ALERT_DESCRIPTIONS[alert.type]
                              ? HINDI_ALERT_DESCRIPTIONS[alert.type]
                                  .replace('{trackingId}', alert.manifest?.trackingId || alert.description.match(/\b\d{8,15}\b/)?.[0] || '')
                                  .replace('{orderId}', alert.description.match(/Removal Order (\S+)/i)?.[1] || alert.manifest?.removalOrderId || '')
                              : translateInstruction(alert.description, 'hi')
                          ) : alert.description}
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
        className={`fixed inset-y-0 left-0 z-50 lg:z-20 w-64 bg-black text-white flex flex-col border-r border-black/10 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <ShieldAlert className="text-white" size={16} />
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
          <TabButton id="users"    icon={<Users size={14} />}       label="Users"    activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          <TabButton id="alerts"   icon={<Bell size={14} />}        label="Alerts"   activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={alertCount > 0 ? alertCount : undefined} />
          <TabButton id="claims"   icon={<FileWarning size={14} />} label="Claims"   activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          {canAccessTriage && (
            <TabButton id="triage" icon={<FileWarning size={14} />} label="Claims Triage" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessSmartFiling && (
            <TabButton id="smart-filing" icon={<Activity size={14} />} label="Smart Filing Monitor" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessRecovery && (
            <TabButton id="recovery" icon={<PackageSearch size={14} />} label="Recovery Hub" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessQC && (
            <TabButton id="qc" icon={<CheckCircle2 size={14} />} label="QC Audit" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3">
          <div className="flex flex-col space-y-1.5 px-2">
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
              {lang === 'hi' ? 'भूमिका बदलें' : 'Switch Role'}
            </label>
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRole(val);
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
            onClick={async () => {
              localStorage.removeItem("userRole");
              try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
              router.push('/login');
            }}
            className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md"
          >
            {lang === 'hi' ? 'लॉगआउट' : 'Logout'}
          </button>
        </div>
      </aside>
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'users'    && <UsersTab role={role} currentUserId={userId} />}
            {activeTab === 'alerts'   && <AlertsTab userRole={role} />}
            {activeTab === 'claims'   && <ClaimsTab />}
            {(() => {
              const claimsUrl = process.env.NEXT_PUBLIC_CLAIMS_PROCESS_URL || "http://localhost:5000";
              return (
                <>
                  {activeTab === 'triage' && canAccessTriage && (
                    <iframe src={`${claimsUrl}/triage?embed=true&lang=${preferredLanguage}`} className="w-full h-screen border-none" />
                  )}
                  {activeTab === 'smart-filing' && canAccessSmartFiling && (
                    <iframe src={`${claimsUrl}/smartfiling?embed=true&lang=${preferredLanguage}`} className="w-full h-screen border-none" />
                  )}
                  {activeTab === 'recovery' && canAccessRecovery && (
                    <iframe src={`${claimsUrl}/recoveryhubtab?embed=true&lang=${preferredLanguage}`} className="w-full h-screen border-none" />
                  )}
                  {activeTab === 'qc' && canAccessQC && (
                    <iframe src={`${claimsUrl}/qcaudittab?embed=true&lang=${preferredLanguage}`} className="w-full h-screen border-none" />
                  )}
                </>
              );
            })()}

        </div>
      </main>

    </div>
  );
}

// --- TABS COMPONENTS ---

function TabButton({ id, icon, label, activeTab, setActive, badge }: any) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActive(id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
        isActive
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? 'text-[#FFF700]' : 'text-[#FF6700]/70'}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function UsersTab({ role, currentUserId }: { role: string; currentUserId?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('RECEIVER');
  const [showCreateBlock, setShowCreateBlock] = useState(false);
  const createBlockRef = useRef<HTMLDivElement>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('RECEIVER');
  const [editItemsProcessed, setEditItemsProcessed] = useState(0);
  const [editAccuracyRate, setEditAccuracyRate] = useState(100.0);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [updating, setUpdating] = useState(false);

  const availableRoles = ['RECEIVER', 'INSPECTOR','CLAIMS_SPECIALIST','RECOVERER','QC_AGENT'];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => { fetchUsers(); }); }, []);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'RECEIVER');
    setEditItemsProcessed(user.itemsProcessed || 0);
    setEditAccuracyRate(user.accuracyRate ?? 100.0);
    setEditError('');
    setEditSuccess('');
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setEditError(''); setEditSuccess('');
    setUpdating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          name: editName,
          email: editEmail,
          role: editRole,
          itemsProcessed: editItemsProcessed,
          accuracyRate: editAccuracyRate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditSuccess('User updated successfully.');
      setTimeout(() => setEditingUser(null), 1000);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleCreateBlock = () => {
    setError('');
    setSuccess('');
    setShowCreateBlock(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          createBlockRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      return next;
    });
  };

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role: targetRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User created successfully.');
      setEmail(''); setName('');
      setTimeout(() => setShowCreateBlock(false), 1000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = (user: any) => {
    setError(''); setSuccess('');
    setDeletingUser(user);
    setDeleteConfirmEmail('');
  };

  const confirmDelete = async (id: string) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User deleted successfully.');
      setTimeout(() => {
        setDeletingUser(null);
        setDeleteConfirmEmail('');
      }, 1000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-8 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-end shrink-0 border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">User Management</h2>
           <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Manage personnel access and roles.</p>
        </div>
        <button 
          onClick={handleToggleCreateBlock} 
          className="bg-black hover:bg-[#FF6700] hover:text-white text-[#FF6700] border border-[#FF6700] px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <span>+ Authorize Personnel</span>
        </button>
      </div>

      <div className="w-full border border-slate-200 bg-white overflow-hidden flex flex-col rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700">Active Personnel Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium text-right">Items Proc.</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading directory...</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-[10px] font-black shrink-0">
                        {(user.name || user.email).slice(0, 2).toUpperCase()}
                      </div>
                      <span>{user.name || <span className="text-slate-400 italic text-xs">No name</span>}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="bg-[#FF6700]/5 border border-[#FF6700]/10 px-2 py-1 text-[10px] tracking-wide uppercase text-[#FF6700] font-bold rounded-sm">
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs">{user.itemsProcessed}</td>
                  <td className="px-6 py-4 text-right font-mono text-xs">
                    <div className="flex justify-end items-center space-x-2">
                      {user.id !== currentUserId && (user.role === 'RECEIVER' || user.role === 'INSPECTOR') && (
                        <button 
                          onClick={() => openEditModal(user)} 
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm"
                        >
                          <Pencil size={11} />
                          <span>Edit</span>
                        </button>
                      )}
                      {user.id !== currentUserId && (user.role === 'RECEIVER' || user.role === 'INSPECTOR') && (
                        <button 
                          onClick={() => handleDelete(user)} 
                          className="flex items-center justify-center w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm"
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">No active personnel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Premium Authorize Personnel Block (Shifted to the bottom) */}
      {showCreateBlock && (
        <div 
          ref={createBlockRef}
          className="w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom duration-300 shrink-0"
        >
          <div className="bg-gradient-to-br from-black to-slate-900 p-6 text-white flex justify-between items-center border-b border-black/10">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#FF6700]">Authorize Personnel</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Grant system access and permissions</p>
            </div>
            <button onClick={() => setShowCreateBlock(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. employee@company.com"
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Role</label>
                <select value={targetRole} onChange={e => setTargetRole(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                  {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            {success && <p className="text-xs text-green-600 font-medium">{success}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setShowCreateBlock(false)} className="border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-white px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded shadow-sm transition-colors">
                Grant Access
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Premium Edit User Dialog (Restricted to RECEIVER & INSPECTOR for Admin) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-black to-slate-900 p-6 text-white flex justify-between items-center border-b border-black/10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#FF6700]">Edit Personnel</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Modifying {editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={editEmail} onChange={e => setEditEmail(e.target.value)} 
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} 
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                  {['RECEIVER', 'INSPECTOR'].map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Items Processed</label>
                  <input type="number" min="0" required value={editItemsProcessed} onChange={e => setEditItemsProcessed(parseInt(e.target.value, 10) || 0)} 
                    className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Accuracy Rate (%)</label>
                  <input type="number" step="0.1" min="0" max="100" required value={editAccuracyRate} onChange={e => setEditAccuracyRate(parseFloat(e.target.value) || 0.0)} 
                    className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
                </div>
              </div>
              {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}
              {editSuccess && <p className="text-xs text-green-600 font-medium">{editSuccess}</p>}
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updating} className="flex-1 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded shadow-sm disabled:opacity-50 transition-colors">
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Destructive Deletion Dialog with Email Verification */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-red-700 to-red-950 p-6 text-white flex justify-between items-center border-b border-black/10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-red-200 flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <span>Confirm Deletion</span>
                </h3>
                <p className="text-[10px] text-red-300 font-bold uppercase mt-0.5 tracking-wider">Irreversible Security Action</p>
              </div>
              <button onClick={() => { setDeletingUser(null); setDeleteConfirmEmail(''); }} className="text-red-300 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Danger Zone Warning</p>
                <p className="text-xs text-red-650 leading-relaxed">
                  You are about to permanently revoke system access for <strong className="font-extrabold font-mono text-[11px] bg-red-100 px-1 py-0.5 rounded text-red-800">{deletingUser.email}</strong>. 
                  All active roles, visual evaluations, and alert configuration links for this account will be erased.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Type the user's email to verify:
                </label>
                <input 
                  type="text" 
                  value={deleteConfirmEmail} 
                  onChange={e => setDeleteConfirmEmail(e.target.value)} 
                  placeholder={deletingUser.email}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 font-mono text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all rounded" 
                />
              </div>
              
              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
              {success && <p className="text-xs text-green-600 font-medium">{success}</p>}
              
              <div className="flex space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setDeletingUser(null); setDeleteConfirmEmail(''); }} 
                  className="flex-1 border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={deleteConfirmEmail !== deletingUser.email}
                  onClick={() => confirmDelete(deletingUser.id)}
                  className="flex-1 bg-red-600 hover:bg-red-750 text-white disabled:bg-red-400 disabled:opacity-50 px-4 py-2.5 text-xs uppercase tracking-widest font-black rounded shadow-sm transition-all duration-200"
                >
                  Revoke Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimsTab() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/claims');
      const data = await res.json();
      if (res.ok) setClaims(data.claims);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => { fetchClaims(); }); }, []);

  const handleResolve = async (id: string) => {
    if (!confirm('Mark claim as resolved?')) return;
    try {
      const res = await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestId: id })
      });
      if (res.ok) fetchClaims();
    } catch(err) {
      alert('Error updating claim');
    }
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-6 overflow-hidden">
      <div className="shrink-0 flex justify-between items-end border-b border-slate-200 pb-4">
         <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Claims Staging</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Pending marketplace reimbursements.</p>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto bg-white border border-slate-200 rounded-md shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Tracking AWB</th>
              <th className="px-6 py-4 font-medium">Order ID</th>
              <th className="px-6 py-4 font-medium">Condition Filter</th>
              <th className="px-6 py-4 font-medium">Evidence Data</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading items...</td></tr>
            ) : claims.map((c: any) => {
              const inspection = c.inspection;
              const cond = inspection?.isMissingItems ? 'MISSING ITEMS' : 'INSPECTED';
              const ev = inspection?.evidenceUrl;
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-800 font-medium">{c.trackingId}</td>
                  <td className="px-6 py-4 font-mono text-[11px]">{c.orderId}</td>
                  <td className="px-6 py-4 text-xs font-bold text-red-500">{cond}</td>
                  <td className="px-6 py-4">
                    {ev ? (
                      <a href={ev} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-[#FF6700] hover:text-[#FF6700] hover:bg-[#FF6700]/5 text-xs border border-[#FF6700]/20 px-2 py-1 bg-white rounded-sm transition-colors">
                        <span>View Artifact</span> <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">None attached</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleResolve(c.id)} className="text-[10px] uppercase font-bold tracking-widest text-green-600 hover:text-green-700 transition-colors">
                      Mark Resolved
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && claims.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">No pending claims.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: any; label: string; action: string }> = {
  L4: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', icon: <ShieldAlert size={18} className="text-red-600" />, label: 'CRITICAL', action: 'Phone + WhatsApp' },
  L3: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: <AlertTriangle size={18} className="text-orange-600" />, label: 'HIGH', action: 'Dashboard Banner' },
  L2: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: <Bell size={18} className="text-amber-600" />, label: 'MEDIUM', action: 'Email / Push' },
  L1: { color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: <Info size={18} className="text-slate-500" />, label: 'LOW', action: 'In-app only' },
};

function AlertsTab({ userRole }: { userRole: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [preferredLanguage, setPreferredLanguage] = useState(() => getStoredLanguage());
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';
  const [counts, setCounts] = useState<any>({ L1: 0, L2: 0, L3: 0, L4: 0, total: 0 });
  const [stats, setStats] = useState<any>({ resolvedToday: 0, sopFollowedToday: 0, adherenceRate: 100 });
  const [currentUserLevel, setCurrentUserLevel] = useState<string>('L1');
  const [sopChecked, setSopChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingSopType, setEditingSopType] = useState<string | null>(null);
  const [editingSopSteps, setEditingSopSteps] = useState<{ stepOrder: number; instruction: string }[]>([]);
  const [savingSop, setSavingSop] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolutionText, setBulkResolutionText] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [quickResolvingId, setQuickResolvingId] = useState<string | null>(null);
  const [resolveDataErrors, setResolveDataErrors] = useState<Record<string, string>>({});

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
        if (data.userLevel) setCurrentUserLevel(data.userLevel);
      }
    } finally {
      setLoading(false);
    }
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

  const handleResolve = async (alertId: string, alertLevel: string) => {
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
    } finally {
      setResolving(false);
    }
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
    } finally {
      setSavingSop(false);
    }
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
            body: JSON.stringify({ alertId, resolution: bulkResolutionText.trim() || 'Bulk resolved by admin', forceResolve: true }),
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
        body: JSON.stringify({ alertId, resolution: 'Resolved by admin' }),
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

  // ADMIN can now see and resolve all L1-L4 alerts.
  const isAdminView = userRole === 'ADMIN';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats Header */}
      <div className="shrink-0 p-6 border-b border-slate-200 bg-slate-50">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Alert Centre</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Escalations &amp; incidents requiring action.</p>
          </div>
          <div className="flex items-center space-x-2">
            {isAdminView && (
              <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded">
                L1–L4 Visible
              </span>
            )}
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest border rounded transition-colors ${
                showResolved ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF6700]'
              }`}
            >
              {showResolved ? 'Show Active' : 'Show Resolved'}
            </button>
          </div>
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
                  className="flex-1 min-w-[200px] bg-white border border-slate-300 px-3 py-1.5 text-xs rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                />
                <button
                  onClick={handleBulkResolve}
                  disabled={bulkResolving}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded transition-colors shadow-sm shrink-0"
                >
                  {bulkResolving ? 'Resolving...' : `✓ Resolve ${selectedIds.size}`}
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 border border-slate-300 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-slate-400 transition-colors shrink-0"
                >
                  Deselect All
                </button>
              </>
            ) : (
              <>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">Bulk Select:</span>
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
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">SOP Compliance Score</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Real-time daily adherence stack</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resolved Today</p>
                <p className="text-lg font-mono font-black text-white mt-0.5">{stats.resolvedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SOP Followed</p>
                <p className="text-lg font-mono font-black text-green-400 mt-0.5">{stats.sopFollowedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adherence Rate</p>
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
              const isHidden = false;
              return (
                <div key={level} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg px-4 py-3 shadow-sm ${isHidden ? 'opacity-30' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-2xl font-mono font-black ${cfg.color}`}>{isHidden ? '—' : (counts[level] || 0)}</p>
                    <div className="shrink-0">{cfg.icon}</div>
                  </div>
                  <p className={`text-[9px] uppercase tracking-widest font-black ${cfg.color}`}>{getSeverityLabel(level)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-lg">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">
              {showResolved ? 'No resolved alerts' : 'All Clear — No Active Alerts'}
            </h3>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.L1;
            const isExpanded = expandedId === alert.id;
            const sopSteps = sopMap[alert.type] || [];
            const canResolve = currentUserLevel === 'L4' || alert.level === 'L1' || alert.level === currentUserLevel;

            return (
              <div
                key={alert.id}
                className={`bg-white border ${cfg.borderColor} rounded-lg overflow-hidden shadow-sm transition-all ${
                  alert.level === 'L4' ? 'ring-1 ring-red-200' : ''
                } ${selectedIds.has(alert.id) ? 'ring-2 ring-[#FF6700]/40' : ''}`}
              >
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
                  {/* Alert Header Button */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); setResolveError(''); setSopChecked(false); }}
                    className={`flex-1 flex items-center justify-between ${!showResolved ? 'pl-3 pr-5' : 'px-5'} py-4 ${cfg.bgColor} hover:brightness-95 transition-all text-left`}
                  >
                  <div className="flex items-center space-x-3 min-w-0">
                     <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.bgColor} border ${cfg.borderColor}`}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{getSeverityLabel(alert.level)}</span>
                        {alert.resolved && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">RESOLVED</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{alert.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    {alert.manifest && (
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{alert.manifest.trackingId}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">{timeAgo(alert.createdAt)}</span>
                    {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  </div>
                  </button>
                  {/* Quick Resolve Button */}
                  {!alert.resolved && !showResolved && canResolve && (
                    <div
                      className="flex items-center px-3 shrink-0 border-l border-black/5"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleQuickResolve(alert.id)}
                        disabled={quickResolvingId === alert.id}
                        title="Quick Resolve — checks that the underlying issue is fixed before resolving"
                        className="text-[9px] font-black uppercase tracking-widest text-green-600 hover:text-green-800 disabled:opacity-50 border border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded transition-all whitespace-nowrap"
                      >
                        {quickResolvingId === alert.id ? '···' : '✓ Resolve'}
                      </button>
                    </div>
                  )}
                </div>
                {/* Data-check error banner */}
                {resolveDataErrors[alert.id] && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
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

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 py-5 space-y-4 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-sm text-slate-650 leading-relaxed">
                      {lang === 'hi' ? (
                        HINDI_ALERT_DESCRIPTIONS[alert.type]
                          ? HINDI_ALERT_DESCRIPTIONS[alert.type]
                              .replace('{trackingId}', alert.manifest?.trackingId || alert.description.match(/\b\d{8,15}\b/)?.[0] || '')
                              .replace('{orderId}', alert.description.match(/Removal Order (\S+)/i)?.[1] || alert.manifest?.removalOrderId || '')
                          : translateInstruction(alert.description, 'hi')
                      ) : alert.description}
                    </p>

                    {/* SOP Steps */}
                    {editingSopType === alert.type ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Edit Resolution Steps</h4>
                          <div className="flex space-x-2">
                            <button onClick={() => setEditingSopType(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button onClick={saveSop} disabled={savingSop} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700]">
                              {savingSop ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                        {editingSopSteps.map((step, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400 w-6">{i + 1}.</span>
                            <input
                              value={step.instruction}
                              onChange={e => {
                                const updated = [...editingSopSteps];
                                updated[i] = { ...updated[i], instruction: e.target.value };
                                setEditingSopSteps(updated);
                              }}
                              className="flex-1 bg-white border border-slate-300 px-3 py-2 text-sm rounded focus:border-[#FF6700] focus:outline-none"
                              placeholder="Step instruction..."
                            />
                            <button
                              onClick={() => setEditingSopSteps(editingSopSteps.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 p-1"
                            ><X size={14} /></button>
                          </div>
                        ))}
                        <button
                          onClick={() => setEditingSopSteps([...editingSopSteps, { stepOrder: editingSopSteps.length + 1, instruction: '' }])}
                          className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest"
                        >+ Add Step</button>
                      </div>
                    ) : sopSteps.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Resolution SOP</h4>
                          <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest flex items-center space-x-1">
                            <Pencil size={10} /><span>Edit</span>
                          </button>
                        </div>
                        <ol className="space-y-2">
                          {sopSteps.map((step: any, i: number) => (
                            <li key={step.id || i} className="flex items-start space-x-3">
                              <span className="shrink-0 w-6 h-6 bg-[#FF6700]/10 text-[#FF6700] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <p className="text-sm text-slate-700">{step.instruction}</p>
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
                              {lang === 'hi' ? 'मैंने उपर दिए गए सभी सतर संचालन प्रक्रिया चरणों को पढ़ा और उनका पालन किया है' : 'I have read and followed all standard operating procedure steps above'}
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">{lang === 'hi' ? 'इस अलर्ट प्रकार के लिए कोई SOP कॉन्य़िगर नहीं है।' : 'No SOP configured for this alert type.'}</p>
                        <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest">
                          + Create SOP Steps
                        </button>
                      </div>
                    )}

                    {/* Resolve Action */}
                    {!alert.resolved && (
                      <div className="space-y-2">
                        {!canResolve ? (
                          <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            <ShieldAlert size={14} className="text-red-500 shrink-0" />
                            <p className="text-xs text-red-700 font-bold">This alert requires alert level {alert.level} to resolve, but your configuration is {currentUserLevel}.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-3 pt-2">
                            <div className="flex items-center space-x-3">
                              <input
                                value={resolutionText}
                                onChange={e => setResolutionText(e.target.value)}
                                placeholder="Resolution notes (required)..."
                                className="flex-1 bg-white border border-slate-300 px-4 py-3 text-sm rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                              />
                              <button
                                onClick={() => handleResolve(alert.id, alert.level)}
                                disabled={resolving || !sopChecked || !resolutionText.trim()}
                                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors shadow-sm"
                              >
                                {resolving ? 'Resolving...' : 'Confirm Resolve'}
                              </button>
                            </div>
                            {!sopChecked && (
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                                {lang === 'hi' ? 'समाधान से पहले आपको उपर दिए गए SOP चरणों को पढ़ना और उनका पालन करना आवश्यक है।' : 'You must check "I have read and followed all standard operating procedure steps above" before resolving.'}
                              </p>
                            )}
                          </div>
                        )}
                        {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
                      </div>
                    )}

                    {/* Resolved info */}
                    {alert.resolved && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Resolved</p>
                        <p className="text-sm text-green-800">{alert.resolution || 'No notes'}</p>
                        <p className="text-[10px] text-green-600 mt-2">
                          By: {alert.resolvedBy?.name || alert.resolvedBy?.email || 'System'} • {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}
                        </p>
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
