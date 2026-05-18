"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, QrCode, Search, AlertOctagon, CheckCircle2, CopyCheck, AlertTriangle, FileText, Check, Box, User, ArrowLeft, Activity, Shield } from 'lucide-react';
import Link from 'next/link';

export default function ReceiverDashboard({ userId, role }: { userId: string, role: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'home' | 'receive' | 'ledger' | 'profile' | 'expected'>('home');
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
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#E0E0E0] select-none font-sans overflow-hidden">
      
      {/* Header */}
      <header className="p-4 border-b border-[#333333] shrink-0 bg-[#111111] flex items-center justify-between">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-[#888888] hover:text-[#E0E0E0]">
               <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-[#C5A059]">
              {activeTab === 'home' ? 'Receiver Hub' : activeTab === 'receive' ? 'Package Intake' : activeTab === 'profile' ? 'Profile' : activeTab === 'expected' ? 'Expected' : 'Custody Ledger'}
            </h1>
            <p className="text-[10px] uppercase text-[#888888] tracking-wider mt-1">Terminal Active &bull; {role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={() => setActiveTab('profile')} className={`hover:text-[#E0E0E0] transition-colors ${activeTab === 'profile' ? 'text-[#E0E0E0]' : 'text-[#C5A059]'}`}>
          <User size={28} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0A0A] p-4 lg:p-6 pb-10 relative">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">
            {/* Action Buttons */}
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('expected')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#4285F4] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#4285F4] transition-colors">Expected Deliveries</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">Packages expected today</p>
                </div>
                <FileText size={32} className="text-[#333333] group-hover:text-[#4285F4] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('receive')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#C5A059] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#C5A059]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#C5A059] transition-colors">Receive Package</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">Launch camera scanner sequence</p>
                </div>
                <QrCode size={32} className="text-[#333333] group-hover:text-[#C5A059] transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('ledger')}
                className="w-full relative group border border-[#333333] bg-[#111111] hover:border-[#34A853] transition-all p-6 text-left flex items-center justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#34A853]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[#E0E0E0] group-hover:text-[#34A853] transition-colors">Handover Ledger</h3>
                  <p className="text-xs text-[#666666] mt-1 font-mono uppercase tracking-wider">View active custody stack</p>
                </div>
                <Box size={32} className="text-[#333333] group-hover:text-[#34A853] transition-colors relative z-10" />
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">
            <div className="border border-[#333333] bg-[#111111] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Shield size={100} />
              </div>
              <div className="flex items-center space-x-4 mb-6 relative z-10">
                 <div className="w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[#C5A059]">
                   <User size={24} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold tracking-widest uppercase text-[#F5F2ED]">{userData ? userData.email : 'Loading...'}</h2>
                   <p className="text-[10px] text-[#C5A059] uppercase tracking-widest mt-1">ID: {userData ? userData.id.split('-')[0] : '...'} / {role.replace('_', ' ')}</p>
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
                className="w-full flex items-center justify-center py-4 border border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-colors font-bold uppercase tracking-widest text-xs mb-4"
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

        {activeTab === 'expected' && <ExpectedTab />}
        {activeTab === 'receive' && <ReceiveTab />}
        {activeTab === 'ledger' && <LedgerTab />}
      </main>

    </div>
  );
}

function ExpectedTab() {
  const [expected, setExpected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Poll every 10 seconds for updates
    const fetchExpected = () => {
      fetch('/api/dock/expected')
        .then(r => r.json())
        .then(d => {
          if (d.expected) setExpected(d.expected);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchExpected();
    const interval = setInterval(fetchExpected, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between border-b border-[#333333] pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#F5F2ED]">Expected Today</h2>
        <span className="bg-[#1A1A1A] border border-[#333333] text-[#4285F4] px-3 py-1 font-mono text-xs">{expected.length} INBOUND</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#666666] text-xs uppercase tracking-widest animate-pulse">Syncing Inbound Ledger...</div>
      ) : expected.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#333333] bg-[#111111]">
          <CheckCircle2 size={48} className="mx-auto text-[#34A853] mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">No Expected Deliveries</h3>
          <p className="text-[10px] uppercase text-[#666666] mt-2 max-w-[200px] mx-auto">There are no packages expected to arrive.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expected.map((item, idx) => {
            // Check issues based on status or delays
            let issueLvl = 0;
            // E.g. we might have late arrivals. If it was dispatched more than 2 days ago? Just mocking.
            const dispatched = new Date(item.expectedDate || new Date());
            const now = new Date();
            const hoursDiff = (now.getTime() - dispatched.getTime()) / (1000 * 3600);
            if (hoursDiff > 48) issueLvl = 4;
            else if (hoursDiff > 24) issueLvl = 2;

            const marketplace = item.returnItems?.[0]?.order?.marketplace || 'UNKNOWN';

            return (
               <div key={item.id || idx} className={`bg-[#111111] border ${issueLvl > 0 ? 'border-[#FF4444]' : 'border-[#333333]'} p-4 flex flex-col space-y-3 relative overflow-hidden group`}>
                 <div className={`absolute inset-y-0 left-0 w-1 ${issueLvl === 4 ? 'bg-[#FF4444] animate-pulse' : issueLvl > 0 ? 'bg-[#FBBC05]' : 'bg-[#4285F4]'}`}></div>
                 
                 <div className="flex justify-between items-start pl-2">
                   <div>
                     <p className="text-[9px] font-bold uppercase tracking-widest text-[#666666]">{marketplace}</p>
                     <p className="font-mono text-base text-[#F5F2ED] mt-0.5">{item.trackingAwb}</p>
                   </div>
                   <div className="text-right">
                     {issueLvl === 4 ? (
                       <span className="bg-[#FF4444]/20 text-[#FF4444] px-2 py-1 text-[10px] font-bold uppercase border border-[#FF4444]/50">L4 ALERT</span>
                     ) : issueLvl > 0 ? (
                       <span className="bg-[#FBBC05]/20 text-[#FBBC05] px-2 py-1 text-[10px] font-bold uppercase border border-[#FBBC05]/50">DELAYED</span>
                     ) : (
                       <span className="text-[#34A853] text-[10px] font-bold uppercase">ON TIME</span>
                     )}
                   </div>
                 </div>
                 {issueLvl === 4 && (
                   <p className="text-[#FF4444] text-[10px] font-bold uppercase pl-2 mt-2 bg-[#FF4444]/10 p-2 border border-[#FF4444]/20">Missing Logs: Courier delivered but no scan log</p>
                 )}
               </div>
            )
          })}
        </div>
      )}
    </div>
  );
}

function ReceiveTab() {
  const [trackingAwb, setTrackingAwb] = useState('');
  const [scannedAwb, setScannedAwb] = useState('');
  
  // Health checks
  const [tapeIntact, setTapeIntact] = useState(true);
  const [boxCrushed, setBoxCrushed] = useState(false);
  const [isTampered, setIsTampered] = useState(false);
  
  // Form extra fields
  const [otpProvided, setOtpProvided] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{type: 'success' | 'error' | 'damage', msg: string} | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const isDamaged = !tapeIntact || boxCrushed || isTampered;

  const startScanner = async () => {
    setScanning(true);
    setBanner(null);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H5Qrcode } = await import('html5-qrcode');
        scannerRef.current = new H5Qrcode("reader");
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          stopScanner();
          setScannedAwb(decodedText);
          setTrackingAwb(decodedText);
        },
        (error: any) => {  }
      );
    } catch (err) {
      console.error(err);
      setBanner({type: 'error', msg: 'Camera initialization failed.'});
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

  const handleManualSearch = (e: any) => {
    e.preventDefault();
    if(trackingAwb.trim()) {
      setScannedAwb(trackingAwb.trim());
      setBanner(null);
    }
  };

  const handleSubmit = async () => {
    if (!scannedAwb) return;
    setLoading(true);
    setBanner(null);
    try {
      const payload = {
        trackingAwb: scannedAwb,
        tapeIntact,
        boxCrushed,
        isTampered,
        otpProvided: isDamaged ? '' : otpProvided,
        evidenceUrl: isDamaged ? evidenceUrl : ''
      };

      const res = await fetch('/api/dock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setBanner({type: 'error', msg: data.error});
      } else if (res.status === 202) {
        setBanner({type: 'damage', msg: data.message});
        resetForm();
      } else {
        setBanner({type: 'success', msg: data.message});
        resetForm();
      }
    } catch (err: any) {
      setBanner({type: 'error', msg: 'Network Error.'});
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setScannedAwb('');
    setTrackingAwb('');
    setTapeIntact(true);
    setBoxCrushed(false);
    setIsTampered(false);
    setOtpProvided('');
    setEvidenceUrl('');
  };

  return (
    <div className="flex flex-col space-y-6 max-w-lg mx-auto pb-10">
      
      {banner && (
        <div className={`p-6 border-l-4 ${banner.type === 'success' ? 'bg-[#111111] border-[#34A853]' : banner.type === 'damage' ? 'bg-[#1A1111] border-[#FF4444]' : 'bg-[#111111] border-[#FF4444]'} flex items-start space-x-4 shadow-xl`}>
          {banner.type === 'success' ? <CheckCircle2 className="text-[#34A853] shrink-0" size={24} /> : <AlertOctagon className="text-[#FF4444] shrink-0" size={24} />}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-widest ${banner.type === 'success' ? 'text-[#34A853]' : 'text-[#FF4444]'}`}>
              {banner.type === 'success' ? 'Delivery Accepted' : banner.type === 'damage' ? 'Damage Alert Logged' : 'Scan Error'}
            </h4>
            <p className="text-[#E0E0E0] mt-1 text-sm font-mono">{banner.msg}</p>
          </div>
        </div>
      )}

      {!scannedAwb ? (
        <div className="border border-[#333333] bg-[#111111] p-6 lg:p-8 flex flex-col space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-[#C5A059] font-medium">Scan Package</h2>
            <p className="text-xs text-[#888888]">Position tracking AWB in frame.</p>
          </div>
          
          <div className="relative bg-black w-full aspect-square border border-[#333333] overflow-hidden flex flex-col items-center justify-center text-[#444444]">
            <div id="reader" className="absolute inset-0 w-full h-full"></div>
            {!scanning && <Camera size={48} className="mb-4 text-[#333333]" />}
            {!scanning && <p className="text-xs uppercase tracking-widest text-[#666666]">Camera Offline</p>}
          </div>

          {!scanning ? (
            <button onClick={startScanner} className="w-full py-4 bg-[#1A1A1A] border border-[#C5A059]/50 hover:bg-[#C5A059] hover:text-black transition-colors font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 text-[#E0E0E0]">
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

          <form onSubmit={handleManualSearch} className="flex flex-col space-y-4">
            <input 
              type="text" 
              placeholder="ENTER AWB NUMBER"
              value={trackingAwb}
              onChange={e => setTrackingAwb(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#333333] text-[#E0E0E0] p-4 font-mono focus:outline-none focus:border-[#C5A059] text-center"
            />
            <button type="submit" disabled={!trackingAwb} className="w-full py-4 bg-[#1A1A1A] border border-[#333333] text-[#E0E0E0] hover:text-[#C5A059] hover:border-[#C5A059] transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-50">
              Proceed
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col space-y-6">
          <div className="border border-[#C5A059]/30 bg-[#1A1A1A] p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#888888]">Scanned AWB</p>
              <p className="font-mono text-lg text-[#F5F2ED]">{scannedAwb}</p>
            </div>
            <button onClick={resetForm} className="text-[#666666] hover:text-[#FF4444] text-[10px] uppercase tracking-widest font-bold px-4 py-2 border border-[#333333]">Reset</button>
          </div>

          <div className="space-y-4">
             <h3 className="text-sm tracking-widest text-[#E0E0E0] uppercase text-center border-b border-[#333333] pb-2">Visual Health Check</h3>
             <div className="grid grid-cols-1 gap-4 mt-4">
                <button 
                  onClick={() => setTapeIntact(!tapeIntact)}
                  className={`p-6 flex items-center justify-between border transition-all ${tapeIntact ? 'bg-[#111111] border-[#333333] text-[#E0E0E0]' : 'bg-[#FF4444]/10 border-[#FF4444]/50 text-[#FF9999]'}`}
                >
                  <span className="font-bold uppercase tracking-wider text-sm">Tape Intact?</span>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${tapeIntact ? 'border-[#333333] bg-[#0A0A0A]' : 'border-[#FF4444] bg-[#FF4444]'}`}>
                    {!tapeIntact && <XIcon />}
                  </div>
                </button>
                <button 
                  onClick={() => setBoxCrushed(!boxCrushed)}
                  className={`p-6 flex items-center justify-between border transition-all ${boxCrushed ? 'bg-[#FF4444]/10 border-[#FF4444]/50 text-[#FF9999]' : 'bg-[#111111] border-[#333333] text-[#E0E0E0]'}`}
                >
                  <span className="font-bold uppercase tracking-wider text-sm">Box Crushed?</span>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${boxCrushed ? 'border-[#FF4444] bg-[#FF4444]' : 'border-[#333333] bg-[#0A0A0A]'}`}>
                    {boxCrushed && <XIcon />}
                  </div>
                </button>
                <button 
                  onClick={() => setIsTampered(!isTampered)}
                  className={`p-6 flex items-center justify-between border transition-all ${isTampered ? 'bg-[#FF4444]/10 border-[#FF4444]/50 text-[#FF9999]' : 'bg-[#111111] border-[#333333] text-[#E0E0E0]'}`}
                >
                  <span className="font-bold uppercase tracking-wider text-sm">Item Tampered?</span>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isTampered ? 'border-[#FF4444] bg-[#FF4444]' : 'border-[#333333] bg-[#0A0A0A]'}`}>
                    {isTampered && <XIcon />}
                  </div>
                </button>
             </div>
          </div>

          <div className="pt-4 border-t border-[#333333]">
            {isDamaged ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-[#FF4444]/10 border border-[#FF4444]/30 p-4">
                   <p className="text-[#FF9999] text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2"><AlertTriangle size={14}/><span>Damage Protocol Engaged</span></p>
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold tracking-widest text-[#666666] mb-2">Evidence Photo URL</label>
                   <div className="flex space-x-2">
                     <div className="p-4 bg-[#1A1A1A] border border-[#333333] text-[#E0E0E0] flex items-center justify-center"><Camera size={20}/></div>
                     <input 
                        type="url" 
                        placeholder="https://..." 
                        value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}
                        className="flex-1 bg-[#111111] border border-[#333333] px-4 py-4 focus:outline-none focus:border-[#FF4444] text-[#E0E0E0] text-sm"
                     />
                   </div>
                </div>
                <button onClick={handleSubmit} disabled={loading} className="w-full p-6 mt-4 bg-[#FF4444] text-white uppercase font-bold tracking-widest text-lg hover:bg-[#CC0000] transition-colors shadow-[0_0_20px_rgba(255,68,68,0.3)]">
                  Log Damage
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-[#666666] mb-2 text-center">Courier Handshake OTP</label>
                  <input 
                    type="text" 
                    placeholder="ENTER OTP"
                    value={otpProvided} onChange={e => setOtpProvided(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] px-4 py-6 text-center text-3xl font-mono tracking-[0.2em] focus:outline-none focus:border-[#34A853] text-[#E0E0E0] placeholder-[#333333]"
                  />
                </div>
                <button onClick={handleSubmit} disabled={loading || !otpProvided} className="w-full p-6 mt-4 bg-[#34A853] text-white uppercase font-bold tracking-widest text-lg hover:bg-[#2B8B45] transition-colors shadow-[0_0_20px_rgba(52,168,83,0.3)] disabled:opacity-50">
                  Accept Delivery
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dock/ledger')
      .then(r => r.json())
      .then(d => {
        if (d.ledger) setLedger(d.ledger);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between border-b border-[#333333] pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#F5F2ED]">Current Custody</h2>
        <span className="bg-[#1A1A1A] border border-[#333333] text-[#C5A059] px-3 py-1 font-mono text-xs">{ledger.length} ITEMS</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#666666] text-xs uppercase tracking-widest animate-pulse">Syncing Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#333333] bg-[#111111]">
          <CheckCircle2 size={48} className="mx-auto text-[#34A853] mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">All Clear</h3>
          <p className="text-[10px] uppercase text-[#666666] mt-2 max-w-[200px] mx-auto">You have zero packages waiting for handover.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item: any) => {
            const marketplace = item.returnItems?.[0]?.order?.marketplace || 'UNKNOWN MARKETPLACE';
            return (
            <div key={item.id} className="bg-[#111111] border border-[#333333] p-4 flex flex-col space-y-3 relative overflow-hidden group">
              <div className="absolute inset-y-0 left-0 w-1 bg-[#C5A059]"></div>
              
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#666666]">{marketplace}</p>
                  <p className="font-mono text-base text-[#F5F2ED] mt-0.5">{item.trackingAwb}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#666666]">Received</p>
                  <p className="text-xs font-mono text-[#E0E0E0] mt-0.5 max-w-[80px] text-right ml-auto">{new Date(item.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
