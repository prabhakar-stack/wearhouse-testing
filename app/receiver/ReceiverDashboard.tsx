"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, QrCode, AlertOctagon, CheckCircle2, AlertTriangle, FileText, Check, Box, User, ArrowLeft, Shield, ChevronDown, Bell, X, Activity } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// ─── Marketplace → tape image map ─────────────────────────────────────────────
const TAPE_IMAGES: Record<string, { good: string; bad: string }> = {
  AMAZON:  { good: '/samples/tape_amazon_good.png',  bad: '/samples/tape_amazon_bad.png' },
  SHOPIFY: { good: '/samples/tape_shopify_good.png', bad: '/samples/tape_shopify_bad.png' },
  DEFAULT: { good: '/samples/tape_amazon_good.png',  bad: '/samples/tape_amazon_bad.png' },
};

function getTapeImages(marketplace: string) {
  return TAPE_IMAGES[marketplace?.toUpperCase()] ?? TAPE_IMAGES.DEFAULT;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type CheckState = 'null' | 'good' | 'damaged';
type Marketplace = 'AMAZON' | 'SHOPIFY' | string;

// ─── Root component ─────────────────────────────────────────────────────────────
export default function ReceiverDashboard({ userId, role, name, email }: { userId: string; role: string; name: string; email: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'home' | 'receive' | 'ledger' | 'profile' | 'expected' | 'alerts'>('home');
  const [userData, setUserData] = useState<any>(null);
  // cache of trackingId → marketplace fetched from expected list
  const [trackingIdMarketplaceMap, setTrackingIdMarketplaceMap] = useState<Record<string, Marketplace>>({});

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUserData(d.user); })
      .catch(console.error);
  }, []);

  const resolvedName = userData?.name || (name !== email ? name : '') || 'Receiver';
  const isEmail = resolvedName.includes('@');
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const [expectedCount, setExpectedCount] = useState(0);
  const [ledgerCount, setLedgerCount] = useState(0);

  // Pre-fetch expected and ledger counts with live stats updates
  useEffect(() => {
    const fetchLiveStats = () => {
      fetch('/api/dock/expected')
        .then(r => r.json())
        .then(d => {
          if (d.expected) {
            setExpectedCount(d.expected.length);
            const map: Record<string, Marketplace> = {};
            d.expected.forEach((item: any) => {
              const mp = item.returnItems?.[0]?.order?.marketplace ?? 'AMAZON';
              map[item.trackingId] = mp;
            });
            setTrackingIdMarketplaceMap(map);
          }
        })
        .catch(console.error);

      fetch('/api/dock/ledger')
        .then(r => r.json())
        .then(d => {
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
  const [resolutionText, setResolutionText] = useState('');

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
    <div className="flex flex-col h-screen bg-white text-[#313079] select-none font-sans overflow-hidden relative">
      <header className="p-4 border-b border-[#313079]/10 shrink-0 bg-white flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-[#313079]/70 hover:text-[#313079]">
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-[#FF6700]">
              {activeTab === 'home' ? 'Receiver Hub' : activeTab === 'receive' ? 'Package Intake' : activeTab === 'profile' ? 'Profile' : activeTab === 'expected' ? 'Expected' : activeTab === 'alerts' ? 'Active Alerts' : 'Handover Ledger'}
            </h1>
            <p className="text-[10px] uppercase text-[#313079]/60 tracking-wider mt-1 font-bold">{resolvedName} &bull; {role.replace('_', ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
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
            onClick={() => setActiveTab('profile')} 
            className={`p-1 hover:text-[#313079] transition-colors ${activeTab === 'profile' ? 'text-[#313079]' : 'text-[#FF6700]'}`}
            title="Profile"
          >
            <User size={26} />
          </button>
        </div>
      </header>

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

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FF6700]/5 p-4 pb-10 relative">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-2">
            <button onClick={() => setActiveTab('expected')} className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-xl shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                  Expected Deliveries
                  <span className="ml-2.5 bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0">
                    {expectedCount}
                  </span>
                </h3>
                <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Packages expected today</p>
              </div>
              <FileText size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
            </button>

            <button onClick={() => setActiveTab('receive')} className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-xl shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">Receive Package</h3>
                <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Launch camera scanner sequence</p>
              </div>
              <QrCode size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
            </button>

            <button onClick={() => setActiveTab('ledger')} className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-xl shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                  Handover Ledger
                  <span className="ml-2.5 bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0">
                    {ledgerCount}
                  </span>
                </h3>
                <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">View active custody stack</p>
              </div>
              <Box size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
            </button>

            <button onClick={() => setActiveTab('alerts')} className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-xl shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors flex items-center">
                  Active Alerts
                  {alertCount > 0 && (
                    <span className="ml-2.5 bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-mono font-black shrink-0 animate-pulse">
                      {alertCount}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Operational escalations &amp; alerts</p>
              </div>
              <Bell size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
            </button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-4 pb-10">
            {/* Profile Card */}
            <div className="bg-white border border-[#313079]/10 overflow-hidden rounded-2xl shadow-md">
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-black to-slate-900 p-8 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={100} className="text-white" /></div>
                <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
                  {initials}
                </div>
                <h2 className="text-xl font-black text-white">{resolvedName}</h2>
                <p className="text-slate-400 text-xs font-mono mt-1">{email}</p>
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
                  {role.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Stats */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FF6700]/5 border border-[#FF6700]/10 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">Items Received</p>
                    <p className="text-3xl font-black font-mono text-[#313079]">{userData?.itemsProcessed ?? 0}</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">Accuracy Rate</p>
                    <p className="text-3xl font-black font-mono text-green-600">{userData?.accuracyRate?.toFixed(1) ?? '100.0'}%</p>
                  </div>
                </div>
                {userData?.createdAt && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-1">Member Since</p>
                    <p className="text-sm font-bold text-[#313079]">
                      {new Date(userData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  Profile is read-only · Contact Admin to update details.
                </p>
              </div>
            </div>

            {(role === 'SUPER_ACCESS' || role === 'ADMIN') && (
              <Link href={role === 'SUPER_ACCESS' ? '/super-admin' : '/admin'} className="w-full flex items-center justify-center py-4 bg-[#FFF700] border-2 border-black hover:brightness-95 transition-all text-[#313079] font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                {role === 'SUPER_ACCESS' ? 'Switch to Super Access Role' : 'Switch to Admin Role'}
              </Link>
            )}
            <button onClick={async () => { localStorage.removeItem('userRole'); try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {} router.push('/login'); }} className="w-full py-4 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded-xl">
              Sign Out
            </button>
          </div>
        )}

        {activeTab === 'expected' && <ExpectedTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'receive' && <ReceiveTab userId={userId} trackingIdMarketplaceMap={trackingIdMarketplaceMap} />}
        {activeTab === 'ledger' && <LedgerTab />}
      </main>
    </div>
  );
}

// ─── Expected Tab ─────────────────────────────────────────────────────────────
function ExpectedTab() {
  const [expected, setExpected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = () => {
      fetch('/api/dock/expected')
        .then(r => r.json())
        .then(d => { if (d.expected) setExpected(d.expected); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetch_();
    const iv = setInterval(fetch_, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 px-2">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">Expected Today</h2>
        <span className="bg-white border border-[#FF6700]/20 text-[#FF6700] px-3 py-1 font-mono text-xs rounded-full shadow-sm font-bold">{expected.length} INBOUND</span>
      </div>
      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Inbound Ledger...</div>
      ) : expected.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-xl">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">No Expected Deliveries</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {expected.map((item, idx) => {
            const dispatched = new Date(item.expectedDate || new Date());
            const hoursDiff = (Date.now() - dispatched.getTime()) / 3600000;
            const issueLvl = hoursDiff > 48 ? 4 : hoursDiff > 24 ? 2 : 0;
            const marketplace = item.returnItems?.[0]?.order?.marketplace || 'UNKNOWN';
            const trackingSnapshot = item.trackingData?.[0] || null;
            return (
              <div key={item.id || idx} className={`bg-white border ${issueLvl > 0 ? 'border-red-300' : 'border-[#313079]/10'} p-4 flex flex-col space-y-3 relative overflow-hidden rounded-xl shadow-sm`}>
                <div className={`absolute inset-y-0 left-0 w-1.5 rounded-l-xl ${issueLvl === 4 ? 'bg-red-500 animate-pulse' : issueLvl > 0 ? 'bg-[#FFF700]' : 'bg-[#FF6700]'}`} />
                <div className="flex justify-between items-start pl-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#313079]/60">{marketplace} &bull; {item.trackingId}</p>
                    <p className="font-mono text-base text-[#313079] mt-0.5 font-bold">{item.trackingId}</p>
                    {trackingSnapshot ? (
                      <p className="text-[11px] text-[#313079]/70 mt-1 font-medium">
                        {trackingSnapshot.latestStatus || 'Tracking in progress'}
                        {trackingSnapshot.latestLocation ? ` · ${trackingSnapshot.latestLocation}` : ''}
                        {trackingSnapshot.scheduledDelivery ? ` · ETA ${new Date(trackingSnapshot.scheduledDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#313079]/50 mt-1 font-medium">Tracking data will refresh hourly for distant ETAs.</p>
                    )}
                  </div>
                  <div>
                    {issueLvl === 4 ? <span className="bg-red-50 text-red-600 px-2 py-1 text-xs font-bold uppercase border border-red-200 rounded-full">L4 ALERT</span>
                      : issueLvl > 0 ? <span className="bg-[#FFF700]/15 text-[#313079] px-2 py-1 text-xs font-bold uppercase border border-[#FFF700]/30 rounded-full">DELAYED</span>
                      : <span className="text-[#FF6700] text-xs font-bold uppercase">ON TIME</span>}
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
function ReceiveTab({ userId, trackingIdMarketplaceMap }: { userId: string; trackingIdMarketplaceMap: Record<string, Marketplace> }) {
  const [trackingId, setTrackingId] = useState('');
  const [scannedTrackingId, setScannedTrackingId]   = useState('');
  const [marketplace, setMarketplace] = useState<Marketplace>('AMAZON');
  const [searchError, setSearchError] = useState('');
  const [loadingVerify, setLoadingVerify] = useState(false);

  const verifyAndSetTrackingId = async (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) return;
    setLoadingVerify(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/dock/verify?trackingId=${encodeURIComponent(trimmedId)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || 'Failed to verify Tracking ID');
        setLoadingVerify(false);
        return;
      }
      setMarketplace(data.marketplace || 'AMAZON');
      setScannedTrackingId(trimmedId);
      setTrackingId(trimmedId);
    } catch (err: any) {
      setSearchError('Network error or server unavailable');
    } finally {
      setLoadingVerify(false);
    }
  };

  // Three accordion checks — each advances automatically
  const [activeStep, setActiveStep]     = useState(1);
  const [tapeState, setTapeState]       = useState<CheckState>('null');
  const [boxState, setBoxState]         = useState<CheckState>('null');
  const [tamperState, setTamperState]   = useState<CheckState>('null');
  const [allChecked, setAllChecked]     = useState(false);

  // Damage evidence camera
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [shutterFlash, setShutterFlash]           = useState(false);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // OTP
  const [otpState, setOtpState]   = useState<'IDLE'|'FETCHING'|'NOT_REQUIRED'|'FETCHED'|'ERROR'>('IDLE');
  const [fetchedOtp, setFetchedOtp] = useState('');

  // Done screen + silent upload
  const [showDoneScreen, setShowDoneScreen] = useState(false);

  // Scanner
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const isDamaged  = tapeState === 'damaged' || boxState === 'damaged' || tamperState === 'damaged';
  const isAllGood  = tapeState === 'good' && boxState === 'good' && tamperState === 'good';

  // Derive marketplace from trackingIdMarketplaceMap as soon as trackingId is scanned
  useEffect(() => {
    if (scannedTrackingId && trackingIdMarketplaceMap[scannedTrackingId]) {
      setMarketplace(trackingIdMarketplaceMap[scannedTrackingId]);
    } else {
      setMarketplace('AMAZON'); // default
    }
  }, [scannedTrackingId, trackingIdMarketplaceMap]);

  // Once all 3 checks are done, evaluate
  useEffect(() => {
    if (tapeState !== 'null' && boxState !== 'null' && tamperState !== 'null') {
      setAllChecked(true);
      if (isDamaged) {
        setShowEvidencePanel(true);
      } else {
        fetchSystemOTP();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapeState, boxState, tamperState]);

  // Camera for evidence panel
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showEvidencePanel && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { stream = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(console.error); } })
        .catch(console.error);
    }
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [showEvidencePanel]);

  const fetchSystemOTP = () => {
    setOtpState('FETCHING');
    setTimeout(() => {
      const r = Math.random();
      if (r < 0.5) { setOtpState('FETCHED'); setFetchedOtp(Math.floor(100000 + Math.random() * 900000).toString()); }
      else if (r < 0.8) { setOtpState('NOT_REQUIRED'); }
      else { setOtpState('ERROR'); }
    }, 2000);
  };

  const startScanner = async () => {
    setScanning(true);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H } = await import('html5-qrcode');
        scannerRef.current = new H("reader", { verbose: false, formatsToSupport: [5, 3, 9, 14] });
      }
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 300, height: 100 } },
        (text: string) => { stopScanner(); verifyAndSetTrackingId(text); },
        () => {}
      );
    } catch { setScanning(false); }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) { try { await scannerRef.current.stop(); } catch {} }
    try { scannerRef.current?.clear(); } catch {}
    setScanning(false);
  };

  useEffect(() => { return () => { stopScanner(); }; }, []);

  const handleManualSearch = (e: any) => {
    e.preventDefault();
    if (trackingId.trim()) { verifyAndSetTrackingId(trackingId.trim()); }
  };

  // Mark step & auto-advance
  const handleStepMark = (step: number, value: CheckState) => {
    if (step === 1) {
      setTapeState(value);
      if (value === 'damaged') {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else if (activeStep === 1) {
        setActiveStep(2);
      }
    }
    if (step === 2) {
      setBoxState(value);
      if (value === 'damaged') {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else if (activeStep === 2) {
        setActiveStep(3);
      }
    }
    if (step === 3) {
      setTamperState(value);
      if (value === 'damaged') {
        setAllChecked(true);
        setShowEvidencePanel(true);
      } else {
        setActiveStep(4);
      }
    }
  };

  // Capture evidence → silent background upload → show "done" screen immediately
  const handleCaptureAndReject = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async blob => {
      if (!blob) return;
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 150);

      // Show rejection screen immediately — don't wait for upload
      setShowDoneScreen(true);

      // Silent background upload
      const orderId = scannedTrackingId;
      const uid  = userId;
      const ts   = tapeState;
      const bs   = boxState;
      const ts2  = tamperState;
      ;(async () => {
        try {
          const filesMetaData = [{ key: 'file', name: `rejection-${orderId}-${Date.now()}.jpg`, mimeType: 'image/jpeg' }];
          let folderLink = `https://mock.local/${orderId}`;
          let finalFileId = `folder-${orderId}`;
          let fileLink = '';

          const initRes = await fetch('/api/upload/init', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, type: 'RECEIVER_REJECTION', filesMetaData }),
          });
          if (initRes.ok) {
            const d = await initRes.json();
            folderLink = d.folderLink; finalFileId = d.orderFolderId;
            if (d.uploadUrls?.['file']) {
              const rawRes = await fetch(d.uploadUrls['file'], { method: 'PUT', body: blob });
              if (rawRes.ok) { const rd = await rawRes.json(); fileLink = rd.webViewLink; finalFileId = rd.fileId || finalFileId; }
            }
          }

          await fetch('/api/upload/finalize', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, folderLink: fileLink || folderLink, orderFolderId: finalFileId, type: 'RECEIVER_REJECTION', uploadedById: uid, reason: 'Package failed visual inspection', manifestId: orderId }),
          }).catch(console.error);

          await fetch('/api/dock/receive', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingId: orderId, tapeIntact: ts !== 'damaged', boxCrushed: bs === 'damaged', isTampered: ts2 === 'damaged', evidenceUrl: fileLink || folderLink || 'UPLOAD_FAILED' }),
          }).catch(console.error);
        } catch (e) { console.error('[Silent Rejection Upload] failed:', e); }
      })();
    }, 'image/jpeg', 0.8);
  };

  const handleAcceptGood = async () => {
    const trackingIdVal = scannedTrackingId;
    // Show done screen immediately
    setShowDoneScreen(true);
    // Silent background submit
    ;(async () => {
      try {
        await fetch('/api/dock/receive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackingId: trackingIdVal, tapeIntact: true, boxCrushed: false, isTampered: false, otpProvided: fetchedOtp, evidenceUrl: '' }),
        });
      } catch (e) { console.error('[Silent Accept] failed:', e); }
    })();
  };

  const resetForm = () => {
    setScannedTrackingId(''); setTrackingId('');
    setTapeState('null'); setBoxState('null'); setTamperState('null');
    setActiveStep(1); setAllChecked(false);
    setShowEvidencePanel(false); setShowDoneScreen(false);
    setOtpState('IDLE'); setFetchedOtp('');
    setMarketplace('AMAZON');
  };

  const tapeImgs = getTapeImages(marketplace);

  // ── DONE SCREENS ─────────────────────────────────────────────
  if (showDoneScreen) {
    const rejected = isDamaged;
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 ${rejected ? 'bg-red-600' : 'bg-green-600'}`}>
        {rejected ? <AlertOctagon size={100} className="text-white mb-6" /> : <CheckCircle2 size={100} className="text-white mb-6" />}
        <h2 className="text-4xl font-black text-white uppercase tracking-widest text-center leading-tight">
          {rejected ? '🛑 REJECTED' : '✅ ACCEPTED'}
        </h2>
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase text-center">
          {rejected ? 'Hand package back to courier.' : 'Package received successfully.'}
        </p>
        <button onClick={resetForm} className="mt-12 w-full max-w-sm py-5 bg-white font-black uppercase tracking-widest rounded-2xl shadow-2xl text-xl hover:opacity-90 transition-opacity" style={{ color: rejected ? '#dc2626' : '#16a34a' }}>
          Process Next Package
        </button>
      </div>
    );
  }

  // ── SCANNER SCREEN ─────────────────────────────────────────────
  if (!scannedTrackingId) {
    return (
      <div className="max-w-lg mx-auto px-2 pb-10">
        <div className="border border-[#313079]/10 bg-white p-6 flex flex-col space-y-5 rounded-2xl shadow-sm">
          <div className="text-center">
            <h2 className="text-base uppercase tracking-widest text-[#FF6700] font-black">Scan Package Tracking ID</h2>
            <p className="text-sm text-[#313079]/70 font-medium mt-1">Position barcode in frame</p>
          </div>
          <div className="relative bg-[#FF6700]/5 w-full aspect-square border-2 border-dashed border-[#313079]/10 overflow-hidden flex flex-col items-center justify-center rounded-xl">
            <div id="reader" className="absolute inset-0 w-full h-full" />
            {!scanning && <Camera size={56} className="mb-3 text-[#313079]/30" />}
            {!scanning && <p className="text-sm uppercase tracking-widest text-[#313079]/45 font-bold">Camera Offline</p>}
          </div>
          {!scanning
            ? <button onClick={startScanner} className="w-full py-5 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white transition-colors font-black uppercase tracking-widest text-base flex items-center justify-center space-x-3 rounded-2xl shadow-md">
                <Camera size={22} /><span>Activate Camera</span>
              </button>
            : <button onClick={stopScanner} className="w-full py-5 bg-red-500 hover:bg-red-600 text-white transition-colors font-black uppercase tracking-widest text-base rounded-2xl">
                Stop Camera
              </button>
          }
          <div className="relative flex items-center py-1">
            <div className="absolute border-t border-[#313079]/10 w-full" />
            <span className="bg-white px-4 text-[#313079]/45 text-xs uppercase font-bold tracking-widest relative z-10 mx-auto">Manual Override</span>
          </div>
          <form onSubmit={handleManualSearch} className="flex flex-col space-y-3">
            <input type="text" placeholder="ENTER TRACKING ID" value={trackingId} onChange={e => { setTrackingId(e.target.value); setSearchError(''); }}
              className="w-full bg-white border-2 border-[#313079]/20 text-[#313079] p-4 font-mono text-lg focus:outline-none focus:border-[#FF6700] text-center rounded-xl" />
            {searchError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-xs font-bold rounded flex items-center space-x-2 w-full">
                <AlertOctagon size={16} className="shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
            <button type="submit" disabled={!trackingId || loadingVerify} className="w-full py-4 bg-[#FF6700]/5 border border-[#FF6700]/10 text-[#313079]/70 hover:text-[#FF6700] hover:border-[#FF6700] transition-colors uppercase tracking-widest text-sm font-black disabled:opacity-50 rounded-2xl flex items-center justify-center space-x-2">
              {loadingVerify ? (
                <div className="w-5 h-5 border-2 border-[#313079]/70 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Proceed</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── INSPECTION SCREEN ──────────────────────────────────────────
  const steps = [
    {
      id: 1, label: 'Factory Tape Intact',
      state: tapeState,
      instruction: 'Check that the factory sealing tape across all box seams is unbroken, smooth, and continuous. Any cut, peel, or re-application means DAMAGED.',
      goodImg: tapeImgs.good, badImg: tapeImgs.bad,
    },
    {
      id: 2, label: 'Box Structure OK',
      state: boxState,
      instruction: 'Inspect all 6 sides and all corners for crushing, deep dents, moisture damage, or torn edges. Press gently on sides to check for internal collapse.',
      goodImg: '/samples/box_good.png', badImg: '/samples/box_damaged.png',
    },
    {
      id: 3, label: 'No Signs of Tampering',
      state: tamperState,
      instruction: 'Look for extra tape applied over original seams, torn/re-applied labels, void stickers showing VOID, or mismatched tape colours. Any of these = DAMAGED.',
      goodImg: '/samples/tamper_good.png', badImg: '/samples/tamper_bad.png',
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-2 pb-10 space-y-3">
      {/* Tracking ID header */}
      <div className="border border-[#FF6700]/20 bg-[#FF6700]/5 p-4 flex justify-between items-center rounded-2xl shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#313079]/60 font-bold">Scanned Tracking ID &bull; <span className="text-[#FF6700]">{marketplace}</span></p>
          <p className="font-mono text-xl text-[#313079] font-black mt-0.5">{scannedTrackingId}</p>
        </div>
        <button onClick={resetForm} className="text-[#313079]/70 hover:text-red-600 text-xs uppercase tracking-widest font-bold px-4 py-2 border border-[#313079]/20 rounded-xl transition-colors">Reset</button>
      </div>

      <h3 className="text-sm font-black tracking-widest text-[#313079] uppercase text-center pt-2">Visual Health Check</h3>

      {/* Accordion steps */}
      <div className="space-y-2">
        {steps
          .filter(step => {
            if (isDamaged) {
              return step.state !== 'null';
            }
            return true;
          })
          .map(step => {
          const isActive    = activeStep === step.id && !allChecked;
          const isCompleted = step.state !== 'null';
          const isLocked    = !isActive && !isCompleted;

          return (
            <div key={step.id}
              className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                isActive ? 'border-[#FF6700] shadow-lg shadow-[#FF6700]/10' :
                isCompleted && step.state === 'good' ? 'border-green-300' :
                isCompleted && step.state === 'damaged' ? 'border-red-300' :
                'border-[#313079]/10'
              } bg-white`}
            >
              {/* Step header — always visible */}
              <button
                className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${isActive ? 'bg-[#FF6700]/5' : isCompleted ? (step.state === 'good' ? 'bg-green-50' : 'bg-red-50') : 'bg-white'}`}
                onClick={() => { if (!allChecked && isCompleted) setActiveStep(step.id); }}
                disabled={isLocked}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl border-2 ${
                    isCompleted && step.state === 'good' ? 'bg-green-500 border-green-500 text-white' :
                    isCompleted && step.state === 'damaged' ? 'bg-red-500 border-red-500 text-white' :
                    isActive ? 'bg-[#FF6700] border-[#FF6700] text-white' :
                    'bg-[#FF6700]/5 border-[#FF6700]/10 text-[#313079]/50'
                  }`}>
                    {isCompleted && step.state === 'good' ? <Check size={20} strokeWidth={3} /> :
                     isCompleted && step.state === 'damaged' ? '✕' :
                     step.id}
                  </div>
                  <div className="text-left">
                    <p className={`text-base font-black uppercase tracking-widest ${isActive ? 'text-[#FF6700]' : isCompleted ? (step.state === 'good' ? 'text-green-700' : 'text-red-700') : 'text-[#313079]/40'}`}>
                      {step.label}
                    </p>
                    {isCompleted && (
                      <p className={`text-xs font-bold uppercase tracking-wider ${step.state === 'good' ? 'text-green-600' : 'text-red-600'}`}>
                        {step.state === 'good' ? '✅ Good' : '❌ Damaged'}
                      </p>
                    )}
                  </div>
                </div>
                {isActive && <ChevronDown size={20} className="text-[#FF6700]" />}
              </button>

              {/* Expanded content — only for active step */}
              {isActive && (
                <div className="px-4 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-sm text-[#313079]/80 font-medium leading-relaxed px-1">{step.instruction}</p>

                  {/* Reference images — takes majority of mobile screen */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col space-y-1">
                      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-green-200 bg-[#FF6700]/5">
                        <Image src={step.goodImg} alt="Good example" fill className="object-cover" unoptimized />
                      </div>
                      <p className="text-center text-xs font-black uppercase tracking-wider text-green-600">✅ GOOD</p>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-red-200 bg-[#FF6700]/5">
                        <Image src={step.badImg} alt="Damaged example" fill className="object-cover" unoptimized />
                      </div>
                      <p className="text-center text-xs font-black uppercase tracking-wider text-red-600">❌ DAMAGED</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleStepMark(step.id, 'good')}
                      className="py-5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-black text-lg uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95"
                    >
                      ✅ GOOD
                    </button>
                    <button
                      onClick={() => handleStepMark(step.id, 'damaged')}
                      className="py-5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-black text-lg uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95"
                    >
                      ❌ DAMAGED
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Evidence camera — slides up after all checks if damaged */}
      {showEvidencePanel && !showDoneScreen && (
        <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-3">
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center space-x-3">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-red-700 text-sm font-black uppercase tracking-widest">Damage Detected — Upload Evidence</p>
          </div>
          <div className="relative w-full bg-black rounded-2xl overflow-hidden border-4 border-red-500 shadow-xl" style={{ minHeight: '56vw', maxHeight: '70vh' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: 'block', minHeight: '56vw', maxHeight: '70vh' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {shutterFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150" />}
            <div className="absolute top-3 left-3 bg-red-600/90 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest flex items-center space-x-2 rounded-full z-10">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" /><span>LIVE</span>
            </div>
          </div>
          <button
            onClick={handleCaptureAndReject}
            className="w-full py-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white uppercase font-black tracking-widest text-xl rounded-2xl shadow-lg flex items-center justify-center space-x-3 transition-all active:scale-95"
          >
            <Camera size={26} /><span>Capture &amp; Reject</span>
          </button>
        </div>
      )}

      {/* OTP + Accept section — only when all good */}
      {allChecked && isAllGood && !showDoneScreen && (
        <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-3 pt-2">
          <div className="border border-[#313079]/10 bg-white p-6 rounded-2xl shadow-sm">
            {otpState === 'FETCHING' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="w-10 h-10 border-4 border-[#FF6700] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm uppercase font-black tracking-widest text-slate-500">Fetching Delivery OTP...</p>
              </div>
            )}
            {otpState === 'NOT_REQUIRED' && (
              <div className="flex flex-col items-center justify-center space-y-3 py-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 size={36} className="text-green-500" />
                <p className="text-sm uppercase font-black tracking-widest text-green-700 text-center">OTP Not Required</p>
              </div>
            )}
            {otpState === 'FETCHED' && (
              <div className="flex flex-col items-space-y-3 py-2">
                <p className="text-xs uppercase font-black tracking-widest text-[#313079]/60">System OTP</p>
                <div className="w-full bg-[#FF6700]/5 border border-[#FF6700]/20 px-4 py-6 text-center text-4xl font-mono tracking-[0.3em] text-[#313079] rounded-xl shadow-inner">{fetchedOtp}</div>
              </div>
            )}
            {otpState === 'ERROR' && (
              <div className="flex flex-col items-center space-y-3 py-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertOctagon size={36} className="text-red-500" />
                <p className="text-sm uppercase font-black tracking-widest text-red-700">OTP Fetch Failed</p>
              </div>
            )}
          </div>
          {['NOT_REQUIRED', 'FETCHED'].includes(otpState) && (
            <button onClick={handleAcceptGood} className="w-full py-6 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white uppercase font-black tracking-widest text-xl rounded-2xl shadow-lg flex items-center justify-center space-x-3 transition-all active:scale-95">
              <CheckCircle2 size={26} /><span>Complete &amp; Accept</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────
function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dock/ledger')
      .then(r => r.json())
      .then(d => { if (d.ledger) setLedger(d.ledger); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 px-2">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">Handover Ledger</h2>
        <span className="bg-white border border-[#FF6700]/20 text-[#FF6700] px-3 py-1 font-mono text-xs font-bold rounded-full shadow-sm">{ledger.length} ITEMS</span>
      </div>
      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/10 bg-white rounded-2xl">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">All Clear</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {ledger.map((item: any) => (
            <div key={item.id} className="bg-white border border-[#313079]/10 p-4 flex justify-between items-center relative overflow-hidden rounded-2xl shadow-sm">
              <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-[#FF6700]" />
              <div className="pl-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[#313079]/60">{item.returnItems?.[0]?.order?.marketplace || 'UNKNOWN'}</p>
                <p className="font-mono text-lg text-[#313079] font-black mt-0.5">{item.trackingId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase text-[#313079]/60">Received</p>
                <p className="text-sm font-mono text-[#313079] font-bold">{new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Alerts Tab ─────────────────────────────────────────────────────────────
function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [stats, setStats] = useState<any>({ resolvedToday: 0, sopFollowedToday: 0, adherenceRate: 100 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [sopChecked, setSopChecked] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.alerts || []);
        setSopMap(data.sopMap || {});
        if (data.stats) setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, []);

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
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-10 px-2">
      <div className="mb-6 flex items-center justify-between border-b border-[#313079]/10 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">Active Alerts</h2>
        <span className="bg-white border border-red-200 text-red-600 px-3 py-1 font-mono text-xs rounded-full shadow-sm font-bold">{alerts.length} ALERTS</span>
      </div>

      {/* SOP Compliance stats bar */}
      <div className="mb-4 bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#FF6700]/15 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700]">
            <Activity size={18} />
          </div>
          <div className="text-left">
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

      {loading && alerts.length === 0 ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-xl">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">All Clear</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const steps = sopMap[alert.type] || [];
            return (
              <div key={alert.id} className="bg-white border border-[#313079]/10 p-4 flex flex-col space-y-3 relative overflow-hidden rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-red-500" />
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); setResolveError(''); setSopChecked(false); }}
                  className="w-full flex justify-between items-start pl-3 text-left focus:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                      {alert.level} - {alert.type}
                    </span>
                    <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal truncate">{alert.description}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-3 pl-3 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                    
                    {steps.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-left">
                        <p className="text-[8px] font-black uppercase tracking-wider text-[#FF6700]">Resolution SOP Steps:</p>
                        <ol className="space-y-1.5">
                          {steps.map((step: any, idx: number) => (
                            <li key={step.id || idx} className="text-[10px] text-[#313079]/90 font-medium flex items-start space-x-1.5">
                              <span className="font-mono font-bold text-[#FF6700]">{step.stepOrder}.</span>
                              <span className="leading-snug">{step.instruction}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`sop-check-${alert.id}`}
                            checked={sopChecked}
                            onChange={(e) => setSopChecked(e.target.checked)}
                            className="w-4 h-4 accent-green-600 rounded cursor-pointer shrink-0"
                          />
                          <label htmlFor={`sop-check-${alert.id}`} className="text-[10px] font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                            I have read and followed this SOP
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-slate-400">No SOP configured for this alert type.</p>
                      </div>
                    )}

                    <div className="flex flex-col space-y-2 pt-1 border-t border-slate-50 text-left">
                      <div className="flex space-x-1.5 items-center">
                        <input
                          type="text"
                          placeholder="RESOLVE NOTES (REQUIRED)"
                          value={resolutionText}
                          onChange={e => setResolutionText(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] uppercase font-bold focus:outline-none focus:border-[#FF6700] text-slate-900"
                        />
                        <button
                          onClick={() => handleResolve(alert.id)}
                          disabled={!resolutionText.trim() || !sopChecked || resolving}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 text-[9px] font-black uppercase rounded-md shrink-0 animate-in fade-in duration-200"
                        >
                          {resolving ? '...' : 'Confirm'}
                        </button>
                      </div>
                      {!sopChecked && (
                        <p className="text-[8px] text-amber-600 font-bold uppercase tracking-wider">
                          ⚠ You must check "I have read and followed this SOP" before resolving.
                        </p>
                      )}
                      {resolveError && <p className="text-[9px] text-red-600 font-medium">{resolveError}</p>}
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

