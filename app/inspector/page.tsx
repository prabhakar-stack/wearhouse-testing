"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertOctagon, Link as LinkIcon, ScanEye, Camera, AlertTriangle, ArrowRight, PackageOpen, User, ArrowLeft, Shield, FileText, Box, Zap, TrendingUp, Check } from 'lucide-react';
import Link from 'next/link';

export default function InspectorPage() {
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem('userRole');
    setTimeout(() => {
      setRole(storedRole || 'INSPECTOR'); 
      setMounted(true);
    }, 0);
  }, []);

  if (!mounted) return null;

  if (role !== 'INSPECTOR' && role !== 'ADMIN' && role !== 'SUPER_ACCESS') {
    return (
      <div className="h-screen w-screen bg-red-50 text-red-800 flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-red-200">
        <AlertOctagon size={120} className="mb-8 text-red-400" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight text-red-700">Access Denied</h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-red-500">Invalid Role Authorization</p>
      </div>
    );
  }

  return <InspectorDashboard role={role} />;
}

function StepVisualGuide({ step }: { step: { id: number; title: string; desc: string; sampleImg: string | null } }) {
  const renderBoxWireframe = (highlightedFace: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => {
    return (
      <svg viewBox="0 0 200 135" className="w-40 h-28 text-[#FF6700]">
        <defs>
          <linearGradient id="glowBrand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6700" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FF6700" stopOpacity="0.15" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 1. Draw hidden faces first */}
        <polygon 
          points="60,95 100,115 140,95 100,75" 
          fill={highlightedFace === 'bottom' ? 'url(#glowBrand)' : 'none'} 
          stroke={highlightedFace === 'bottom' ? '#FF6700' : 'rgba(49, 48, 121, 0.3)'} 
          strokeWidth={highlightedFace === 'bottom' ? '2' : '1'} 
          strokeDasharray={highlightedFace === 'bottom' ? 'none' : '3,3'} 
          filter={highlightedFace === 'bottom' ? 'url(#glow)' : undefined}
        />
        <polygon 
          points="100,20 60,40 60,95 100,75" 
          fill={highlightedFace === 'left' ? 'url(#glowBrand)' : 'none'} 
          stroke={highlightedFace === 'left' ? '#FF6700' : 'rgba(49, 48, 121, 0.3)'} 
          strokeWidth={highlightedFace === 'left' ? '2' : '1'} 
          strokeDasharray={highlightedFace === 'left' ? 'none' : '3,3'} 
          filter={highlightedFace === 'left' ? 'url(#glow)' : undefined}
        />
        <polygon 
          points="100,20 140,40 140,95 100,75" 
          fill={highlightedFace === 'back' ? 'url(#glowBrand)' : 'none'} 
          stroke={highlightedFace === 'back' ? '#FF6700' : 'rgba(49, 48, 121, 0.3)'} 
          strokeWidth={highlightedFace === 'back' ? '2' : '1'} 
          strokeDasharray={highlightedFace === 'back' ? 'none' : '3,3'} 
          filter={highlightedFace === 'back' ? 'url(#glow)' : undefined}
        />

        {/* 2. Draw visible faces */}
        {/* Top Face */}
        <polygon 
          points="100,20 140,40 100,60 60,40" 
          fill={highlightedFace === 'top' ? 'url(#glowBrand)' : 'rgba(49, 48, 121, 0.2)'} 
          stroke={highlightedFace === 'top' ? '#FF6700' : 'rgba(49, 48, 121, 0.4)'} 
          strokeWidth={highlightedFace === 'top' ? '2' : '1'}
          filter={highlightedFace === 'top' ? 'url(#glow)' : undefined}
        />
        {/* Front Face */}
        <polygon 
          points="60,40 100,60 100,115 60,95" 
          fill={highlightedFace === 'front' ? 'url(#glowBrand)' : 'rgba(49, 48, 121, 0.2)'} 
          stroke={highlightedFace === 'front' ? '#FF6700' : 'rgba(49, 48, 121, 0.4)'} 
          strokeWidth={highlightedFace === 'front' ? '2' : '1'}
          filter={highlightedFace === 'front' ? 'url(#glow)' : undefined}
        />
        {/* Right Face */}
        <polygon 
          points="100,60 140,40 140,95 100,115" 
          fill={highlightedFace === 'right' ? 'url(#glowBrand)' : 'rgba(49, 48, 121, 0.2)'} 
          stroke={highlightedFace === 'right' ? '#FF6700' : 'rgba(49, 48, 121, 0.4)'} 
          strokeWidth={highlightedFace === 'right' ? '2' : '1'}
          filter={highlightedFace === 'right' ? 'url(#glow)' : undefined}
        />

        {/* Glowing text label floating near the highlighted face */}
        <text x="100" y="130" textAnchor="middle" fill="#FF6700" className="text-[10px] font-black tracking-widest font-mono uppercase animate-pulse">
          {highlightedFace.toUpperCase()} SIDE
        </text>
      </svg>
    );
  };

  const renderDeliveryLabel = () => {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <svg viewBox="0 0 200 110" className="w-48 h-24">
          <rect x="50" y="10" width="100" height="90" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          <rect x="60" y="20" width="25" height="8" rx="1" fill="#1e293b" />
          <circle cx="95" cy="24" r="3" fill="#FF6700" />
          <line x1="60" y1="36" x2="110" y2="36" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="60" y1="44" x2="130" y2="44" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
          <line x1="60" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
          <g opacity="0.8">
            <line x1="60" y1="62" x2="60" y2="82" stroke="#0f172a" strokeWidth="3" />
            <line x1="66" y1="62" x2="66" y2="82" stroke="#0f172a" strokeWidth="1" />
            <line x1="70" y1="62" x2="70" y2="82" stroke="#0f172a" strokeWidth="2" />
            <line x1="76" y1="62" x2="76" y2="82" stroke="#0f172a" strokeWidth="4" />
            <line x1="84" y1="62" x2="84" y2="82" stroke="#0f172a" strokeWidth="1" />
            <line x1="88" y1="62" x2="88" y2="82" stroke="#0f172a" strokeWidth="3" />
            <line x1="94" y1="62" x2="94" y2="82" stroke="#0f172a" strokeWidth="2" />
            <line x1="100" y1="62" x2="100" y2="82" stroke="#0f172a" strokeWidth="5" />
            <line x1="108" y1="62" x2="108" y2="82" stroke="#0f172a" strokeWidth="1" />
            <line x1="112" y1="62" x2="112" y2="82" stroke="#0f172a" strokeWidth="3" />
            <line x1="118" y1="62" x2="118" y2="82" stroke="#0f172a" strokeWidth="2" />
            <line x1="124" y1="62" x2="124" y2="82" stroke="#0f172a" strokeWidth="4" />
            <line x1="132" y1="62" x2="132" y2="82" stroke="#0f172a" strokeWidth="1" />
            <line x1="138" y1="62" x2="138" y2="82" stroke="#0f172a" strokeWidth="3" />
          </g>
          <text x="100" y="93" textAnchor="middle" className="text-[7px] font-mono font-bold tracking-widest fill-[#313079]">
            AWB: 1Z999AA10123456784
          </text>
        </svg>
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-52 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]" 
          style={{
            animation: 'laser 2.5s infinite ease-in-out',
          }}
        ></div>
      </div>
    );
  };

  const renderOrderSlip = () => {
    return (
      <svg viewBox="0 0 200 110" className="w-48 h-24 text-[#313079]/30">
        <rect x="55" y="15" width="90" height="85" rx="3" fill="#475569" stroke="#334155" strokeWidth="1.5" />
        <rect x="85" y="10" width="30" height="12" rx="2" fill="#1e293b" />
        <circle cx="100" cy="16" r="2" fill="#94a3b8" />
        <rect x="62" y="22" width="76" height="72" rx="1" fill="#f8fafc" />
        <rect x="70" y="30" width="40" height="4" fill="#FF6700" rx="0.5" />
        <g opacity="0.8">
          <rect x="70" y="42" width="6" height="6" rx="1" fill="none" stroke="#10b981" strokeWidth="1" />
          <line x1="80" y1="45" x2="120" y2="45" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M71,45 L73,47 L75,43" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          <rect x="70" y="54" width="6" height="6" rx="1" fill="none" stroke="#10b981" strokeWidth="1" />
          <line x1="80" y1="57" x2="110" y2="57" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M71,57 L73,59 L75,55" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          <rect x="70" y="66" width="6" height="6" rx="1" fill="none" stroke="#10b981" strokeWidth="1" />
          <line x1="80" y1="69" x2="125" y2="69" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M71,69 L73,71 L75,67" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <circle cx="120" cy="36" r="10" fill="#10b981" className="animate-pulse" />
        <path d="M116,36 L119,39 L124,33" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  };

  const renderSvgGuide = (id: number) => {
    switch (id) {
      case 3:
        return renderBoxWireframe('front');
      case 4:
        return renderBoxWireframe('back');
      case 5:
        return renderBoxWireframe('left');
      case 6:
        return renderBoxWireframe('right');
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
        <img src={step.sampleImg} alt="Sample reference" className="w-full h-full object-cover" />
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
  const [activeTab, setActiveTab] = useState<'home' | 'takeover' | 'inspect' | 'profile' | 'ledger'>('home');
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUserData(data.user);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white text-[#313079] select-none overscroll-none font-sans overflow-hidden border-4 border-[#313079]/10">
      
      <header className="p-4 md:p-6 border-b border-[#313079]/10 shrink-0 bg-white shadow-sm z-20 flex items-center justify-between">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-[#313079]/70 hover:text-[#313079]">
               <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#FF6700]">
              {activeTab === 'profile' ? 'Profile' : activeTab === 'ledger' ? 'Custody Ledger' : 'Quality Assurance'}
            </h1>
            <p className="text-[#313079]/60 text-xs font-bold tracking-widest mt-1 uppercase">
              {userData ? (userData.name || userData.email?.split('@')[0] || role) : role.replace('_', ' ')} &bull; {role.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveTab('profile')} className={`hover:text-[#313079] transition-colors ${activeTab === 'profile' ? 'text-[#313079]' : 'text-[#FF6700]'}`}>
            <User size={28} />
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-y-auto custom-scrollbar bg-[#FF6700]/5">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4 pb-10">
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('ledger')}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">Custody Ledger</h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Packages pending inspection</p>
                </div>
                <FileText size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('takeover')}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">Custody Takeover</h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Execute mechanical handshake</p>
                </div>
                <LinkIcon size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('inspect')}
                className="w-full relative group border border-[#313079]/10 bg-white hover:border-[#FF6700] transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#313079] group-hover:text-[#FF6700] transition-colors">Deep Inspect</h3>
                  <p className="text-xs text-[#313079]/60 mt-1 font-mono uppercase tracking-wider">Gamified quality assurance</p>
                </div>
                <ScanEye size={32} className="text-[#313079]/30 group-hover:text-[#FF6700] transition-colors relative z-10" />
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-4 pt-6 px-4 pb-10">
            {/* Profile Card */}
            <div className="bg-white border border-[#313079]/10 overflow-hidden rounded-2xl shadow-md">
              {/* Gradient header */}
              <div className="bg-gradient-to-br from-black to-slate-900 p-8 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={100} className="text-white" /></div>
                {/* Avatar with initials from name or email */}
                <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
                  {userData
                    ? (userData.name || userData.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    : '?'
                  }
                </div>
                <h2 className="text-xl font-black text-white">
                  {userData ? (userData.name || userData.email?.split('@')[0] || 'Inspector') : 'Loading...'}
                </h2>
                {userData?.name && (
                  <p className="text-slate-400 text-xs font-mono mt-1">{userData.email}</p>
                )}
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
                  {role?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Stats */}
              <div className="p-6 space-y-4">
                {userData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#FF6700]/5 border border-[#FF6700]/10 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">Items Inspected</p>
                        <p className="text-3xl font-black font-mono text-[#313079]">{userData.itemsProcessed ?? 0}</p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-2">Accuracy Rate</p>
                        <p className="text-3xl font-black font-mono text-green-600">{userData.accuracyRate?.toFixed(1) ?? '100.0'}%</p>
                      </div>
                    </div>
                    {userData.createdAt && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50 mb-1">Member Since</p>
                        <p className="text-sm font-bold text-[#313079]">
                          {new Date(userData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-[#313079]/40 text-xs uppercase tracking-widest animate-pulse font-bold">Loading profile...</div>
                )}
                <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  Profile is read-only · Contact Admin to update details.
                </p>
              </div>
            </div>

            {(role === 'SUPER_ACCESS' || role === 'ADMIN') && (
              <Link
                href={role === 'SUPER_ACCESS' ? '/super-admin' : '/admin'}
                className="w-full flex items-center justify-center py-4 bg-[#FFF700] border-2 border-black hover:brightness-95 transition-all text-[#313079] font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                Return to Command Center
              </Link>
            )}
            <button
              onClick={async () => {
                localStorage.removeItem('userRole');
                try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
                router.push('/login');
              }}
              className="w-full py-4 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              Sign Out
            </button>
          </div>
        )}
        
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'takeover' && <TakeoverTab />}
        {activeTab === 'inspect' && <InspectTab userId={userData?.id} />}
      </main>

    </div>
  );
}

function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = () => {
      fetch('/api/inspector/ledger')
        .then(r => r.json())
        .then(d => {
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
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#313079]">My Custody Ledger</h2>
        <span className="bg-white border border-[#FF6700]/30 text-[#FF6700] px-3 py-1 font-mono text-xs rounded-sm shadow-sm font-bold">{ledger.length} PENDING</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#313079]/60 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Custody Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#313079]/20 bg-white rounded-md">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#313079]">No Pending Inspections</h3>
          <p className="text-[10px] uppercase text-[#313079]/70 mt-2 max-w-[200px] mx-auto font-medium">You have no active taken packages. Proceed to Takeover to pull from Receiver.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item, idx) => (
             <div key={item.id || idx} className="bg-white border border-[#313079]/10 p-4 flex flex-col space-y-3 relative overflow-hidden group rounded-md shadow-sm hover:shadow transition-shadow">
               <div className={`absolute inset-y-0 left-0 w-1 ${item.status === 'INSPECTING' ? 'bg-[#FF6700] animate-pulse' : 'bg-[#FF6700]/30'}`}></div>
               
               <div className="flex justify-between items-start pl-2">
                 <div>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[#313079]/60">{item.marketplace || 'UNKNOWN'} &bull; ORDER {item.orderId}</p>
                   <p className="font-mono text-base text-[#313079] mt-0.5 font-bold">{item.trackingId}</p>
                 </div>
                 <div className="text-right">
                   {item.status === 'INSPECTING' ? (
                     <span className="bg-[#FF6700]/5 text-[#FF6700] px-2 py-1 text-[10px] font-bold uppercase border border-[#FF6700]/20 rounded-sm">IN PROGRESS</span>
                   ) : (
                     <span className="bg-[#313079]/5 text-[#313079]/70 px-2 py-1 text-[10px] font-bold uppercase border border-[#313079]/15 rounded-sm">PENDING</span>
                   )}
                 </div>
               </div>
               
               <div className="flex justify-between items-center pl-2 pt-2 border-t border-[#313079]/10">
                 <div>
                   <p className="text-[10px] uppercase text-[#313079]/50 font-bold">Items Scanned</p>
                   <div className="font-mono text-xs mt-1 text-[#313079] font-bold">
                     <span className="text-green-600">{item.itemsInspected}</span> / {item.itemsExpected}
                   </div>
                 </div>
                 <div className="text-[9px] font-mono text-[#313079]/50 font-bold">
                   Taken: {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
  const [trackingId, setTrackingId] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [takenManifest, setTakenManifest] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inspector/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingId: trackingId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Takeover failed');
        setLoading(false);
        return;
      }
      setTakenManifest(data.manifest);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setTrackingId('');
        setTakenManifest(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Network error');
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
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase">Successfully!</p>
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
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#313079]">Mechanical Handshake</h2>
          <p className="text-[#313079]/60 font-bold text-sm tracking-widest mt-2 uppercase">Scan Box from Receiver</p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input 
              type="text" 
              placeholder="ENTER TRACKING ID..."
              value={trackingId} 
              onChange={e => setTrackingId(e.target.value)}
              autoFocus
              className="w-full bg-white border-2 border-[#313079]/20 text-[#313079] p-4 text-center font-mono focus:outline-none focus:border-[#FF6700] transition-colors uppercase placeholder-[#313079]/30 rounded"
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-bold rounded flex items-center space-x-2">
                <AlertOctagon size={16} /><span>{error}</span>
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
                <><span>Confirm Takeover</span><ArrowRight size={24} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function InspectTab({ userId }: { userId?: string }) {
  const [phase, setPhase] = useState<'START' | 'BOX_EVIDENCE' | 'ITEM_INSPECTION' | 'COMPLETED'>('START');
  const [orderId, setOrderId] = useState('');
  
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [floatingXp, setFloatingXp] = useState<number | null>(null);

  const [boxStep, setBoxStep] = useState(1); 
  
  const [itemStep, setItemStep] = useState(1); 
  const [itemsProcessed, setItemsProcessed] = useState(0);
  const [currentLpn, setCurrentLpn] = useState('');
  const [currentCategory, setCurrentCategory] = useState<'GOOD' | 'RECOVERY' | 'BAD' | null>(null);
  const [selectedClaimReason, setSelectedClaimReason] = useState<string | null>(null);
  const [selectedClaimSubReason, setSelectedClaimSubReason] = useState<string | null>(null);
  const [showDefectDropdown, setShowDefectDropdown] = useState(false);
  
  const [missingAcknowledged, setMissingAcknowledged] = useState(false);

  // Dynamic expected items — fetched from DB on order start
  const [expectedItems, setExpectedItems] = useState(0);
  const [startError, setStartError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const capturedImagesRef = useRef<{ type: 'box' | 'lpn' | 'product', id?: string, blob: Blob }[]>([]);
  const lpnConditionsRef = useRef<Record<string, string>>({});
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

  const isCameraActive = phase === 'BOX_EVIDENCE' || phase === 'ITEM_INSPECTION';

  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const canvas = visibleCanvasRef.current;
    
    if (isCameraActive && video && canvas) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          video.srcObject = stream;
          
          video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const drawFrame = () => {
              if (video.paused || video.ended) return;
              ctx.save();
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI);
              ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
              ctx.restore();
              reqAnimRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();
            
            try {
              // @ts-ignore
              const canvasStream = canvas.captureStream(30);
              const mr = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
              mediaRecorderRef.current = mr;
              chunksRef.current = [];
              
              mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
              };
              
              mr.onstop = () => {
                if (!isOrderCompleteRef.current) return;
                
                // Instantly transition UI for the user
                setPhase('COMPLETED');

                // Non-blocking fire-and-forget background upload
                const backgroundUpload = async () => {
                  // Capture current values in local scope immediately before any async activity or state resets
                  const activeOrderId = orderIdRef.current;
                  const activeUserId = userIdRef.current;

                  if (!activeOrderId) {
                    console.error('[Background Upload] Aborted: activeOrderId is empty');
                    return;
                  }

                  try {
                    const videoChunks = chunksRef.current.length > 0 
                      ? chunksRef.current 
                      : [new Blob(['empty-video-fallback'], { type: 'video/webm' })];
                      
                    const blob = new Blob(videoChunks, { type: 'video/webm' });
                    
                    const filesToUpload: { key: string, name: string, mimeType: string, lpn?: string, blob: Blob }[] = [];
                    filesToUpload.push({ key: 'file', name: `inspection-${Date.now()}.webm`, mimeType: 'video/webm', blob });
                    
                    let boxCounter = 1;
                    let lpnCounters: Record<string, number> = {};

                    capturedImagesRef.current.forEach((img) => {
                      if (!img.blob || img.blob.size === 0) return; 

                      if (img.type === 'box') {
                        filesToUpload.push({ key: `box_${boxCounter}`, name: `box_${boxCounter}.jpg`, mimeType: 'image/jpeg', blob: img.blob });
                        boxCounter++;
                      } else if ((img.type === 'lpn' || img.type === 'product') && img.id) {
                        // Stop processing images client-side entirely if not 'bad'
                        // Prepare images if marked 'bad' (e.g. starts with 'bad')
                        const status = lpnConditionsRef.current[img.id];
                        if (status && status.startsWith('bad')) {
                          if (!lpnCounters[img.id]) lpnCounters[img.id] = 1;
                          const c = lpnCounters[img.id];
                          filesToUpload.push({ key: `lpn_${img.id}_image_${c}`, name: `lpn_${img.id}_image_${c}.jpg`, mimeType: 'image/jpeg', blob: img.blob, lpn: img.id });
                          lpnCounters[img.id]++;
                        }
                      }
                    });
                    
                    const filesMetaData = filesToUpload.map(f => ({
                      key: f.key,
                      name: f.name,
                      mimeType: f.mimeType,
                      lpn: f.lpn,
                      condition: f.lpn ? lpnConditionsRef.current[f.lpn] : undefined,
                    }));

                    // 1. Initialize Direct Upload — creates the Drive folder structure and returns upload URLs
                    const initRes = await fetch('/api/upload/init', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: activeOrderId, type: 'INSPECTION_VIDEO', filesMetaData }),
                    });

                    if (!initRes.ok) throw new Error("Failed to initialize Google Drive upload");
                    const { uploadUrls, folderLink, orderFolderId } = await initRes.json();

                    // 2. Upload files — video uses silent chunked pipeline, images use existing raw pipeline

                    // Helper: upload a small file (image) via /api/upload/raw with 3 retries
                    const uploadSmallFile = async (f: { key: string, name: string, blob: Blob }, url: string) => {
                      const timeoutMs = Math.max(30000, Math.min(120000, Math.ceil((f.blob.size / 100000) * 1000)));
                      for (let attempt = 1; attempt <= 3; attempt++) {
                        const controller = new AbortController();
                        const tid = setTimeout(() => controller.abort(), timeoutMs);
                        try {
                          const res = await fetch(url, { method: 'PUT', body: f.blob, signal: controller.signal });
                          clearTimeout(tid);
                          if (res.ok) {
                            console.log(`[Queue Upload] Uploaded image ${f.name} on attempt ${attempt}`);
                            return;
                          }
                          console.warn(`[Queue Upload] Attempt ${attempt} failed for ${f.name}: HTTP ${res.status}`);
                        } catch (err: any) {
                          clearTimeout(tid);
                          console.error(`[Queue Upload] Attempt ${attempt} error for ${f.name}:`, err.name === 'AbortError' ? 'Timeout' : err.message);
                        }
                        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
                      }
                      console.error(`[Queue Upload] Gave up on image ${f.name} after 3 attempts.`);
                    };

                    // Helper: chunked upload for the video — splits blob into 5 MB slices
                    const uploadVideoChunked = async (f: { key: string, name: string, mimeType: string, blob: Blob }, targetFolderId: string) => {
                      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
                      const totalChunks = Math.max(1, Math.ceil(f.blob.size / CHUNK_SIZE));
                      const uploadId = crypto.randomUUID();

                      console.log(`[Chunked Upload] Video ${f.name} — ${(f.blob.size / (1024 * 1024)).toFixed(2)} MB split into ${totalChunks} chunks (uploadId=${uploadId})`);

                      for (let i = 0; i < totalChunks; i++) {
                        const start = i * CHUNK_SIZE;
                        const end   = Math.min(start + CHUNK_SIZE, f.blob.size);
                        const chunk = f.blob.slice(start, end);

                        let chunkOk = false;
                        for (let attempt = 1; attempt <= 3; attempt++) {
                          const controller = new AbortController();
                          const tid = setTimeout(() => controller.abort(), 90000); // 90s per 5 MB chunk
                          try {
                            const res = await fetch(
                              `/api/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${i}&totalChunks=${totalChunks}&name=${encodeURIComponent(f.name)}`,
                              { method: 'PUT', body: chunk, signal: controller.signal }
                            );
                            clearTimeout(tid);
                            if (res.ok) {
                              console.log(`[Chunked Upload] Chunk ${i + 1}/${totalChunks} OK on attempt ${attempt}`);
                              chunkOk = true;
                              break;
                            }
                            console.warn(`[Chunked Upload] Chunk ${i + 1}/${totalChunks} attempt ${attempt} failed: HTTP ${res.status}`);
                          } catch (err: any) {
                            clearTimeout(tid);
                            console.error(`[Chunked Upload] Chunk ${i + 1}/${totalChunks} attempt ${attempt}:`, err.name === 'AbortError' ? 'Timeout' : err.message);
                          }
                          if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
                        }

                        if (!chunkOk) {
                          console.error(`[Chunked Upload] Chunk ${i + 1}/${totalChunks} failed after 3 attempts — aborting video upload for ${f.name}.`);
                          return;
                        }
                      }

                      // All chunks received — assemble into one file on server and push to Drive
                      console.log(`[Chunked Upload] All ${totalChunks} chunks uploaded. Assembling ${f.name}...`);
                      try {
                        const assembleRes = await fetch('/api/upload/assemble', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ uploadId, totalChunks, name: f.name, mimeType: f.mimeType, folderId: targetFolderId }),
                        });
                        if (assembleRes.ok) {
                          const data = await assembleRes.json();
                          console.log(`[Chunked Upload] Assembly complete. Drive fileId=${data.fileId}`);
                        } else {
                          const errBody = await assembleRes.json().catch(() => ({}));
                          console.error(`[Chunked Upload] Assembly failed: HTTP ${assembleRes.status}`, errBody);
                        }
                      } catch (err: any) {
                        console.error('[Chunked Upload] Assembly request error:', err.message);
                      }
                    };

                    // Process all files sequentially
                    for (const f of filesToUpload) {
                      if (f.key === 'file') {
                        // Video → chunked pipeline (no body size limit issue)
                        await uploadVideoChunked(f, orderFolderId);
                      } else {
                        // Images → existing raw pipeline
                        const url = uploadUrls[f.key];
                        if (!url) { console.warn(`[Queue Upload] No URL for key: ${f.key}`); continue; }
                        await uploadSmallFile(f, url);
                      }
                    }

                    // 3. Finalize Database Write
                    // Build a map of LPN → condition for the finalize route
                    const lpnConditions: Record<string, string> = { ...lpnConditionsRef.current };

                    const cleanUserId = activeUserId && activeUserId !== 'undefined' && activeUserId !== 'null' ? activeUserId : undefined;
                    await fetch('/api/upload/finalize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        orderId: activeOrderId,
                        folderLink,
                        orderFolderId,
                        type: 'INSPECTION_VIDEO',
                        uploadedById: cleanUserId,
                        reason: 'Complete Order Inspection Folder',
                        lpnConditions,
                      }),
                    });
                    
                    const dockRes = await fetch('/api/dock/receive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        trackingId: activeOrderId,
                        tapeIntact: true,
                        boxCrushed: false,
                        isTampered: false,
                        evidenceUrl: folderLink || 'UPLOAD_FAILED'
                      })
                    });

                    if (!dockRes.ok) throw new Error("Failed to log dock receipt");
                  } catch (e) {
                    console.error('Background pipeline failed:', e);
                  }
                };

                backgroundUpload(); // Trigger without await
              };
              
              mr.start(1000);
              setIsRecording(true);
            } catch (e) {
              console.error("MediaRecorder init failed", e);
            }
          };
        })
        .catch(err => console.error("Camera access denied or unavailable:", err));
    }

    return () => {
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    };
  }, [isCameraActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      setTimeout(() => setRecordingTime(0), 0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const captureImage = (type: 'box' | 'lpn' | 'product', identifier?: string) => {
    if (videoRef.current && hiddenCanvasRef.current) {
      const video = videoRef.current;
      const canvas = hiddenCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();

        // ✅ THE CORRECTED CROP LOGIC
        if (type === 'lpn' || type === 'product') {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width / 2;
          tempCanvas.height = canvas.height;
          const tCtx = tempCanvas.getContext('2d');
          
          if (tCtx) {
            // Cut exactly the right half of the image
            tCtx.drawImage(
              canvas, 
              canvas.width / 2, 0, canvas.width / 2, canvas.height, 
              0, 0, tempCanvas.width, tempCanvas.height
            );
            tempCanvas.toBlob((blob) => {
              // 🐛 FIX: Dynamically use the `type` instead of hardcoding 'lpn'
              if (blob) capturedImagesRef.current.push({ type, id: identifier, blob });
            }, 'image/jpeg', 0.8);
          }
        } else {
          // Full box photo
          canvas.toBlob((blob) => {
            if (blob) capturedImagesRef.current.push({ type, id: identifier, blob });
          }, 'image/jpeg', 0.8);
        }
      }
    }
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);
  };

  const stopAndFinalizeRecording = () => {
    isOrderCompleteRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const triggerXp = (amount: number) => {
    setScore(s => s + amount);
    setStreak(s => s + 1);
    setFloatingXp(amount);
    setTimeout(() => setFloatingXp(null), 1200);
  };

  const resetProcess = () => {
    setPhase('START');
    setOrderId('');
    setBoxStep(1);
    setItemStep(1);
    setItemsProcessed(0);
    setCurrentLpn('');
    setCurrentCategory(null);
    setMissingAcknowledged(false);
    setStreak(0);
    setCurrentCategory(null);
    setSelectedClaimReason(null);
    setSelectedClaimSubReason(null);
    setShowDefectDropdown(false);
    setExpectedItems(0);
    setStartError('');
    isOrderCompleteRef.current = false;
    capturedImagesRef.current = [];
    lpnConditionsRef.current = {};
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setStartError('');

    // Fetch manifest to get dynamic item count
    try {
      const res = await fetch(`/api/manifest/${encodeURIComponent(orderId.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const manifest = data.manifest;
        if (manifest && manifest.returnItems) {
          const itemsWithLpn = manifest.returnItems.filter((ri: any) => ri.lpn);
          const count = itemsWithLpn.length > 0
            ? itemsWithLpn.length
            : manifest.returnItems.reduce((sum: number, ri: any) => sum + (ri.quantity || 1), 0);
          setExpectedItems(Math.max(count, 1));
        } else {
          setExpectedItems(1); // Fallback minimum
        }
      } else {
        // Manifest not found — still allow inspection with fallback count
        setExpectedItems(1);
      }
    } catch {
      setExpectedItems(1);
    }

    setPhase('BOX_EVIDENCE');
    triggerXp(50);
  };

  const nextBoxStep = () => {
    triggerXp(20);
    if (boxStep < 8) {
      setBoxStep(prev => prev + 1);
    } else {
      setPhase('ITEM_INSPECTION');
    }
  };

  const nextItemStep = () => {
    if (itemStep === 1 && currentLpn.trim() === '') return;
    triggerXp(30);
    if (itemStep < 6) {
      setItemStep(prev => prev + 1);
    } else {
      console.warn("Item step out of bounds");
    }
  };

  const CLAIM_REASONS = [
    {
      id: "damaged_used",
      label: "1. I received damaged/ used item(s)",
      subReasons: [
        { value: "heavily_damaged", label: "a. Item(s) heavily damaged" },
        { value: "minor_damages", label: "b. Item(s) with minor damages/dents/scratches" },
        { value: "packaging_damaged", label: "c. Only product packaging damaged" }
      ]
    },
    {
      id: "different_empty",
      label: "2. I received different item or empty box",
      subReasons: [
        { value: "different_junk", label: "a. Different/junk item received" },
        { value: "empty_box", label: "b. Empty box received" },
        { value: "fake_counterfeit", label: "c. Fake/ replica/ counterfeit item received" }
      ]
    },
    {
      id: "not_received",
      label: "3. I did not receive my removal order",
      subReasons: [
        { value: "shipment_lost", label: "a. Entire shipment is lost" },
        { value: "dispute_status", label: "b. Dispute delivery status" }
      ]
    },
    {
      id: "missing_qty",
      label: "4. I received removal order with missing quantity/ accessories/parts",
      subReasons: [
        { value: "missing_units", label: "a. Missing units inside a shipment" },
        { value: "missing_parts", label: "b. Missing parts/accessories/components" },
        { value: "missing_main", label: "c. Missing main item" }
      ]
    }
  ];

  const handleCategory = (cat: 'GOOD' | 'RECOVERY' | 'BAD') => {
    lpnConditionsRef.current[currentLpn] = cat.toLowerCase();
    triggerXp(100);
    setCurrentCategory(cat);
    if (cat === 'BAD') {
      setShowDefectDropdown(true);
      setSelectedClaimReason(null);
      setSelectedClaimSubReason(null);
    } else {
      setShowDefectDropdown(false);
      setSelectedClaimReason(null);
      setSelectedClaimSubReason(null);
      nextItemStep();
    }
  };

  const handleDefectSelected = (reason: string, subReason: string) => {
    setSelectedClaimReason(reason);
    setSelectedClaimSubReason(subReason);
    // Store in format: "bad:REASON::SUB_REASON"
    lpnConditionsRef.current[currentLpn] = `bad:${reason}::${subReason}`;
    setShowDefectDropdown(false);
    nextItemStep();
  };

  const handleBinning = () => {
    triggerXp(50);
    const newProcessed = itemsProcessed + 1;
    setItemsProcessed(newProcessed);
    setCurrentLpn('');
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
    { id: 1, title: 'Top Side',         desc: 'Lay the box flat. Center the TOP face in the camera frame so all 4 edges are visible. Capture when steady.', sampleImg: '/samples/inspector_box_photo.png' },
    { id: 2, title: 'Bottom Side',      desc: 'Flip the box over carefully. Capture the BOTTOM face — look for moisture staining or crushed corners.', sampleImg: '/samples/inspector_box_photo.png' },
    { id: 3, title: 'Front Side',       desc: 'Stand the box upright. Capture the FRONT face — note any dents, tears, or re-taped areas.', sampleImg: null },
    { id: 4, title: 'Back Side',        desc: 'Rotate the box. Capture the BACK face — check for any impact damage or label irregularities.', sampleImg: null },
    { id: 5, title: 'Left Side',        desc: 'Capture the LEFT SIDE of the box — look for crush marks or moisture stains on the edges.', sampleImg: null },
    { id: 6, title: 'Right Side',       desc: 'Capture the RIGHT SIDE — check the seam tape runs continuously without gaps or cuts.', sampleImg: null },
    { id: 7, title: 'Delivery Label',   desc: 'Hold the DELIVERY LABEL clearly to the camera. All text must be readable. Ensure AWB matches scanned number.', sampleImg: null },
    { id: 8, title: 'Remove Slip',      desc: 'Remove the ORDER DETAILS SLIP from inside the box and hold it to the camera. This is your paper audit trail.', sampleImg: null },
  ];

  const ITEM_STEPS = [
    { id: 1, title: 'Scan Item LPN',         instruction: 'Type or scan the LPN barcode number printed on the item sticker. Verify it matches the manifest before proceeding.' },
    { id: 2, title: 'Capture LPN Photo',     instruction: 'Point the camera at the LPN label on the item. Keep the LPN label in the RIGHT HALF of the frame. Hold steady and capture.', sampleImg: '/samples/inspector_lpn_scan.png' },
    { id: 3, title: 'Testing Instructions',  instruction: 'Perform the physical product check below before capturing the image. Ensure no step is skipped.' },
    { id: 4, title: 'Capture Product Image', instruction: 'Place the product in the RIGHT HALF of the camera frame. Capture all visible sides — scratches, dents, missing parts must be visible.', sampleImg: '/samples/inspector_product_photo.png' },
    { id: 5, title: 'Categorize Condition',  instruction: 'Based on your physical test and visual inspection, select the correct condition grade. This determines the bin the item goes into.' },
    { id: 6, title: 'Physical Binning',      instruction: 'Place the item into the labelled bin shown below. Confirm once placed — this cannot be undone without a supervisor override.' },
  ];

  return (
    <div className="absolute inset-0 z-40 flex flex-row bg-slate-900 select-none overflow-hidden text-slate-800">
       
       <div className="w-[60%] bg-black relative flex flex-col items-center justify-center border-r border-slate-800 shadow-2xl">
          <div className="absolute top-4 left-4 bg-red-600/90 backdrop-blur text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 rounded shadow-lg z-10">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span>REC &bull; Continuous Evidence</span>
          </div>
          
          <div className="absolute top-4 right-4 bg-black/70 border border-white/20 text-white px-4 py-2 text-sm font-mono tracking-widest rounded flex items-center space-x-3 z-10 shadow-lg">
            {isRecording && <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>}
            <span>{String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}</span>
          </div>
          
          <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
             <video ref={videoRef} autoPlay playsInline muted className="hidden"></video>
             <canvas ref={visibleCanvasRef} className="absolute inset-0 w-full h-full object-cover bg-black"></canvas>
             <canvas ref={hiddenCanvasRef} className="hidden"></canvas>
             {shutterFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150"></div>}
             
             {/* Split Screen Overlay for Item Inspection */}
             {phase === 'ITEM_INSPECTION' && (
               <div className="absolute inset-0 z-10 pointer-events-none flex">
                 <div className="w-1/2 h-full border-r-2 border-white/40 border-dashed flex items-center justify-center bg-black/20">
                   <span className="text-white/60 font-black text-2xl tracking-widest drop-shadow-lg -rotate-90 md:rotate-0">BOX AREA</span>
                 </div>
                 <div className="w-1/2 h-full flex items-center justify-center">
                   <span className="text-white/60 font-black text-2xl tracking-widest drop-shadow-lg -rotate-90 md:rotate-0">ITEM AREA</span>
                 </div>
               </div>
             )}
          </div>
       </div>

       <div className="w-[40%] bg-white flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
         
         <div className="bg-white border-b border-[#313079]/10 p-4 flex justify-between items-center shrink-0 shadow-sm relative">
            {floatingXp && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-green-500 font-black text-xl animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-none z-50">
                +{floatingXp} XP
              </div>
            )}
            <div className="flex items-center space-x-2">
              <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]"><Zap size={16} fill="currentColor" /></div>
              <div>
                <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">Total Score</p>
                <p className="text-sm font-black font-mono text-[#313079]">{score} XP</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-right">
              <div>
                <p className="text-[9px] uppercase font-bold text-[#313079]/50 tracking-widest">Streak</p>
                <p className="text-sm font-black font-mono text-[#FF6700]">{streak}x</p>
              </div>
              <div className="bg-[#FF6700]/10 p-1.5 rounded text-[#FF6700]"><TrendingUp size={16} /></div>
            </div>
         </div>

         {phase === 'START' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 bg-[#FF6700]/5">
              <div className="bg-[#FF6700]/10 p-4 rounded-full mb-6">
                <ScanEye size={48} className="text-[#FF6700]" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest text-[#313079] mb-1 text-center">Scan Order ID</h2>
              <p className="text-[#313079]/60 font-bold tracking-wider mb-8 uppercase text-xs">To Begin Continuous Evidence</p>
              
              <form onSubmit={handleStart} className="w-full flex flex-col space-y-4 max-w-sm">
                <input 
                  type="text" 
                  placeholder="ENTER ORDER ID..."
                  value={orderId} 
                  onChange={e => setOrderId(e.target.value)}
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
              </form>
            </div>
         )}

         {phase === 'BOX_EVIDENCE' && (
            <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
               <div className="mb-6">
                 <h3 className="text-[10px] uppercase font-black tracking-widest text-[#FF6700] mb-1">Phase 1</h3>
                 <h2 className="text-lg font-black uppercase tracking-widest text-[#313079]">Box Evidence</h2>
               </div>
               
               <div className="flex-1 relative">
                 {BOX_STEPS.map((step, idx) => {
                   const isActive = boxStep === step.id;
                   const isCompleted = boxStep > step.id;
                   const isLast = idx === BOX_STEPS.length - 1;
                   
                   return (
                     <div key={step.id} className="relative pl-8 pb-4">
                       {!isLast && (
                         <div className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? 'bg-[#FF6700]/30' : 'bg-[#313079]/10'}`}></div>
                       )}
                       
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                         isCompleted ? 'bg-[#313079] border-[#313079]' : 
                         isActive ? 'bg-white border-[#FF6700] shadow-[0_0_8px_rgba(255,103,0,0.4)]' : 
                         'bg-white border-[#313079]/15'
                       }`}>
                         {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
                         {isActive && <div className="w-2 h-2 bg-[#FF6700] rounded-full animate-pulse"></div>}
                       </div>
                       
                       <div className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-[#FF6700]' : isCompleted ? 'text-[#313079]/60' : 'text-[#313079]/40'}`}>
                         {step.id}. {step.title}
                       </div>
                       
                       {isActive && (
                         <div className="mt-3 bg-white p-4 rounded-lg border border-[#FF6700]/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                           <p className="text-sm font-medium text-[#313079]/80 leading-relaxed">{step.desc}</p>
                           <StepVisualGuide step={step} />
                           <button 
                             onClick={() => { captureImage('box'); nextBoxStep(); }} 
                             className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex items-center justify-center space-x-2 transition-all"
                           >
                             <Camera size={16} /> <span>Capture Image</span>
                           </button>
                         </div>
                       )}
                     </div>
                   )
                 })}
               </div>
            </div>
         )}

         {phase === 'ITEM_INSPECTION' && (
            <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
               <div className="mb-6 flex justify-between items-start border-b border-[#313079]/10 pb-4">
                 <div>
                   <h3 className="text-[10px] uppercase font-black tracking-widest text-[#FF6700] mb-1">Phase 2</h3>
                   <h2 className="text-lg font-black uppercase tracking-widest text-[#313079] leading-tight">Product Verification</h2>
                 </div>
                 <div className="text-right">
                   <p className="text-[9px] uppercase font-bold tracking-widest text-[#313079]/50 mb-1">Items Processed</p>
                   <p className="text-base font-black font-mono text-[#313079]">{itemsProcessed} <span className="text-[#313079]/40">/ {expectedItems}</span></p>
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
                         <div className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? 'bg-[#FF6700]/30' : 'bg-[#313079]/10'}`}></div>
                       )}
                       
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                         isCompleted ? 'bg-[#313079] border-[#313079]' : 
                         isActive ? 'bg-white border-[#FF6700] shadow-[0_0_8px_rgba(255,103,0,0.4)]' : 
                         'bg-white border-[#313079]/15'
                       }`}>
                         {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
                         {isActive && <div className="w-2 h-2 bg-[#FF6700] rounded-full animate-pulse"></div>}
                       </div>
                       
                       <div className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-[#FF6700]' : isCompleted ? 'text-[#313079]/60' : 'text-[#313079]/40'}`}>
                         {step.id}. {step.title}
                       </div>
                       
                       {isActive && (
                         <div className="mt-3 bg-white p-4 rounded-lg border border-[#FF6700]/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                           
                           {'instruction' in step && step.instruction && (
                             <p className="text-sm font-medium text-[#313079]/80 leading-relaxed">{step.instruction}</p>
                           )}

                           {'sampleImg' in step && step.sampleImg && (
                             <div className="relative w-full h-40 rounded-lg overflow-hidden border border-[#313079]/10 bg-[#FF6700]/5">
                               <img src={step.sampleImg} alt="Reference sample" className="w-full h-full object-cover" />
                               <div className="absolute bottom-0 left-0 right-0 bg-[#FF6700]/80 text-white text-[10px] font-bold uppercase tracking-widest text-center py-1">Reference Sample</div>
                             </div>
                           )}

                           {step.id === 1 && (
                             <div className="space-y-3">
                               <input 
                                 type="text" 
                                 placeholder="SCAN OR TYPE LPN..."
                                 value={currentLpn} 
                                 onChange={e => setCurrentLpn(e.target.value)}
                                 autoFocus
                                 className="w-full min-h-12 bg-white border border-[#313079]/20 text-[#313079] px-4 py-2 text-center text-sm font-mono focus:outline-none focus:border-[#FF6700] uppercase rounded"
                               />
                               <button 
                                 onClick={nextItemStep} 
                                 disabled={!currentLpn.trim()}
                                 className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded disabled:bg-[#313079]/10 disabled:text-[#313079]/40 transition-colors"
                               >
                                 LPN Confirmed →
                               </button>
                             </div>
                           )}

                           {step.id === 2 && (
                             <button 
                               onClick={() => { captureImage('lpn', currentLpn); nextItemStep(); }} 
                               className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all"
                             >
                               <Camera size={16} /> <span>Capture LPN Photo</span>
                             </button>
                           )}

                           {step.id === 3 && (
                             <div className="space-y-3">
                               <ul className="text-[#313079]/80 font-medium space-y-2 text-sm list-none">
                                 <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-0.5">①</span><span>Inspect all corners and surfaces for scratches or cracks.</span></li>
                                 <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-0.5">②</span><span>Verify all mechanical parts and buttons move/click correctly.</span></li>
                                 <li className="flex items-start space-x-2"><span className="text-[#FF6700] font-black mt-0.5">③</span><span>Confirm all accessories listed on the slip are present.</span></li>
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
                               onClick={() => { captureImage('product', currentLpn); nextItemStep(); }} 
                               className="w-full min-h-12 bg-[#FF6700] hover:bg-[#FF6700]/90 active:scale-95 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all"
                             >
                               <Camera size={16} /> <span>Capture Product Image</span>
                             </button>
                           )}

                           {step.id === 5 && !showDefectDropdown && (
                              <div className="flex flex-col space-y-2">
                                <button onClick={() => handleCategory('GOOD')} className="w-full min-h-12 bg-green-600 active:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                   <CheckCircle2 size={18} /> <span>Good — Resellable</span>
                                </button>
                                <button onClick={() => handleCategory('RECOVERY')} className="w-full min-h-12 bg-[#FF6700] active:bg-[#FF6700]/90 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                   <AlertTriangle size={18} /> <span>Recovery — Minor Damage</span>
                                </button>
                                <button onClick={() => handleCategory('BAD')} className="w-full min-h-12 bg-red-600 active:bg-red-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                   <AlertOctagon size={18} /> <span>Bad — Unsalvageable</span>
                                </button>
                              </div>
                            )}

                            {/* Amazon Claim Defect Type Dropdown — appears when BAD is selected */}
                            {step.id === 5 && showDefectDropdown && (
                              <div className="flex flex-col space-y-3">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <p className="text-xs font-black uppercase tracking-widest text-red-700 mb-1">
                                    {selectedClaimReason ? "2) Select Claim Sub-Reason" : "1) Select Claim Reason"}
                                  </p>
                                  <p className="text-[10px] text-red-600 leading-relaxed font-bold">
                                    {selectedClaimReason 
                                      ? `Selected Reason: ${selectedClaimReason}` 
                                      : "Select the primary claim category matching Amazon's IDR portal"}
                                  </p>
                                </div>
                                <div className="space-y-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                                  {!selectedClaimReason ? (
                                    CLAIM_REASONS.map(cr => (
                                      <button
                                        key={cr.id}
                                        onClick={() => setSelectedClaimReason(cr.label)}
                                        className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                                      >
                                        <span className="flex-1 pr-2">{cr.label}</span>
                                        <ArrowRight size={14} className="text-red-400 shrink-0" />
                                      </button>
                                    ))
                                  ) : (
                                    CLAIM_REASONS.find(r => r.label === selectedClaimReason)?.subReasons.map(csr => (
                                      <button
                                        key={csr.value}
                                        onClick={() => handleDefectSelected(selectedClaimReason, csr.label)}
                                        className="w-full min-h-11 bg-white border-2 border-red-200 hover:border-red-500 hover:bg-red-50 text-[#313079] text-sm font-bold rounded flex items-center justify-between px-4 py-2 transition-all text-left active:scale-[0.98]"
                                      >
                                        <span className="flex-1 pr-2">{csr.label}</span>
                                        <ArrowRight size={14} className="text-red-400 shrink-0" />
                                      </button>
                                    ))
                                  )}
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
                                      onClick={() => { setShowDefectDropdown(false); setCurrentCategory(null); }}
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
                                 <p className="text-sm font-bold text-[#313079]/60 uppercase tracking-widest mb-2">Place item in</p>
                                 <p className={`text-3xl font-black uppercase tracking-widest ${currentCategory === 'GOOD' ? 'text-green-600' : currentCategory === 'RECOVERY' ? 'text-[#FF6700]' : 'text-red-600'}`}>
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
                   )
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

         {phase === 'COMPLETED' && (
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-green-50 animate-in fade-in zoom-in-95 duration-300 text-center">
              <div className="bg-green-100 p-6 rounded-full mb-6 shadow-inner border-4 border-green-200">
                <CheckCircle2 size={64} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-green-700 uppercase tracking-widest mb-3">
                Order Complete
              </h2>
              <p className="text-green-600 text-xs font-bold tracking-widest uppercase mb-10 bg-white px-4 py-2 rounded-full shadow-sm">
                Video recording saved
              </p>
              
              {missingAcknowledged && (
                <div className="bg-[#FFF700]/15 border border-[#FFF700]/50 text-[#313079] p-4 rounded-lg mb-8 flex items-center space-x-3 w-full justify-center text-left">
                  <AlertTriangle size={20} className="shrink-0 text-[#FF6700]" />
                  <span className="font-bold uppercase tracking-wider text-xs">Missing items flagged for claims</span>
                </div>
              )}

              <button 
                onClick={resetProcess} 
                className="w-full max-w-xs min-h-14 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-black uppercase tracking-[0.15em] rounded-lg shadow-lg flex items-center justify-center space-x-3 transition-transform active:scale-95"
              >
                <span>Process Next Order</span> 
                <ArrowRight size={18} />
              </button>
            </div>
         )}
       </div>
    </div>
  );
}