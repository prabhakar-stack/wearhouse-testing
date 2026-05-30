import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '../lib/utils';
import { Menu } from 'lucide-react';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      <Sidebar 
        collapsed={collapsed} 
        onToggle={() => setCollapsed(!collapsed)} 
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className={cn(
        "flex-1 min-h-screen transition-all duration-300",
        collapsed ? "lg:ml-20" : "lg:ml-64",
        "ml-0"
      )}>
        <header className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 lg:hidden hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm text-slate-400 font-medium tracking-tight hidden sm:inline-block">WORKSPACE</span>
            <span className="text-slate-200 hidden sm:inline-block">/</span>
            <span className="text-sm font-bold text-[#313079]">Main Operations</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-1.5 bg-[#FFF700] border border-black/10 rounded-lg text-xs font-extrabold text-[#313079] hover:brightness-95 shadow-sm transition-all">
              NEW BATCH
            </button>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
