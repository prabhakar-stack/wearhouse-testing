import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Play,
  History,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';

interface BotTask {
  id: string;
  claimId: string;
  orderId: string;
  type: string;
  status: 'Queued' | 'Running' | 'Succeeded' | 'Failed';
  timestamp: string;
  logs: string[];
}

export default function SmartFiling() {
  const [tasks, setTasks] = useState<BotTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{ 
    configured: boolean; 
    email: string | null; 
    hasTotp: boolean; 
    headless: boolean;
    isBotRunning: boolean;
    isOtpRequired: boolean;
    coolingRemainingMs: number;
    isAvailable: boolean;
  }>({
    configured: false,
    email: null,
    hasTotp: false,
    headless: false,
    isBotRunning: false,
    isOtpRequired: false,
    coolingRemainingMs: 0,
    isAvailable: false
  });
  const [screenshotTimestamp, setScreenshotTimestamp] = useState(Date.now());
  const [testOrderId, setTestOrderId] = useState('');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/bot/config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error("Error fetching bot config:", err);
    }
  };

  const triggerTest = async () => {
    if (!testOrderId) return alert("Please provide an Order ID or LPN");
    try {
      const res = await fetch('/api/bot/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: testOrderId,
          lpn: testOrderId // Backend handles checking both
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert("Bot triggered successfully! View progress in the Live Monitor below.");
        setTestOrderId('');
        fetchLogs();
        fetchConfig();
      } else {
        alert(data.message || "Failed to trigger bot");
      }
    } catch (err) {
      alert("Failed to connect to the bot server.");
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      // 1. Fetch all claims to determine what's eligible
      const claimsRes = await fetch('/api/claims');
      const allClaims: any[] = await claimsRes.json();

      // 2. Group by Tracking ID
      const groups: Record<string, any[]> = {};
      allClaims.forEach(c => {
        const tid = c.trackingId || 'No Tracking';
        if (!groups[tid]) groups[tid] = [];
        groups[tid].push(c);
      });

      // 3. Filter for Tracking IDs where ALL associated rows are marked "Inspected"
      const eligibleTrackingIds = Object.keys(groups).filter(tid => {
        if (tid === 'No Tracking') return false;
        const groupItems = groups[tid];
        // Must have at least one row and ALL rows must be 'Inspected'
        return groupItems.length > 0 && groupItems.every(item => item.status === 'Inspected');
      });

      const updatedTasks: BotTask[] = [];

      // 4. For each eligible tracking ID, check if there's a bot log
      for (const tid of eligibleTrackingIds) {
        const firstClaim = groups[tid][0];
        const logId = firstClaim.lpn || tid; // Use LPN as primary log key
        
        try {
          const res = await fetch(`/api/bot/logs/${logId}`);
          const data = await res.json();
          
          if (data.logs && data.logs.length > 0 && !data.logs[0].includes('No logs found')) {
            const isFinished = data.logs.some((l: string) => l.includes('SUCCESS') || l.includes('ERROR'));
            updatedTasks.push({
              id: `BT-${logId}`,
              claimId: logId,
              orderId: firstClaim.orderId || "N/A",
              type: "Amazon SAFE-T",
              status: isFinished ? (data.logs.some((l: string) => l.includes('SUCCESS')) ? 'Succeeded' : 'Failed') : 'Running',
              timestamp: "System Auto",
              logs: data.logs
            });
          } else {
            // No logs found, so it's just "Queued" / "Ready"
            updatedTasks.push({
              id: `Q-${logId}`,
              claimId: logId,
              orderId: firstClaim.orderId || "N/A",
              type: "Ready to File",
              status: 'Queued',
              timestamp: "Inspected",
              logs: ["Validation Complete. All shipment items are marked as 'Inspected'. Ready for SAFE-T filing."]
            });
          }
        } catch (e) {
          console.warn(`Error checking logs for ${logId}:`, e);
        }
      }

      setTasks(updatedTasks);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching bot tasks:", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    const interval = setInterval(() => {
      fetchLogs();
      fetchConfig();
      setScreenshotTimestamp(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Smart Filing Hub</h2>
          </div>
          <p className="text-slate-500 text-xs lg:text-sm italic">Automated Amazon filing bot powered by Playwright.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end px-4 border-r border-slate-200">
            <span className="text-[10px] uppercase font-black text-slate-400">Bot Health</span>
            {config.isBotRunning ? (
              <span className="text-sm font-bold text-blue-600 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> BUSY
              </span>
            ) : config.coolingRemainingMs > 0 ? (
              <span className="text-sm font-bold text-amber-600 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> COOLING
              </span>
            ) : (
              <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> ONLINE
              </span>
            )}
          </div>
          <button 
            onClick={() => { fetchLogs(); fetchConfig(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Play className="w-4 h-4" />
            REFRESH QUEUE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Tasks */}
        <div className="xl:col-span-2 space-y-6">
          {/* Live Monitor */}
          {config.isBotRunning && (
            <div className="bg-white border-2 border-indigo-600 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-indigo-600 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Bot Monitor</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-100 italic">Showing browser workspace...</span>
              </div>
              <div className="aspect-video bg-slate-100 flex items-center justify-center relative group">
                <img 
                  src={`/api/bot/live-view?t=${screenshotTimestamp}`} 
                  alt="Bot Live View"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmMmY0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2EwYWVjMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TGl2ZSBWaWV3IFByZXBhcmluZy4uLjwvdGV4dD48L3N2Zz4=';
                  }}
                />
                <div className="absolute inset-0 bg-black/5 pointer-events-none group-hover:bg-transparent transition-colors" />
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                   <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Encrypted Stream</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2 px-2">
            <History className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Automation Queue</span>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm min-h-[200px]">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center">
                <Bot className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-slate-400 text-sm font-medium">No active or recent automated tasks found.</p>
                <p className="text-slate-300 text-xs mt-1">Trigger a filing from the Triage Queue to see logs here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {tasks.map((task) => (
                  <div key={task.id} className="p-4 lg:p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border",
                          task.status === 'Running' ? "bg-blue-50 border-blue-100 text-blue-600 animate-pulse" :
                          task.status === 'Succeeded' ? "bg-green-50 border-green-100 text-green-600" :
                          task.status === 'Queued' ? "bg-slate-50 border-slate-100 text-slate-400" :
                          "bg-red-50 border-red-100 text-red-600"
                        )}>
                          {task.status === 'Running' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                           task.status === 'Succeeded' ? <CheckCircle2 className="w-5 h-5" /> :
                           task.status === 'Queued' ? <History className="w-5 h-5" /> :
                           <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#313079]">{task.id}</span>
                            <span className="text-[10px] font-bold text-slate-400">/ {task.timestamp}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">Claim {task.claimId}</h4>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-slate-100 rounded uppercase text-slate-500 mt-1 inline-block">
                            {task.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === 'Queued' && (
                          <button 
                            disabled={!config.isAvailable}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch('/api/bot/trigger', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ lpn: task.claimId })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  alert(`Bot triggered for LPN: ${task.claimId}`);
                                } else {
                                  alert(data.message || "Failed to start bot.");
                                }
                                fetchLogs();
                                fetchConfig();
                              } catch (e) {
                                alert("Connection error.");
                                console.error(e);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                              config.isAvailable 
                                ? 'bg-black text-white hover:scale-105 active:scale-95' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {config.isBotRunning ? 'BOT BUSY' : config.coolingRemainingMs > 0 ? 'COOLING' : 'RUN FILING'}
                          </button>
                        )}
                        <button className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100 shadow-sm">
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>

                    {/* Log Terminal Mini */}
                    <div className="bg-[#0D1117] rounded-xl p-4 font-mono text-[10px] leading-relaxed text-slate-300 border border-slate-800">
                      <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        <span className="text-indigo-400 uppercase font-bold tracking-widest">Bot Execution Logs</span>
                      </div>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {task.logs.map((log, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-slate-600 w-4">{i + 1}</span>
                            <span className={cn(
                              log.includes('ERROR') ? "text-red-400" :
                              log.includes('SUCCESS') ? "text-green-400" :
                              ""
                            )}>{log}</span>
                          </div>
                        ))}
                        {task.status === 'Running' && (
                          <div className="flex gap-2 animate-pulse text-indigo-400">
                            <span className="w-4">{task.logs.length + 1}</span>
                            <span>_ Executing next instruction...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Settings/Manual Controls */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#313079]">Bot Configuration</h3>
              {config.configured ? (
                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-black border border-green-100">READY</span>
              ) : (
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-black border border-red-100">SETUP REQUIRED</span>
              )}
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Target Account</p>
                <p className="text-xs font-bold text-slate-900">{config.email || 'Not configured in .env'}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">TOTP Secret</p>
                  <p className="text-xs font-bold text-slate-900">{config.hasTotp ? '••••••••••••••••' : 'Missing secret'}</p>
                </div>
                <div className={cn("w-2 h-2 rounded-full", config.hasTotp ? "bg-green-500" : "bg-red-500")} />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Headless Mode</p>
                  <p className="text-xs font-bold text-slate-900">{config.headless ? 'Enabled' : 'Disabled (Headed)'}</p>
                </div>
                <div className={cn("w-8 h-4 rounded-full relative transition-colors", config.headless ? "bg-indigo-600" : "bg-slate-300")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all", config.headless ? "right-0.5" : "left-0.5")} />
                </div>
              </div>
              
              {!config.configured && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    Go to <span className="font-black">Settings &gt; Environment Variables</span> and add AMAZON_EMAIL, AMAZON_PASSWORD, and AMAZON_TOTP_SECRET.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#313079] mb-4">Manual Test Trigger</h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Amazon Order ID / Tracking ID / LPN"
                className="w-full text-xs p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={testOrderId}
                onChange={(e) => setTestOrderId(e.target.value)}
              />
              <button 
                onClick={triggerTest}
                disabled={!config.isAvailable || config.isBotRunning || config.coolingRemainingMs > 0}
                className={cn(
                  "w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                  (!config.isAvailable || config.isBotRunning || config.coolingRemainingMs > 0) 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {config.isBotRunning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> BOT BUSY</>
                ) : config.coolingRemainingMs > 0 ? (
                  <><History className="w-3.5 h-3.5" /> COOLING ({Math.ceil(config.coolingRemainingMs / 1000 / 60)}m)</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> RUN TEST</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              <h3 className="text-sm font-bold">Security Notice</h3>
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-100/70">
              Bot actions are recorded for audit purposes. Ensure your TOTP secret is stored in encrypted environment variables before production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
