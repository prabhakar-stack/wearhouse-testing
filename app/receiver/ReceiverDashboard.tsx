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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 select-none font-sans overflow-hidden">
      
      {/* Header */}
      <header className="p-4 border-b border-slate-200 shrink-0 bg-white flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-slate-500 hover:text-slate-800">
               <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-amber-600">
              {activeTab === 'home' ? 'Receiver Hub' : activeTab === 'receive' ? 'Package Intake' : activeTab === 'profile' ? 'Profile' : activeTab === 'expected' ? 'Expected' : 'Custody Ledger'}
            </h1>
            <p className="text-[10px] uppercase text-slate-500 tracking-wider mt-1 font-bold">Terminal Active &bull; {role.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveTab('profile')} className={`hover:text-slate-800 transition-colors ${activeTab === 'profile' ? 'text-slate-800' : 'text-amber-600'}`}>
            <User size={28} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 p-4 lg:p-6 pb-10 relative">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">
            {/* Action Buttons */}
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('expected')}
                className="w-full relative group border border-slate-200 bg-white hover:border-blue-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-md shadow-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-blue-600 transition-colors">Expected Deliveries</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">Packages expected today</p>
                </div>
                <FileText size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('receive')}
                className="w-full relative group border border-slate-200 bg-white hover:border-amber-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-md shadow-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-amber-600 transition-colors">Receive Package</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">Launch camera scanner sequence</p>
                </div>
                <QrCode size={32} className="text-slate-300 group-hover:text-amber-500 transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('ledger')}
                className="w-full relative group border border-slate-200 bg-white hover:border-green-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden rounded-md shadow-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-green-600 transition-colors">Handover Ledger</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">View active custody stack</p>
                </div>
                <Box size={32} className="text-slate-300 group-hover:text-green-500 transition-colors relative z-10" />
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4">
            <div className="border border-slate-200 bg-white p-6 relative overflow-hidden rounded-md shadow-sm">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Shield size={100} />
              </div>
              <div className="flex items-center space-x-4 mb-6 relative z-10">
                 <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center text-amber-600 rounded">
                   <User size={24} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold tracking-widest uppercase text-slate-900">{userData ? userData.email : 'Loading...'}</h2>
                   <p className="text-[10px] text-amber-600 uppercase tracking-widest mt-1">ID: {userData ? userData.id.split('-')[0] : '...'} / {role.replace('_', ' ')}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 relative z-10">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 tracking-widest font-bold">Processed</p>
                  <p className="text-2xl font-mono text-slate-800">{userData ? userData.itemsProcessed : 0}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500 tracking-widest font-bold">Accuracy</p>
                  <p className="text-2xl font-mono text-green-600">{userData ? userData.accuracyRate + '%' : '100%'}</p>
                </div>
              </div>
            </div>
            
            {(role === 'SUPER_ACCESS' || role === 'ADMIN') && (
              <Link 
                href={role === 'SUPER_ACCESS' ? '/super-admin' : '/admin'}
                className="w-full flex items-center justify-center py-4 border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs mb-4 rounded"
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
              className="w-full py-4 border border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs rounded"
            >
              Sign Out
            </button>
          </div>
        )}

        {activeTab === 'expected' && <ExpectedTab />}
        {activeTab === 'receive' && <ReceiveTab userId={userId} />}
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
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Expected Today</h2>
        <span className="bg-white border border-slate-300 text-blue-600 px-3 py-1 font-mono text-xs rounded-sm shadow-sm font-bold">{expected.length} INBOUND</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Inbound Ledger...</div>
      ) : expected.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-md">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">No Expected Deliveries</h3>
          <p className="text-[10px] uppercase text-slate-500 mt-2 max-w-[200px] mx-auto font-medium">There are no packages expected to arrive.</p>
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
               <div key={item.id || idx} className={`bg-white border ${issueLvl > 0 ? 'border-red-400' : 'border-slate-200'} p-4 flex flex-col space-y-3 relative overflow-hidden group rounded-md shadow-sm hover:shadow transition-shadow`}>
                 <div className={`absolute inset-y-0 left-0 w-1 ${issueLvl === 4 ? 'bg-red-500 animate-pulse' : issueLvl > 0 ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
                 
                 <div className="flex justify-between items-start pl-2">
                   <div>
                     <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{marketplace}</p>
                     <p className="font-mono text-base text-slate-900 mt-0.5 font-bold">{item.trackingAwb}</p>
                   </div>
                   <div className="text-right">
                     {issueLvl === 4 ? (
                       <span className="bg-red-50 text-red-600 px-2 py-1 text-[10px] font-bold uppercase border border-red-200 rounded-sm">L4 ALERT</span>
                     ) : issueLvl > 0 ? (
                       <span className="bg-amber-50 text-amber-600 px-2 py-1 text-[10px] font-bold uppercase border border-amber-200 rounded-sm">DELAYED</span>
                     ) : (
                       <span className="text-green-600 text-[10px] font-bold uppercase">ON TIME</span>
                     )}
                   </div>
                 </div>
                 {issueLvl === 4 && (
                   <p className="text-red-600 text-[10px] font-bold uppercase pl-2 mt-2 bg-red-50 p-2 border border-red-100 rounded-sm">Missing Logs: Courier delivered but no scan log</p>
                 )}
               </div>
            )
          })}
        </div>
      )}
    </div>
  );
}

function ReceiveTab({ userId }: { userId: string }) {
  const [trackingAwb, setTrackingAwb] = useState('');
  const [scannedAwb, setScannedAwb] = useState('');
  
  // Health checks
  const [tapeState, setTapeState] = useState<'null' | 'good' | 'damaged'>('null');
  const [boxState, setBoxState] = useState<'null' | 'good' | 'damaged'>('null');
  const [tamperState, setTamperState] = useState<'null' | 'good' | 'damaged'>('null');
  
  const [showRejectScreen, setShowRejectScreen] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // OTP State
  const [otpState, setOtpState] = useState<'IDLE' | 'FETCHING' | 'NOT_REQUIRED' | 'FETCHED' | 'ERROR'>('IDLE');
  const [fetchedOtp, setFetchedOtp] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{type: 'success' | 'error' | 'damage', msg: string} | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  const fetchSystemOTP = () => {
    setOtpState('FETCHING');
    setTimeout(() => {
      const rand = Math.random();
      if (rand < 0.5) {
        setOtpState('FETCHED');
        setFetchedOtp(Math.floor(100000 + Math.random() * 900000).toString());
      } else if (rand < 0.8) {
        setOtpState('NOT_REQUIRED');
      } else {
        setOtpState('ERROR');
      }
    }, 2000);
  };

  const isDamaged = tapeState === 'damaged' || boxState === 'damaged' || tamperState === 'damaged';
  const isAllGood = tapeState === 'good' && boxState === 'good' && tamperState === 'good';

  useEffect(() => {
    if (scannedAwb && isAllGood && otpState === 'IDLE' && !isDamaged) {
      setTimeout(() => {
        fetchSystemOTP();
      }, 0);
    } else if (!isAllGood && otpState !== 'IDLE') {
      setTimeout(() => {
        setOtpState('IDLE');
        setFetchedOtp('');
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapeState, boxState, tamperState, scannedAwb, isDamaged]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isDamaged && !showRejectScreen && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("Video play failed:", e));
          }
        })
        .catch(err => console.error("Camera access denied:", err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isDamaged, showRejectScreen]);

  const startScanner = async () => {
    setScanning(true);
    setBanner(null);
    try {
      if (!scannerRef.current) {
        const { Html5Qrcode: H5Qrcode } = await import('html5-qrcode');
        scannerRef.current = new H5Qrcode("reader", {
          verbose: false,
          formatsToSupport: [
            5,  // CODE_128
            3,  // CODE_39
            9,  // EAN_13
            14  // UPC_A
          ]
        });
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 100 } },
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
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (e) { console.error(e); }
      }
      try {
        scannerRef.current.clear();
      } catch (e) {}
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

  const handleSubmitGood = async () => {
    if (!scannedAwb) return;
    setLoading(true);
    setBanner(null);
    try {
      const payload = {
        trackingAwb: scannedAwb,
        tapeIntact: true,
        boxCrushed: false,
        isTampered: false,
        otpProvided: fetchedOtp,
        evidenceUrl: ''
      };

      const res = await fetch('/api/dock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = { error: 'Invalid response from server. Route may not exist.' };
      }

      if (!res.ok) {
        setBanner({type: 'error', msg: data.error});
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

  const handleCaptureAndReject = () => {
    setLoading(true);
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async blob => {
          if (blob) {
            
            try {
              const filesMetaData = [{ key: 'file', name: `rejection-${scannedAwb}-${Date.now()}.jpg`, mimeType: 'image/jpeg' }];

              let folderLink = `https://mock-storage.local/folder/${scannedAwb}`;
              let orderFolderId = `folder-${scannedAwb}`;
              
              let fileLink = '';
              let resolvedFileId = '';

              try {
                const initRes = await fetch('/api/upload/init', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: scannedAwb, type: 'RECEIVER_REJECTION', filesMetaData })
                });
                
                if (initRes.ok) {
                  const data = await initRes.json();
                  folderLink = data.folderLink;
                  orderFolderId = data.orderFolderId;
                  if (data.uploadUrls && data.uploadUrls['file']) {
                    const rawRes = await fetch(data.uploadUrls['file'], { method: 'PUT', body: blob });
                    if (rawRes.ok) {
                      const rawData = await rawRes.json();
                      fileLink = rawData.webViewLink;
                      resolvedFileId = rawData.fileId;
                    }
                  }
                }
              } catch (e) {
                console.warn('Upload API not available, using fallback values.');
              }
              
              const finalLink = fileLink || folderLink;
              const finalFileId = resolvedFileId || orderFolderId;

              try {
                await fetch('/api/upload/finalize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: scannedAwb, folderLink: finalLink, orderFolderId: finalFileId,
                    type: 'RECEIVER_REJECTION', uploadedById: userId,
                    reason: 'Package failed visual inspection', manifestId: scannedAwb
                  })
                });
              } catch (e) {}
              
              // Fire-and-forget logging to the DB using the real Drive URL
              const payload = {
                trackingAwb: scannedAwb,
                tapeIntact: tapeState !== 'damaged',
                boxCrushed: boxState === 'damaged',
                isTampered: tamperState === 'damaged',
                otpProvided: '',
                evidenceUrl: finalLink || 'UPLOAD_FAILED'
              };
              fetch('/api/dock/receive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              }).catch(e => console.error('Dock Receive API Error:', e));

              setShutterFlash(true);
              setTimeout(() => {
                setShutterFlash(false);
                setShowRejectScreen(true);
                setLoading(false);
              }, 150);
            } catch (e) {
              console.error('Background upload failed:', e);
              setBanner({ type: 'error', msg: 'Network error during capture.' });
              setLoading(false);
            }
          }
        }, 'image/jpeg', 0.8);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handleRaiseOtpAlert = async () => {
    setLoading(true);
    setTimeout(() => {
      setBanner({type: 'error', msg: 'OTP Fetch Alert Raised. Package on hold.'});
      setLoading(false);
      resetForm();
    }, 1000);
  };

  const resetForm = () => {
    setScannedAwb('');
    setTrackingAwb('');
    setTapeState('null');
    setBoxState('null');
    setTamperState('null');
    setShowRejectScreen(false);
    setOtpState('IDLE');
    setFetchedOtp('');
  };

  return (
    <div className="flex flex-col space-y-6 max-w-lg mx-auto pb-10">
      
      {banner && (
        <div className={`p-6 border-l-4 ${banner.type === 'success' ? 'bg-white border-green-500' : banner.type === 'damage' ? 'bg-red-50 border-red-500' : 'bg-white border-red-500'} flex items-start space-x-4 shadow-xl rounded-md`}>
          {banner.type === 'success' ? <CheckCircle2 className="text-green-500 shrink-0" size={24} /> : <AlertOctagon className="text-red-500 shrink-0" size={24} />}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-widest ${banner.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {banner.type === 'success' ? 'Delivery Accepted' : banner.type === 'damage' ? 'Damage Alert Logged' : 'Scan Error'}
            </h4>
            <p className="text-slate-800 mt-1 text-sm font-mono font-medium">{banner.msg}</p>
          </div>
        </div>
      )}

      {!scannedAwb ? (
        <div className="border border-slate-200 bg-white p-6 lg:p-8 flex flex-col space-y-6 rounded-md shadow-sm">
          <div className="text-center space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-amber-600 font-bold">Scan Package</h2>
            <p className="text-xs text-slate-500 font-medium">Position tracking AWB in frame.</p>
          </div>
          
          <div className="relative bg-slate-100 w-full aspect-square border-2 border-dashed border-slate-300 overflow-hidden flex flex-col items-center justify-center rounded">
            <div id="reader" className="absolute inset-0 w-full h-full"></div>
            {!scanning && <Camera size={48} className="mb-4 text-slate-300" />}
            {!scanning && <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Camera Offline</p>}
          </div>

          {!scanning ? (
            <button onClick={startScanner} className="w-full py-4 bg-white border-2 border-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-colors font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 text-amber-600 rounded">
              <Camera size={16} /> <span>Activate Camera</span>
            </button>
          ) : (
            <button onClick={stopScanner} className="w-full py-4 bg-white border-2 border-red-500 hover:bg-red-50 transition-colors font-bold uppercase tracking-widest text-xs text-red-600 rounded">
              Deactivate Camera
            </button>
          )}

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute border-t border-slate-200 w-full"></div>
            <span className="bg-white px-4 text-slate-400 text-[10px] uppercase font-bold tracking-widest relative z-10">Manual Override</span>
          </div>

          <form onSubmit={handleManualSearch} className="flex flex-col space-y-4">
            <input 
              type="text" 
              placeholder="ENTER AWB NUMBER"
              value={trackingAwb}
              onChange={e => setTrackingAwb(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 text-slate-800 p-4 font-mono focus:outline-none focus:border-amber-500 text-center rounded"
            />
            <button type="submit" disabled={!trackingAwb} className="w-full py-4 bg-slate-100 border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-500 transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-50 rounded">
              Proceed
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col space-y-6">
          <div className="border border-amber-200 bg-amber-50 p-4 flex justify-between items-center rounded-md shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Scanned AWB</p>
              <p className="font-mono text-lg text-slate-900 font-bold">{scannedAwb}</p>
            </div>
            <button onClick={resetForm} className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-[10px] uppercase tracking-widest font-bold px-4 py-2 border border-slate-300 rounded transition-colors">Reset</button>
          </div>

          {showRejectScreen && (
            <div className="fixed inset-0 bg-red-600 z-[100] flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
               <AlertOctagon size={120} className="text-white mb-8 drop-shadow-2xl" />
               <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest text-center leading-tight drop-shadow-lg">
                 🛑 REJECTED
               </h2>
               <p className="text-white text-xl md:text-2xl font-bold tracking-widest mt-6 opacity-90 uppercase text-center">Hand package back to courier.</p>
               <button onClick={resetForm} className="mt-16 w-full max-w-sm py-5 bg-white text-red-600 font-black uppercase tracking-widest rounded shadow-2xl text-xl hover:bg-slate-100 transition-colors">
                 Scan Next Order
               </button>
            </div>
          )}

          <div className="space-y-4">
             <h3 className="text-sm font-bold tracking-widest text-slate-800 uppercase text-center border-b border-slate-200 pb-2">Visual Health Check</h3>
             {!isDamaged ? (
               <div className="grid grid-cols-1 gap-4 mt-4">
                 <VisualCard title="1. Factory Tape Intact" state={tapeState} setState={setTapeState} imgGoodText="Img: Clean Tape" imgBadText="Img: Cut Tape" />
                 <VisualCard title="2. Box Structure (No Crushes)" state={boxState} setState={setBoxState} imgGoodText="Img: Perfect Edges" imgBadText="Img: Crushed/Wet" />
                 <VisualCard title="3. No Signs of Tampering" state={tamperState} setState={setTamperState} imgGoodText="Img: Original Label" imgBadText="Img: Re-taped/Torn" />
               </div>
             ) : (
               <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                    <p className="text-red-600 text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2"><AlertTriangle size={14}/><span>Damage Detected - Capture Evidence</span></p>
                 </div>
                 <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden border-4 border-red-500 shadow-xl">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {shutterFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150"></div>}
                    <div className="absolute top-4 left-4 bg-red-600/90 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 rounded shadow-lg z-10">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                      <span>LIVE EVIDENCE</span>
                    </div>
                 </div>
                 <button onClick={handleCaptureAndReject} disabled={loading} className="w-full py-6 mt-4 bg-red-600 text-white uppercase font-black tracking-widest text-xl hover:bg-red-700 transition-colors shadow-lg rounded-md flex items-center justify-center space-x-3 disabled:opacity-50">
                   {loading ? (
                     <><div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div><span>Uploading...</span></>
                   ) : (
                     <><Camera size={24} /> <span>Capture & Reject</span></>
                   )}
                 </button>
               </div>
             )}
          </div>

          {!isDamaged && (
            <div className="pt-4 border-t border-slate-200">
              {isAllGood && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="border border-slate-200 bg-white p-6 rounded-md shadow-sm">
                    {otpState === 'FETCHING' && (
                      <div className="flex flex-col items-center justify-center space-y-4 py-4">
                         <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                         <p className="text-xs uppercase font-bold tracking-widest text-slate-500">🔄 Fetching Delivery OTP from System...</p>
                      </div>
                    )}
                    {otpState === 'NOT_REQUIRED' && (
                      <div className="flex flex-col items-center justify-center space-y-4 py-4 bg-green-50 border border-green-200 rounded-md">
                         <CheckCircle2 size={32} className="text-green-500" />
                         <p className="text-xs uppercase font-bold tracking-widest text-green-700 text-center">OTP Not Required for this AWB.</p>
                      </div>
                    )}
                    {otpState === 'FETCHED' && (
                      <div className="flex flex-col items-center justify-center space-y-4 py-2">
                         <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">System OTP Fetched</p>
                         <input 
                           type="text" 
                           value={fetchedOtp} 
                           readOnly
                           className="w-full bg-slate-50 border border-slate-300 px-4 py-6 text-center text-3xl font-mono tracking-[0.2em] text-slate-800 rounded-md shadow-sm outline-none"
                         />
                      </div>
                    )}
                    {otpState === 'ERROR' && (
                      <div className="flex flex-col items-center justify-center space-y-4 py-4 bg-red-50 border border-red-200 rounded-md">
                         <AlertOctagon size={32} className="text-red-500" />
                         <p className="text-xs uppercase font-bold tracking-widest text-red-700">System Failed to Fetch OTP</p>
                         <button onClick={handleRaiseOtpAlert} disabled={loading} className="w-full py-4 mt-2 bg-red-600 text-white uppercase font-bold tracking-widest text-xs hover:bg-red-700 transition-colors rounded-md flex items-center justify-center space-x-2">
                           <AlertTriangle size={16} />
                           <span>⚠️ Raise OTP Fetch Alert</span>
                         </button>
                      </div>
                    )}
                  </div>
                  
                  {['NOT_REQUIRED', 'FETCHED'].includes(otpState) && (
                    <button onClick={handleSubmitGood} disabled={loading} className="w-full p-6 mt-4 bg-green-600 text-white uppercase font-bold tracking-widest text-lg hover:bg-green-700 transition-colors shadow-lg rounded-md flex items-center justify-center space-x-3">
                      <CheckCircle2 size={24} />
                      <span>Accept Delivery</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Current Custody</h2>
        <span className="bg-white border border-slate-300 text-amber-600 px-3 py-1 font-mono text-xs font-bold rounded-sm shadow-sm">{ledger.length} ITEMS</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-md">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">All Clear</h3>
          <p className="text-[10px] uppercase text-slate-500 mt-2 max-w-[200px] mx-auto font-medium">You have zero packages waiting for handover.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item: any) => {
            const marketplace = item.returnItems?.[0]?.order?.marketplace || 'UNKNOWN MARKETPLACE';
            return (
            <div key={item.id} className="bg-white border border-slate-200 p-4 flex flex-col space-y-3 relative overflow-hidden group rounded-md shadow-sm hover:shadow transition-shadow">
              <div className="absolute inset-y-0 left-0 w-1 bg-amber-500"></div>
              
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{marketplace}</p>
                  <p className="font-mono text-base text-slate-900 mt-0.5 font-bold">{item.trackingAwb}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Received</p>
                  <p className="text-xs font-mono text-slate-800 mt-0.5 max-w-[80px] text-right ml-auto font-bold">{new Date(item.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

function VisualCard({ title, state, setState, imgGoodText, imgBadText }: { title: string, state: 'null'|'good'|'damaged', setState: (v: 'null'|'good'|'damaged')=>void, imgGoodText: string, imgBadText: string }) {
  return (
    <div className="border border-slate-200 bg-white p-4 rounded-md shadow-sm space-y-4">
       <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800 text-center">{title}</h4>
       <div className="flex space-x-2">
         <div className="flex-1 bg-slate-100 border border-slate-200 aspect-video rounded flex items-center justify-center text-center p-2">
           <span className="text-[10px] text-slate-500 font-bold uppercase">{imgGoodText}</span>
         </div>
         <div className="flex-1 bg-slate-100 border border-slate-200 aspect-video rounded flex items-center justify-center text-center p-2">
           <span className="text-[10px] text-slate-500 font-bold uppercase">{imgBadText}</span>
         </div>
       </div>
       <div className="flex space-x-2">
         <button onClick={() => setState('good')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded transition-colors ${state === 'good' ? 'bg-green-500 text-white shadow-inner border border-green-600' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>✅ GOOD</button>
         <button onClick={() => setState('damaged')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded transition-colors ${state === 'damaged' ? 'bg-red-500 text-white shadow-inner border border-red-600' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>❌ DAMAGED</button>
       </div>
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
