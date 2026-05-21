import { 
  TrendingUp, 
  Package, 
  ShieldAlert, 
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';

const stats = [
  { name: 'Total Active Claims', value: '142', change: '+12%', icon: Package, trend: 'up' },
  { name: 'Awaiting Triage', value: '24', change: '-5%', icon: ShieldAlert, trend: 'down' },
  { name: 'Recovery Rate', value: '94.2%', change: '+2.1%', icon: CheckCircle2, trend: 'up' },
  { name: 'Projected Recovery', value: '$12,450', change: '+4%', icon: TrendingUp, trend: 'up' },
];

export default function Dashboard() {
  const [showOtpAlert, setShowOtpAlert] = useState(false);

  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const res = await fetch('/api/bot/config');
        const data = await res.json();
        setShowOtpAlert(data.isOtpRequired);
      } catch (err) {
        console.error(err);
      }
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      {showOtpAlert && (
        <div className="bg-[#FFF700] border-2 border-black p-4 rounded-2xl flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-bounce-subtle">
          <div className="flex items-center gap-4">
            <div className="bg-black p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-[#FF6700]" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-black uppercase">Manual OTP Required</p>
              <p className="text-xs text-black/70 font-medium tracking-tight">The Amazon Bot encountered an OTP request. Please visit the Smart Filing Hub to assist.</p>
            </div>
          </div>
          <a 
            href="/filing" 
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-transform"
          >
            RESOLVE NOW <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Executive Overview</h2>
        <p className="text-slate-500 text-xs lg:text-sm">Real-time recovery metrics and pipeline status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="p-6 bg-white border border-slate-100 rounded-2xl space-y-4 hover:shadow-xl hover:shadow-black/5 transition-all group">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-black rounded-xl text-[#FF6700] shadow-inner">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                stat.trend === 'up' ? "text-green-600 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100"
              )}>
                {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.name}</p>
              <p className="text-3xl font-extrabold mt-1 text-[#313079]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white border border-slate-100 rounded-2xl min-h-[400px] shadow-sm">
          <h3 className="text-sm font-extrabold text-[#313079] mb-6 flex items-center gap-2">
            Claim Volume Trends
            <span className="text-[10px] font-bold text-[#313079] bg-[#FFF700] px-2 py-0.5 rounded shadow-sm">30 DAYS</span>
          </h3>
          <div className="flex items-center justify-center min-h-[300px] text-slate-400 italic text-sm">
            [Chart Visualization Area]
          </div>
        </div>
        
        <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <h3 className="text-sm font-extrabold text-[#313079] mb-6">Pipeline Breakdown</h3>
          <div className="space-y-6">
            {[
              { label: 'Initial Handoff', value: 45, color: '#000000' },
              { label: 'Triage & Escalation', value: 20, color: '#FF6700' },
              { label: 'Filing Process', value: 85, color: '#22c55e' },
              { label: 'Reporting', value: 12, color: '#FFF700' },
            ].map((i) => (
              <div key={i.label} className="space-y-2">
                <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <span>{i.label}</span>
                  <span className="text-[#313079]">{i.value}%</span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div className={cn("h-full rounded-full transition-all duration-1000")} style={{ width: `${i.value}%`, backgroundColor: i.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
