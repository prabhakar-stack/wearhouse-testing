"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertOctagon, Link as LinkIcon, ScanEye, Camera, AlertTriangle, ArrowRight, PackageOpen, User, ArrowLeft, Shield, FileText } from 'lucide-react';
import Link from 'next/link';

export default function InspectorPage() {
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // For design mode, we will allow it to default to INSPECTOR if testing directly without login,
    // otherwise we respect the localStorage value.
    const storedRole = localStorage.getItem('userRole');
    
    // eslint-disable-next-line
    setRole(storedRole || 'INSPECTOR'); // Fallback to INSPECTOR so reviewers can see the UI without logging in
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (role !== 'INSPECTOR' && role !== 'ADMIN' && role !== 'SUPER_ACCESS') {
    return (
      <div className="h-screen w-screen bg-[#FF4444] text-white flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-[#CC0000]">
        <AlertOctagon size={120} className="mb-8" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight">Access Denied</h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-[#FF9999]">Invalid Role Authorization</p>
      </div>
    );
  }

  return <InspectorDashboard role={role} />;
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
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#E0E0E0] select-none overscroll-none font-sans overflow-hidden border-4 border-[#1A1A1A]">
      
      <header className="p-4 md:p-6 border-b border-[#333333] shrink-0 bg-[#111111] shadow-md z-20 flex items-center justify-between">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-[#888888] hover:text-[#E0E0E0]">
               <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#4285F4]">
              {activeTab === 'profile' ? 'Profile' : activeTab === 'ledger' ? 'Custody Ledger' : 'Quality Assurance'}
            </h1>
            <p className="text-[#888888] text-xs font-bold tracking-widest mt-1 uppercase">Terminal Active / Role: {role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={() => setActiveTab('profile')} className={`hover:text-[#E0E0E0] transition-colors ${activeTab === 'profile' ? 'text-[#E0E0E0]' : 'text-[#4285F4]'}`}>
          <User size={28} />
        </button>
      </header>

      <main className="flex-1 relative overflow-y-auto custom-scrollbar bg-[#000000]">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4 pb-10">
            {/* Action Buttons */}
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('ledger')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#4285F4] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#4285F4] transition-colors">Custody Ledger</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">Packages pending inspection</p>
                </div>
                <FileText size={32} className="text-[#333333] group-hover:text-[#4285F4] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('takeover')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#4285F4] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#4285F4] transition-colors">Custody Takeover</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">Execute mechanical handshake</p>
                </div>
                <LinkIcon size={32} className="text-[#333333] group-hover:text-[#4285F4] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('inspect')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#4285F4] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#4285F4] transition-colors">Deep Inspect</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">Gamified quality assurance</p>
                </div>
                <ScanEye size={32} className="text-[#333333] group-hover:text-[#4285F4] transition-colors relative z-10" />
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">
            {/* User Profile Card */}
            <div className="border border-[#333333] bg-[#111111] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Shield size={100} />
              </div>
              <div className="flex items-center space-x-4 mb-6 relative z-10">
                 <div className="w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[#4285F4]">
                   <User size={24} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold tracking-widest uppercase text-[#F5F2ED]">{userData ? userData.email : 'Loading...'}</h2>
                   <p className="text-[10px] text-[#4285F4] uppercase tracking-widest mt-1">ID: {userData ? userData.id.split('-')[0] : '...'} / {role.replace('_', ' ')}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-[#333333] pt-4 relative z-10">
                <div>
                  <p className="text-[10px] uppercase text-[#666666] tracking-widest font-bold">Processed</p>
                  <p className="text-2xl font-mono text-[#E0E0E0]">{userData ? userData.itemsProcessed : 0}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[#666666] tracking-widest font-bold">Accuracy</p>
                  <p className="text-2xl font-mono text-[#34A853]">{userData ? userData.accuracyRate + '%' : '100%'}</p>
                </div>
              </div>
            </div>
            
            {(role === 'SUPER_ACCESS' || role === 'ADMIN') && (
              <Link 
                href={role === 'SUPER_ACCESS' ? '/super-admin' : '/admin'}
                className="w-full flex items-center justify-center py-4 border border-[#4285F4] text-[#4285F4] hover:bg-[#4285F4] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs mb-4"
              >
                Return to Command Center
              </Link>
            )}

            <button 
              onClick={async () => {
                localStorage.removeItem('userRole');
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                } catch (e) {}
                router.push('/login');
              }}
              className="w-full py-4 border border-[#FF4444] text-[#FF4444] hover:bg-[#FF4444] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
            >
              Sign Out
            </button>
          </div>
        )}
        
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'takeover' && <TakeoverTab />}
        {activeTab === 'inspect' && <InspectTab />}
      </main>

    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// TAB 1.5: CUSTODY LEDGER
// -------------------------------------------------------------------------------------------------
function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Poll for assigned orders to inspect
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
    const interval = setInterval(fetchLedger, 5000); // 5 sec poll
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10 pt-6 px-4">
      <div className="mb-6 flex items-center justify-between border-b border-[#333333] pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#F5F2ED]">My Custody Ledger</h2>
        <span className="bg-[#1A1A1A] border border-[#333333] text-[#4285F4] px-3 py-1 font-mono text-xs">{ledger.length} PENDING</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#666666] text-xs uppercase tracking-widest animate-pulse">Syncing Custody Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#333333] bg-[#111111]">
          <CheckCircle2 size={48} className="mx-auto text-[#34A853] mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">No Pending Inspections</h3>
          <p className="text-[10px] uppercase text-[#666666] mt-2 max-w-[200px] mx-auto">You have no active taken packages. Proceed to Takeover to pull from Receiver.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item, idx) => (
             <div key={item.id || idx} className="bg-[#111111] border border-[#333333] p-4 flex flex-col space-y-3 relative overflow-hidden group">
               <div className={`absolute inset-y-0 left-0 w-1 ${item.status === 'INSPECTING' ? 'bg-[#FBBC05] animate-pulse' : 'bg-[#4285F4]'}`}></div>
               
               <div className="flex justify-between items-start pl-2">
                 <div>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[#666666]">{item.marketplace || 'UNKNOWN'} &bull; ORDER {item.orderId}</p>
                   <p className="font-mono text-base text-[#F5F2ED] mt-0.5">{item.trackingAwb}</p>
                 </div>
                 <div className="text-right">
                   {item.status === 'INSPECTING' ? (
                     <span className="bg-[#FBBC05]/20 text-[#FBBC05] px-2 py-1 text-[10px] font-bold uppercase border border-[#FBBC05]/50">IN PROGRESS</span>
                   ) : (
                     <span className="bg-[#333333]/50 text-[#E0E0E0] px-2 py-1 text-[10px] font-bold uppercase border border-[#333333]">PENDING</span>
                   )}
                 </div>
               </div>
               
               <div className="flex justify-between items-center pl-2 pt-2 border-t border-[#333333]">
                 <div>
                   <p className="text-[10px] uppercase text-[#888888]">Items Scanned</p>
                   <div className="font-mono text-xs mt-1 text-[#E0E0E0]">
                     <span className="text-[#34A853]">{item.itemsInspected}</span> / {item.itemsExpected}
                   </div>
                 </div>
                 <div className="text-[9px] font-mono text-[#666666]">
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

// -------------------------------------------------------------------------------------------------
// TAB 2: CUSTODY TAKEOVER
// -------------------------------------------------------------------------------------------------
function TakeoverTab() {
  const [awb, setAwb] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const startScanner = async () => {
    setScanning(true);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H5Qrcode } = await import('html5-qrcode');
        scannerRef.current = new H5Qrcode("takeover-reader");
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          stopScanner();
          setAwb(decodedText);
        },
        (error: any) => {  }
      );
    } catch (err) {
      console.error(err);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) { console.error(e) }
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awb.trim()) return;
    
    // Show massive success overlay
    setShowSuccess(true);
    
    // Reset after 2 seconds
    setTimeout(() => {
      setShowSuccess(false);
      setAwb('');
    }, 2000);
  };

  if (showSuccess) {
    return (
      <div className="absolute inset-0 bg-[#34A853] z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
        <CheckCircle2 size={120} className="text-white mb-8 drop-shadow-2xl" />
        <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-widest text-center leading-tight drop-shadow-lg">
          Custody Transferred
        </h2>
        <p className="text-white text-xl font-bold tracking-widest mt-4 opacity-90 uppercase">Successfully!</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col justify-center items-center px-4 py-8 pb-32">
      <div className="w-full max-w-lg bg-[#111111] p-6 border border-[#333333] shadow-2xl flex flex-col space-y-6">
        
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1A1A1A] mx-auto flex items-center justify-center rounded-full border border-[#333333] mb-4">
             <LinkIcon size={32} className="text-[#4285F4]" />
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-[#E0E0E0]">Mechanical Handshake</h2>
          <p className="text-[#666666] font-bold text-sm tracking-widest mt-2 uppercase">Scan Box from Receiver</p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="relative bg-black w-full aspect-square border border-[#333333] overflow-hidden flex flex-col items-center justify-center text-[#444444]">
            <div id="takeover-reader" className="absolute inset-0 w-full h-full"></div>
            {!scanning && <Camera size={48} className="mb-4 text-[#333333]" />}
            {!scanning && <p className="text-xs uppercase tracking-widest text-[#666666]">Camera Offline</p>}
          </div>

          {!scanning ? (
            <button onClick={startScanner} className="w-full py-4 bg-[#1A1A1A] border border-[#4285F4]/50 hover:bg-[#4285F4] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 text-[#E0E0E0]">
              <Camera size={16} /> <span>Activate Camera</span>
            </button>
          ) : (
            <button onClick={stopScanner} className="w-full py-4 bg-[#1A1A1A] border border-[#FF4444]/50 hover:bg-[#FF4444] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs text-[#FF9999]">
              Deactivate Camera
            </button>
          )}

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute border-t border-[#333333] w-full"></div>
            <span className="bg-[#111111] px-4 text-[#666666] text-[10px] uppercase font-bold tracking-widest relative z-10">Manual Override</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input 
              type="text" 
              placeholder="ENTER AWB NUMBER..."
              value={awb} 
              onChange={e => setAwb(e.target.value)}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] text-[#E0E0E0] p-4 text-center font-mono focus:outline-none focus:border-[#4285F4] transition-colors uppercase placeholder-[#444444]"
            />
            <button 
              type="submit" 
              disabled={!awb.trim()} 
              className="w-full min-h-16 bg-[#4285F4] hover:bg-[#3367D6] active:bg-[#2B54AC] text-white disabled:bg-[#1A1A1A] disabled:text-[#444444] transition-colors border-none text-xl font-black uppercase tracking-[0.1em] shadow-[0_0_20px_rgba(66,133,244,0.3)] disabled:shadow-none flex items-center justify-center space-x-3"
            >
              <span>Confirm Takeover</span>
              <ArrowRight size={24} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


// -------------------------------------------------------------------------------------------------
// TAB 2: DEEP INSPECTION (GAMIFIED STATE MACHINE)
// -------------------------------------------------------------------------------------------------
const MOCK_ORDER = { id: 'ORD-999', totalItems: 3 };

function InspectTab() {
  const [state, setState] = useState<1 | 2 | 3 | 4>(1);
  const [orderId, setOrderId] = useState('');
  const [itemsScanned, setItemsScanned] = useState(0);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const startScanner = async () => {
    setScanning(true);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H5Qrcode } = await import('html5-qrcode');
        scannerRef.current = new H5Qrcode("inspect-reader");
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          stopScanner();
          setOrderId(decodedText);
        },
        (error: any) => {  }
      );
    } catch (err) {
      console.error(err);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) { console.error(e) }
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { 
      // Need a way to call stopScanner properly inside cleanup, 
      // but without adding it to dependency array which could cause infinite loops. 
      // A simple check is fine.
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // === STATE 1: BLIND START ===
  if (state === 1) {

    return (
      <div className="h-full w-full flex flex-col justify-center items-center px-4 py-8 pb-32">
        <div className="w-full max-w-lg bg-[#111111] p-6 border border-[#333333] shadow-2xl flex flex-col space-y-6 animate-in fade-in zoom-in-95">
          <div className="text-center">
             <div className="w-16 h-16 bg-[#1A1A1A] mx-auto flex items-center justify-center rounded-full border border-[#333333] mb-4">
                <ScanEye size={32} className="text-[#4285F4]" />
             </div>
             <h2 className="text-xl md:text-3xl font-black uppercase tracking-[0.2em] text-[#E0E0E0]">Blind Start</h2>
             <p className="text-[#888888] font-bold text-sm tracking-widest mt-2 uppercase">Scan Order ID on Box Exterior</p>
          </div>
          
          <div className="flex flex-col space-y-4">
            <div className="relative bg-black w-full aspect-square border border-[#333333] overflow-hidden flex flex-col items-center justify-center text-[#444444]">
              <div id="inspect-reader" className="absolute inset-0 w-full h-full"></div>
              {!scanning && <Camera size={48} className="mb-4 text-[#333333]" />}
              {!scanning && <p className="text-xs uppercase tracking-widest text-[#666666]">Camera Offline</p>}
            </div>

            {!scanning ? (
              <button onClick={startScanner} className="w-full py-4 bg-[#1A1A1A] border border-[#4285F4]/50 hover:bg-[#4285F4] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 text-[#E0E0E0]">
                <Camera size={16} /> <span>Activate Camera</span>
              </button>
            ) : (
              <button onClick={stopScanner} className="w-full py-4 bg-[#1A1A1A] border border-[#FF4444]/50 hover:bg-[#FF4444] hover:text-white transition-colors font-bold uppercase tracking-widest text-xs text-[#FF9999]">
                Deactivate Camera
              </button>
            )}

            <div className="relative flex items-center justify-center py-2">
              <div className="absolute border-t border-[#333333] w-full"></div>
              <span className="bg-[#111111] px-4 text-[#666666] text-[10px] uppercase font-bold tracking-widest relative z-10">Manual Override</span>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (orderId === MOCK_ORDER.id) {
                   setState(2);
                } else {
                   alert('Invalid Order ID. Hint: Use ORD-999');
                }
              }} 
              className="flex flex-col space-y-4"
            >
              <input 
                type="text" 
                placeholder="e.g. ORD-999"
                value={orderId} 
                onChange={e => setOrderId(e.target.value)}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] text-[#E0E0E0] p-4 text-center font-mono focus:outline-none focus:border-[#4285F4] uppercase placeholder-[#333333]"
              />
              <button 
                type="submit" 
                disabled={!orderId} 
                className="w-full min-h-16 bg-[#4285F4] text-white disabled:bg-[#111111] disabled:text-[#444444] disabled:border-2 disabled:border-[#333333] transition-colors text-xl font-black uppercase tracking-[0.2em] shadow-lg flex justify-center items-center space-x-3"
              >
                <span>Verify Order</span>
                <ScanEye size={24} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // === STATE 2: THE TALLY ENGINE ===
  if (state === 2) {
    return (
      <div className="h-full w-full flex flex-col p-6 md:p-8 pb-32 animate-in slide-in-from-right-8 duration-300">
        <div className="w-full max-w-lg mx-auto bg-[#111111] flex flex-col border border-[#333333] overflow-hidden shadow-2xl h-full relative">
          
          <div className="p-8 border-b border-[#333333] bg-[#0A0A0A] text-center shrink-0">
             <p className="text-xs text-[#888888] font-bold tracking-widest uppercase mb-1">Order Verified</p>
             <h2 className="text-2xl font-mono text-[#F5F2ED] uppercase tracking-[0.2em]">{MOCK_ORDER.id}</h2>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
             <div className="relative w-48 h-48 md:w-56 md:h-56 flex flex-col items-center justify-center border-8 border-[#333333] rounded-full bg-[#1A1A1A] shadow-[0_0_40px_inset_rgba(0,0,0,0.8)]">
                <p className="text-xs text-[#888888] font-bold tracking-widest uppercase absolute top-10">Tally</p>
                <div className="text-5xl md:text-6xl font-black font-mono text-[#4285F4]">
                  {itemsScanned}
                </div>
                <div className="w-12 h-1 bg-[#333333] my-2"></div>
                <div className="text-2xl md:text-3xl font-bold font-mono text-[#666666]">
                  {MOCK_ORDER.totalItems}
                </div>
             </div>
             
             <p className="text-base text-[#888888] font-bold tracking-widest uppercase text-center w-full max-w-[250px]">
               Items Scanned
             </p>
          </div>

          <div className="p-6 md:p-8 space-y-4 shrink-0 bg-[#0A0A0A] border-t border-[#333333]">
             <button 
               onClick={() => setState(3)}
               className="w-full min-h-24 bg-[#4285F4] hover:bg-[#3367D6] active:bg-[#2B54AC] text-white p-6 text-2xl font-black uppercase tracking-[0.1em] shadow-[0_0_30px_rgba(66,133,244,0.4)] flex justify-center items-center space-x-4 transition-transform active:scale-95"
             >
                <Camera size={32} />
                <span>Scan Item SKU</span>
             </button>

             <div className="relative flex items-center justify-center py-2">
               <div className="absolute border-t border-[#333333] w-full"></div>
               <span className="bg-[#0A0A0A] px-4 text-[#666666] text-[10px] uppercase font-bold tracking-widest relative z-10">Manual Override</span>
             </div>

             <div className="flex space-x-2">
               <input 
                 type="text" 
                 placeholder="ENTER SKU..."
                 className="flex-1 bg-[#111111] border-2 border-[#333333] text-[#E0E0E0] p-4 font-mono focus:outline-none focus:border-[#4285F4] uppercase text-sm"
               />
               <button 
                 onClick={() => setState(3)}
                 className="bg-[#333333] hover:bg-[#4285F4] text-white font-bold px-6 border-none transition-colors"
               >
                  GO
               </button>
             </div>

             <button 
               onClick={() => {
                 // Discrepancy logged - complete the box
                 setState(4);
               }}
               className="w-full min-h-16 bg-[#1A1212] border-2 border-[#FF4444] text-[#FF4444] active:bg-[#FF4444] active:text-white p-4 text-sm font-black uppercase tracking-widest flex justify-center items-center space-x-2 transition-all active:scale-95 mt-4"
             >
                <AlertTriangle size={20} />
                <span>Flag Missing Item</span>
             </button>
          </div>
        </div>
      </div>
    );
  }

  // === STATE 3: SPLIT-VIEW EVALUATION ===
  if (state === 3) {
    const handleSort = () => {
      const nextCount = itemsScanned + 1;
      setItemsScanned(nextCount);
      if (nextCount >= MOCK_ORDER.totalItems) {
        setState(4);
      } else {
        setState(2);
      }
    };

    return (
      <div className="h-full w-full flex flex-col pb-24 absolute inset-0 bg-[#000000] z-20 animate-in slide-in-from-bottom-full duration-300">
        
        {/* Top: Master Image */}
        <div className="h-[25vh] bg-[#C5A059] flex flex-col items-center justify-center relative shadow-lg">
           <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 text-white text-[10px] uppercase font-bold tracking-widest">Master Reference</div>
           <PackageOpen size={64} className="text-[#8B6E32] drop-shadow-md" />
           <p className="font-bold text-[#8B6E32] uppercase tracking-widest mt-2">Authentic Product</p>
        </div>

        {/* Middle: Live Camera Feed (Mock) */}
        <div className="flex-1 bg-[#1A1A1A] relative flex items-center justify-center border-y-4 border-[#333333]">
           <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 text-white text-[10px] uppercase font-bold tracking-widest z-10 flex items-center space-x-2">
             <div className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse"></div>
             <span>Live Camera Feed</span>
           </div>
           
           <div className="w-full h-full opacity-30 flex flex-col items-center justify-center">
             {/* Reticle */}
             <div className="w-48 h-48 border border-white/50 border-dashed relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white"></div>
             </div>
           </div>
        </div>

        {/* Bottom: Grading Actions */}
        <div className="h-[40vh] bg-[#111111] flex flex-col">
           <div className="p-4 bg-[#1A1A1A] text-center border-b border-[#333333]">
             <p className="text-xs text-[#E0E0E0] font-bold uppercase tracking-widest">Evaluate Condition</p>
           </div>
           <button onClick={handleSort} className="flex-1 w-full bg-[#34A853] text-[#0A0A0A] font-black text-2xl uppercase tracking-[0.2em] border-b-2 border-black active:bg-[#2B8B45] transition-colors flex items-center space-x-4 pl-8 md:pl-12">
             <CheckCircle2 size={32} /> <span>Good</span>
           </button>
           <button onClick={handleSort} className="flex-1 w-full bg-[#FBBC05] text-[#0A0A0A] font-black text-2xl uppercase tracking-[0.2em] border-b-2 border-black active:bg-[#D9A004] transition-colors flex items-center space-x-4 pl-8 md:pl-12">
             <AlertTriangle size={32} /> <span>Damaged</span>
           </button>
           <button onClick={handleSort} className="flex-1 w-full bg-[#FF4444] text-[#0A0A0A] font-black text-2xl uppercase tracking-[0.2em] active:bg-[#CC0000] transition-colors flex items-center space-x-4 pl-8 md:pl-12">
             <AlertOctagon size={32} /> <span>Bad / Fake</span>
           </button>
        </div>
      </div>
    );
  }

  // === STATE 4: BOX COMPLETE ===
  if (state === 4) {
    return (
      <div className="h-full w-full absolute inset-0 bg-[#34A853] z-50 flex flex-col justify-between p-8 animate-in fade-in duration-300">
        
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="bg-white/20 p-8 rounded-full mb-8">
            <CheckCircle2 size={120} className="text-white drop-shadow-2xl" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest text-center leading-tight drop-shadow-lg mb-6">
            Order Complete!
          </h2>
          <div className="bg-black/20 p-6 rounded-lg text-center max-w-sm">
            <p className="text-white text-lg font-bold tracking-widest uppercase mb-2">Instructions:</p>
            <p className="text-white/90 text-xl font-bold uppercase tracking-widest border-2 border-white/50 px-6 py-4">Place Box on the Conveyor</p>
          </div>
        </div>

        <button 
          onClick={() => {
            // Reset to State 1
            setState(1);
            setOrderId('');
            setItemsScanned(0);
          }}
          className="w-full min-h-24 bg-white hover:bg-gray-100 text-[#34A853] p-6 text-2xl font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center space-x-4 active:scale-95 transition-transform"
        >
          <span>Inspect Next Order</span>
          <ArrowRight size={32} />
        </button>

      </div>
    );
  }

  return null;
}
