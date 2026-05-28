import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ListFilter, 
  FileText, 
  ShieldCheck, 
  Settings,
  ChevronRight,
  Package,
  Scan,
  TrendingUp,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  Wrench
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Dashboard Overview', path: '/', icon: LayoutDashboard },
  { name: 'Triage Queue', path: '/triage', icon: ListFilter, badge: '4' },
  { name: 'Smart Filing Hub', path: '/filing', icon: Bot },
  { name: 'Recovery Hub', path: '/recovery', icon: Wrench, badge: 'NEW' },
  { name: 'QC Audit', path: '/audit', icon: ShieldCheck },
  { name: 'Performance', path: '/performance', icon: TrendingUp },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
      />

      <aside id="sidebar" className={cn(
        "h-screen bg-[#000000] border-r border-black/10 flex flex-col fixed left-0 top-0 z-[60] transition-all duration-300",
        // Mobile state
        mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        // Desktop state
        !mobileOpen && (collapsed ? "w-20" : "w-64")
      )}>
        <div id="sidebar-header" className={cn(
          "p-6 flex items-center justify-between",
          (collapsed && !mobileOpen) && "px-4"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            {(!collapsed || mobileOpen) && <h1 className="text-xl font-extrabold tracking-tight text-white animate-in fade-in duration-300">ClaimsHub</h1>}
          </div>
          <button 
            onClick={mobileOpen ? onMobileClose : onToggle}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
          >
            {mobileOpen ? <PanelLeftClose className="w-4 h-4" /> : !collapsed && <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {(collapsed && !mobileOpen) && (
          <div className="px-4 mb-4">
            <button 
              onClick={onToggle}
              className="w-full flex justify-center p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        <nav id="sidebar-nav" className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center rounded-lg text-sm font-semibold transition-all group overflow-hidden relative",
              (collapsed && !mobileOpen) ? "px-3 py-3 justify-center" : "px-3 py-2.5 justify-between",
              isActive 
                ? "bg-white text-[#000000] shadow-md shadow-black/10" 
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title={(collapsed && !mobileOpen) ? item.name : undefined}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[#FF6700]" : "text-[#FF6700]/70")} />
                  {(!collapsed || mobileOpen) && <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.name}</span>}
                </div>
                {(!collapsed || mobileOpen) && item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
                {(collapsed && !mobileOpen) && item.badge && (
                  <div className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border border-black" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div id="sidebar-footer" className={cn(
        "p-4 border-t border-white/10 mt-auto",
        (collapsed && !mobileOpen) && "px-2"
      )}>
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group",
          (collapsed && !mobileOpen) && "justify-center"
        )}>
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center overflow-hidden border border-white/30 shrink-0">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0 animate-in fade-in duration-300">
              <p className="text-sm font-bold text-white truncate">Claims Specialist</p>
              <p className="text-xs text-white/50 truncate">kruti@cubelelo.com</p>
            </div>
          )}
          {(!collapsed || mobileOpen) && <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white" />}
        </div>
      </div>
    </aside>
    </>
  );
}
