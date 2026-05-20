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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 select-none overscroll-none font-sans overflow-hidden border-4 border-slate-200">
      
      <header className="p-4 md:p-6 border-b border-slate-200 shrink-0 bg-white shadow-sm z-20 flex items-center justify-between">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button onClick={() => setActiveTab('home')} className="mr-4 text-slate-500 hover:text-slate-800">
               <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-blue-600">
              {activeTab === 'profile' ? 'Profile' : activeTab === 'ledger' ? 'Custody Ledger' : 'Quality Assurance'}
            </h1>
            <p className="text-slate-500 text-xs font-bold tracking-widest mt-1 uppercase">Terminal Active / Role: {role.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveTab('profile')} className={`hover:text-slate-800 transition-colors ${activeTab === 'profile' ? 'text-slate-800' : 'text-blue-600'}`}>
            <User size={28} />
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-y-auto custom-scrollbar bg-slate-100">
        {activeTab === 'home' && (
          <div className="max-w-lg mx-auto space-y-6 pt-6 px-4 pb-10">
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('ledger')}
                className="w-full relative group border border-slate-200 bg-white hover:border-blue-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-md"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-blue-600 transition-colors">Custody Ledger</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">Packages pending inspection</p>
                </div>
                <FileText size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('takeover')}
                className="w-full relative group border border-slate-200 bg-white hover:border-blue-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-md"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-blue-600 transition-colors">Custody Takeover</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">Execute mechanical handshake</p>
                </div>
                <LinkIcon size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors relative z-10" />
              </button>

              <button 
                onClick={() => setActiveTab('inspect')}
                className="w-full relative group border border-slate-200 bg-white hover:border-blue-500 transition-all p-6 text-left flex items-center justify-between overflow-hidden shadow-sm rounded-md"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-800 group-hover:text-blue-600 transition-colors">Deep Inspect</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-wider">Gamified quality assurance</p>
                </div>
                <ScanEye size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors relative z-10" />
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
                 <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600 rounded">
                   <User size={24} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold tracking-widest uppercase text-slate-900">{userData ? userData.email : 'Loading...'}</h2>
                   <p className="text-[10px] text-blue-600 uppercase tracking-widest mt-1">ID: {userData ? userData.id.split('-')[0] : '...'} / {role.replace('_', ' ')}</p>
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
                className="w-full flex items-center justify-center py-4 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs mb-4 rounded"
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
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">My Custody Ledger</h2>
        <span className="bg-white border border-slate-300 text-blue-600 px-3 py-1 font-mono text-xs rounded-sm shadow-sm font-bold">{ledger.length} PENDING</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Syncing Custody Ledger...</div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-md">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">No Pending Inspections</h3>
          <p className="text-[10px] uppercase text-slate-500 mt-2 max-w-[200px] mx-auto font-medium">You have no active taken packages. Proceed to Takeover to pull from Receiver.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.map((item, idx) => (
             <div key={item.id || idx} className="bg-white border border-slate-200 p-4 flex flex-col space-y-3 relative overflow-hidden group rounded-md shadow-sm hover:shadow transition-shadow">
               <div className={`absolute inset-y-0 left-0 w-1 ${item.status === 'INSPECTING' ? 'bg-amber-400 animate-pulse' : 'bg-blue-500'}`}></div>
               
               <div className="flex justify-between items-start pl-2">
                 <div>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{item.marketplace || 'UNKNOWN'} &bull; ORDER {item.orderId}</p>
                   <p className="font-mono text-base text-slate-900 mt-0.5 font-bold">{item.trackingAwb}</p>
                 </div>
                 <div className="text-right">
                   {item.status === 'INSPECTING' ? (
                     <span className="bg-amber-50 dark:bg-[#FBBC05]/20 text-amber-600 dark:text-[#FBBC05] px-2 py-1 text-[10px] font-bold uppercase border border-amber-200 dark:border-[#FBBC05]/50 rounded-sm">IN PROGRESS</span>
                   ) : (
                     <span className="bg-slate-100 dark:bg-[#333333]/50 text-slate-600 dark:text-[#E0E0E0] px-2 py-1 text-[10px] font-bold uppercase border border-slate-200 dark:border-[#333333] rounded-sm">PENDING</span>
                   )}
                 </div>
               </div>
               
               <div className="flex justify-between items-center pl-2 pt-2 border-t border-slate-100">
                 <div>
                   <p className="text-[10px] uppercase text-slate-400 font-bold">Items Scanned</p>
                   <div className="font-mono text-xs mt-1 text-slate-800 font-bold">
                     <span className="text-green-600">{item.itemsInspected}</span> / {item.itemsExpected}
                   </div>
                 </div>
                 <div className="text-[9px] font-mono text-slate-400 font-bold">
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
  const [awb, setAwb] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awb.trim()) return;
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setAwb('');
    }, 2000);
  };

  if (showSuccess) {
    return (
      <div className="absolute inset-0 bg-green-500 z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
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
      <div className="w-full max-w-lg bg-white p-6 border border-slate-200 shadow-xl flex flex-col space-y-6 rounded-md">
        
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-50 mx-auto flex items-center justify-center rounded-full border border-slate-200 mb-4 shadow-sm">
             <LinkIcon size={32} className="text-blue-600" />
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-slate-800">Mechanical Handshake</h2>
          <p className="text-slate-500 font-bold text-sm tracking-widest mt-2 uppercase">Scan Box from Receiver</p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input 
              type="text" 
              placeholder="ENTER AWB NUMBER..."
              value={awb} 
              onChange={e => setAwb(e.target.value)}
              autoFocus
              className="w-full bg-white border-2 border-slate-300 text-slate-800 p-4 text-center font-mono focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder-slate-300 rounded"
            />
            <button 
              type="submit" 
              disabled={!awb.trim()} 
              className="w-full min-h-16 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:border-2 disabled:border-slate-200 transition-all border-none text-xl font-black uppercase tracking-[0.1em] shadow-lg disabled:shadow-none flex items-center justify-center space-x-3 rounded"
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
  
  const [missingAcknowledged, setMissingAcknowledged] = useState(false);

  const EXPECTED_ITEMS = 3;

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
                        const status = lpnConditionsRef.current[img.id];
                        if (status === 'bad') {
                          if (!lpnCounters[img.id]) lpnCounters[img.id] = 1;
                          const c = lpnCounters[img.id];
                          filesToUpload.push({ key: `lpn_${img.id}_image_${c}`, name: `lpn_${img.id}_image_${c}.jpg`, mimeType: 'image/jpeg', blob: img.blob, lpn: img.id });
                          lpnCounters[img.id]++;
                        }
                      }
                    });
                    
                    const filesMetaData = filesToUpload.map(f => ({ key: f.key, name: f.name, mimeType: f.mimeType, lpn: f.lpn }));

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
                        reason: 'Complete Order Inspection Folder'
                      }),
                    });
                    
                    const dockRes = await fetch('/api/dock/receive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        trackingAwb: activeOrderId,
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
    isOrderCompleteRef.current = false;
    capturedImagesRef.current = [];
    lpnConditionsRef.current = {};
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) {
      setPhase('BOX_EVIDENCE');
      triggerXp(50);
    }
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
    if (itemStep < 5) {
      setItemStep(prev => prev + 1);
    } else {
      console.warn("Item step out of bounds");
    }
  };

  const handleCategory = (cat: 'GOOD' | 'RECOVERY' | 'BAD') => {
    lpnConditionsRef.current[currentLpn] = cat.toLowerCase();
    triggerXp(100);
    setCurrentCategory(cat);
    nextItemStep();
  };

  const handleBinning = () => {
    triggerXp(50);
    const newProcessed = itemsProcessed + 1;
    setItemsProcessed(newProcessed);
    setCurrentLpn('');
    setCurrentCategory(null);
    setItemStep(1);
    
    if (newProcessed >= EXPECTED_ITEMS) {
      stopAndFinalizeRecording();
    }
  };

  const handleMissing = () => {
    stopAndFinalizeRecording();
    setMissingAcknowledged(true);
  };

  const BOX_STEPS = [
    { id: 1, title: 'Top Side', desc: 'Capture the TOP of the box.' },
    { id: 2, title: 'Bottom Side', desc: 'Capture the BOTTOM of the box.' },
    { id: 3, title: 'Front Side', desc: 'Capture the FRONT of the box.' },
    { id: 4, title: 'Back Side', desc: 'Capture the BACK of the box.' },
    { id: 5, title: 'Left Side', desc: 'Capture the LEFT SIDE.' },
    { id: 6, title: 'Right Side', desc: 'Capture the RIGHT SIDE.' },
    { id: 7, title: 'Delivery Label', desc: 'Show the delivery label clearly.' },
    { id: 8, title: 'Remove Slip', desc: 'Remove order details slip & hold to camera.' },
  ];

  const ITEM_STEPS = [
    { id: 1, title: 'Scan Item LPN' },
    { id: 2, title: 'Testing Instructions' },
    { id: 3, title: 'Capture Product Image' },
    { id: 4, title: 'Categorize Condition' },
    { id: 5, title: 'Physical Binning' },
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

             {/* Viewfinder overlay */}
             <div className="w-2/3 h-2/3 border-2 border-white/20 border-dashed relative flex items-center justify-center z-10 pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
             </div>
          </div>
       </div>

       <div className="w-[40%] bg-slate-50 flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
         
         <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shrink-0 shadow-sm relative">
            {floatingXp && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-green-500 font-black text-xl animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-none z-50">
                +{floatingXp} XP
              </div>
            )}
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 p-1.5 rounded text-blue-600"><Zap size={16} fill="currentColor" /></div>
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Total Score</p>
                <p className="text-sm font-black font-mono text-slate-800">{score} XP</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-right">
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Streak</p>
                <p className="text-sm font-black font-mono text-amber-600">{streak}x</p>
              </div>
              <div className="bg-amber-100 p-1.5 rounded text-amber-600"><TrendingUp size={16} /></div>
            </div>
         </div>

         {phase === 'START' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-blue-50 p-4 rounded-full mb-6">
                <ScanEye size={48} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 mb-1 text-center">Scan Order ID</h2>
              <p className="text-slate-500 font-bold tracking-wider mb-8 uppercase text-xs">To Begin Continuous Evidence</p>
              
              <form onSubmit={handleStart} className="w-full flex flex-col space-y-4 max-w-sm">
                <input 
                  type="text" 
                  placeholder="ENTER ORDER ID..."
                  value={orderId} 
                  onChange={e => setOrderId(e.target.value)}
                  autoFocus
                  className="w-full min-h-12 bg-white border-2 border-slate-300 text-slate-900 px-4 py-3 text-center text-lg font-mono focus:outline-none focus:border-blue-500 uppercase placeholder-slate-300 rounded-lg shadow-inner transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!orderId.trim()} 
                  className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:bg-slate-300 disabled:text-slate-500 transition-all text-sm font-black uppercase tracking-[0.15em] shadow-md flex justify-center items-center space-x-2 rounded-lg"
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
                 <h3 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-1">Phase 1</h3>
                 <h2 className="text-lg font-black uppercase tracking-widest text-slate-800">Box Evidence</h2>
               </div>
               
               <div className="flex-1 relative">
                 {BOX_STEPS.map((step, idx) => {
                   const isActive = boxStep === step.id;
                   const isCompleted = boxStep > step.id;
                   const isLast = idx === BOX_STEPS.length - 1;
                   
                   return (
                     <div key={step.id} className="relative pl-8 pb-4">
                       {!isLast && (
                         <div className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? 'bg-green-400' : 'bg-slate-200'}`}></div>
                       )}
                       
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                         isCompleted ? 'bg-green-500 border-green-500' : 
                         isActive ? 'bg-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 
                         'bg-slate-100 border-slate-300'
                       }`}>
                         {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
                         {isActive && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
                       </div>
                       
                       <div className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-blue-600' : isCompleted ? 'text-slate-500' : 'text-slate-400'}`}>
                         {step.id}. {step.title}
                       </div>
                       
                       {isActive && (
                         <div className="mt-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                           <p className="text-xs font-bold text-slate-600 mb-4">{step.desc}</p>
                           <button 
                             onClick={() => { captureImage('box'); nextBoxStep(); }} 
                             className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black uppercase tracking-widest rounded flex items-center justify-center space-x-2 transition-all active:scale-95"
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
               <div className="mb-6 flex justify-between items-start border-b border-slate-200 pb-4">
                 <div>
                   <h3 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-1">Phase 2</h3>
                   <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 leading-tight">Product Verification</h2>
                 </div>
                 <div className="text-right">
                   <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mb-1">Items Processed</p>
                   <p className="text-base font-black font-mono text-slate-700">{itemsProcessed} <span className="text-slate-400">/ {EXPECTED_ITEMS}</span></p>
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
                         <div className={`absolute left-[11px] top-6 bottom-[-8px] w-[2px] ${isCompleted ? 'bg-green-400' : 'bg-slate-200'}`}></div>
                       )}
                       
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                         isCompleted ? 'bg-green-500 border-green-500' : 
                         isActive ? 'bg-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 
                         'bg-slate-100 border-slate-300'
                       }`}>
                         {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
                         {isActive && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
                       </div>
                       
                       <div className={`text-sm font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-blue-600' : isCompleted ? 'text-slate-500' : 'text-slate-400'}`}>
                         {step.id}. {step.title}
                       </div>
                       
                       {isActive && (
                         <div className="mt-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                           
                           {step.id === 1 && (
                             <div className="space-y-4">
                               <input 
                                 type="text" 
                                 placeholder="SCAN LPN..."
                                 value={currentLpn} 
                                 onChange={e => setCurrentLpn(e.target.value)}
                                 autoFocus
                                 className="w-full min-h-12 bg-slate-50 border border-slate-300 text-slate-900 px-4 py-2 text-center text-sm font-mono focus:outline-none focus:border-blue-500 uppercase rounded"
                               />
                               <button 
                                 onClick={() => { captureImage('lpn', currentLpn); nextItemStep(); }} 
                                 disabled={!currentLpn.trim()}
                                 className="w-full min-h-12 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded disabled:bg-slate-300 transition-colors"
                               >
                                 Verify LPN
                               </button>
                             </div>
                           )}

                           {step.id === 2 && (
                             <div className="space-y-4">
                               <ul className="text-slate-600 font-medium space-y-2 text-xs list-disc list-inside">
                                 <li>Check all corners for scratches.</li>
                                 <li>Verify mechanical parts move smoothly.</li>
                                 <li>Ensure no missing accessories.</li>
                               </ul>
                               <button 
                                 onClick={nextItemStep} 
                                 className="w-full min-h-12 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded mt-2"
                               >
                                 Next
                               </button>
                             </div>
                           )}

                           {step.id === 3 && (
                             <div className="space-y-4">
                               <div className="bg-slate-100 p-4 flex justify-center rounded">
                                 <PackageOpen size={32} className="text-slate-400" />
                               </div>
                               <button 
                                 onClick={() => { captureImage('product', currentLpn); nextItemStep(); }} 
                                 className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all active:scale-95"
                               >
                                 <Camera size={16} /> <span>Capture Image</span>
                               </button>
                             </div>
                           )}

                           {step.id === 4 && (
                             <div className="flex flex-col space-y-3">
                               <p className="text-xs text-slate-500 font-bold uppercase tracking-wider text-center mb-2">Select Condition & Bin</p>
                               <button onClick={() => handleCategory('GOOD')} className="w-full min-h-12 bg-green-600 active:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                  <CheckCircle2 size={18} /> <span>Good</span>
                               </button>
                               <button onClick={() => handleCategory('RECOVERY')} className="w-full min-h-12 bg-amber-500 active:bg-amber-600 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                  <AlertTriangle size={18} /> <span>Recovery</span>
                               </button>
                               <button onClick={() => handleCategory('BAD')} className="w-full min-h-12 bg-red-600 active:bg-red-700 text-white text-sm font-black uppercase tracking-widest rounded shadow flex items-center justify-center space-x-3 transition-transform active:scale-95">
                                  <AlertOctagon size={18} /> <span>Bad</span>
                               </button>
                             </div>
                           )}

                           {step.id === 5 && (
                             <div className="flex flex-col items-center justify-center space-y-6 py-4">
                               <div className="bg-slate-100 p-6 rounded-xl border-2 border-slate-300 text-center w-full">
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Place item in</p>
                                 <p className={`text-2xl font-black uppercase tracking-widest ${currentCategory === 'GOOD' ? 'text-green-600' : currentCategory === 'RECOVERY' ? 'text-amber-500' : 'text-red-600'}`}>
                                   {currentCategory} BIN
                                 </p>
                               </div>
                               <button 
                                 onClick={handleBinning} 
                                 className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-black uppercase tracking-widest rounded flex justify-center items-center space-x-2 transition-all active:scale-95"
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
               {itemsProcessed < EXPECTED_ITEMS && (
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
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-lg mb-8 flex items-center space-x-3 w-full justify-center text-left">
                  <AlertTriangle size={20} className="shrink-0" />
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