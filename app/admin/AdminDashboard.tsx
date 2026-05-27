"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, PackageSearch, FileWarning, Pencil, Search, Clock, Save, X, ExternalLink, Activity, Bell, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Info, CheckCircle2, Menu, User, Shield, Package, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ user, onClose }: { user: { name: string; email: string; role: string }; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(d => {
      if (d.user) setProfile(d.user);
    }).catch(() => {});
  }, []);

  const roleLabel = user.role.replace(/_/g, ' ');
  const roleColors: Record<string, string> = {
    SUPER_ACCESS: 'bg-black text-[#FF6700] border-black',
    ADMIN: 'bg-slate-50 text-[#313079] border-slate-200',
    RECEIVER: 'bg-[#FF6700]/5 text-[#FF6700] border-[#FF6700]/10',
    INSPECTOR: 'bg-[#FF6700]/5 text-[#FF6700] border-[#FF6700]/10',
  };

  const resolvedName = profile?.name || (user.name !== user.email ? user.name : '') || user.email;
  const isEmail = resolvedName.includes('@');
  const initials = isEmail
    ? resolvedName.slice(0, 2).toUpperCase()
    : resolvedName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-black to-slate-900 p-8 text-white relative border-b border-black/10">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
            {initials}
          </div>
          <h2 className="text-xl font-black text-white">{resolvedName}</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-mono">{user.email}</p>
          <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-black border-black text-[#FF6700]">
            {roleLabel}
          </span>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4 bg-[#FF6700]/5 border-t border-[#313079]/5">
          {profile ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-[#FF6700]/10 shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package size={14} className="text-[#FF6700]" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Items Processed</p>
                  </div>
                  <p className="text-2xl font-black text-[#313079] font-mono">{profile.itemsProcessed ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp size={14} className="text-green-500" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Accuracy Rate</p>
                  </div>
                  <p className="text-2xl font-black text-green-600 font-mono">{profile.accuracyRate?.toFixed(1) ?? '100.0'}%</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar size={14} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#313079]/50">Member Since</p>
                </div>
                <p className="text-sm font-bold text-[#313079]">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs uppercase tracking-widest animate-pulse">Loading profile...</div>
          )}

          <div className="h-px bg-[#313079]/10" />
          <p className="text-[10px] text-slate-400 text-center font-medium">
            Profile is read-only. Contact Super Admin to update details.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard({ role, name, email, userId }: { role: string; name: string; email: string; userId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'claims' | 'alerts'>('alerts');
  const [alertCount, setAlertCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [activeSopAlertId, setActiveSopAlertId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUserData(d.user); })
      .catch(() => {});
  }, []);

  const displayName = userData?.name || (name !== email ? name : '') || 'Admin';
  const isEmail = displayName.includes('@');
  const initials = isEmail
    ? displayName.slice(0, 2).toUpperCase()
    : displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

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
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const handleResolveAlert = async (alertId: string) => {
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
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative">

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={{ name: displayName, email, role }}
          onClose={() => setShowProfile(false)}
        />
      )}

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
                const isSopOpen = activeSopAlertId === alert.id;
                const steps = sopMap[alert.type] || [];
                return (
                  <div key={alert.id} className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-2.5 relative pl-4 text-left">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                          {alert.level} - {alert.type}
                        </span>
                        <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{alert.description}</p>
                      </div>
                      <button 
                        onClick={() => setActiveSopAlertId(isSopOpen ? null : alert.id)}
                        className="text-[9px] text-[#FF6700] hover:text-[#FF6700]/80 font-black uppercase tracking-wider ml-2 shrink-0 border border-[#FF6700]/20 rounded-md px-2 py-0.5"
                      >
                        {isSopOpen ? 'Close' : 'SOP'}
                      </button>
                    </div>

                    {isSopOpen && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-wider text-[#FF6700]">SOP Steps:</p>
                          <ul className="space-y-1">
                            {steps.map((step: any, idx: number) => (
                              <li key={step.id || idx} className="text-[10px] text-[#313079]/90 font-medium flex items-start space-x-1.5">
                                <span className="font-mono font-bold text-[#FF6700]">{step.stepOrder}.</span>
                                <span className="leading-snug">{step.instruction}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex space-x-1.5 items-center pt-1 border-t border-[#313079]/10">
                          <input 
                            type="text" 
                            placeholder="RESOLVE NOTES" 
                            value={resolutionText}
                            onChange={e => setResolutionText(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] uppercase font-bold focus:outline-none focus:border-[#FF6700] text-slate-900"
                          />
                          <button 
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={!resolutionText.trim() || resolvingId === alert.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 text-[9px] font-black uppercase rounded-md"
                          >
                            {resolvingId === alert.id ? '...' : 'Resolve'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-black text-white shrink-0 shadow-lg z-20 flex items-center justify-between px-6 h-14 border-b border-white/10 w-full">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
            <ShieldAlert className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[120px]" title={displayName}>{displayName}</h1>
            <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className={`relative p-1 hover:text-white transition-colors ${showNotifications ? 'text-white' : 'text-slate-400'}`}
            title="Notifications & Alerts"
          >
            <Bell size={22} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-black animate-pulse">
                {alertCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="p-1 text-white/70 hover:text-white focus:outline-none"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 lg:z-20 w-64 bg-black text-white flex flex-col border-r border-black/10 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FF6700] rounded-lg flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
              <ShieldAlert className="text-white" size={16} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none truncate max-w-[160px]" title={displayName}>{displayName}</h1>
              <p className="text-[#FF6700] text-[9px] tracking-[0.15em] uppercase font-bold mt-0.5">{role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-white/50 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <TabButton id="users"    icon={<Users size={14} />}       label="Users"    activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          <TabButton id="alerts"   icon={<Bell size={14} />}        label="Alerts"   activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={alertCount > 0 ? alertCount : undefined} />
          <TabButton id="claims"   icon={<FileWarning size={14} />} label="Claims"   activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3">
          <div className="flex flex-col space-y-1">
            <Link 
              href="/receiver" 
              className="flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all uppercase tracking-wider"
            >
              <PackageSearch size={14} />
              <span>Receiver View</span>
            </Link>
            <Link 
              href="/inspector" 
              className="flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all uppercase tracking-wider"
            >
              <Activity size={14} />
              <span>Inspector View</span>
            </Link>
          </div>
          
          <div className="h-px bg-white/10"></div>

          {/* Clickable Profile Section */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors group text-left"
            title="View Profile"
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-tight break-words">{displayName}</p>
              <p className="text-[9px] uppercase tracking-widest text-[#FF6700] font-bold mt-0.5">
                {role.replace(/_/g, ' ')}
              </p>
            </div>
            <User size={12} className="text-[#FF6700]/70 group-hover:text-white transition-colors shrink-0" />
          </button>

          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
              router.push('/login');
            }}
            className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-50 flex flex-col">
        {/* Main Content Top Bar (Desktop only) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-[#313079]">
              {activeTab === 'users' ? 'User Directory' : activeTab === 'claims' ? 'Claims Staging' : 'Operational Alerts'}
            </h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Returns Management App &bull; {role.replace(/_/g, ' ')}
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setShowNotifications(!showNotifications)} 
              className={`relative p-1.5 hover:text-[#313079] transition-colors ${showNotifications ? 'text-[#313079]' : 'text-slate-400'}`}
              title="Alerts Center"
            >
              <Bell size={24} />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>
            
            <button 
              onClick={() => setShowProfile(true)} 
              className="flex items-center space-x-2.5 p-1 group border-l border-slate-200 pl-4"
              title="Profile"
            >
              <div className="w-8 h-8 rounded-full bg-[#FF6700]/10 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700] text-xs font-black group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-[#313079] transition-colors">{displayName}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 relative overflow-hidden">
          <div className="absolute inset-6 bg-white border border-slate-200 shadow-xl flex flex-col rounded-2xl overflow-hidden">
            {activeTab === 'users'    && <UsersTab role={role} currentUserId={userId} />}
            {activeTab === 'alerts'   && <AlertsTab userRole={role} />}
            {activeTab === 'claims'   && <ClaimsTab />}
          </div>
        </div>
      </main>

    </div>
  );
}

// --- TABS COMPONENTS ---

function TabButton({ id, icon, label, activeTab, setActive, badge }: any) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActive(id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all group overflow-hidden relative rounded-lg ${
        isActive
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? 'text-[#FFF700]' : 'text-[#FF6700]/70'}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function UsersTab({ role, currentUserId }: { role: string; currentUserId?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('RECEIVER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('RECEIVER');
  const [editItemsProcessed, setEditItemsProcessed] = useState(0);
  const [editAccuracyRate, setEditAccuracyRate] = useState(100.0);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [updating, setUpdating] = useState(false);

  const availableRoles = ['RECEIVER', 'INSPECTOR'];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => { fetchUsers(); }); }, []);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'RECEIVER');
    setEditItemsProcessed(user.itemsProcessed || 0);
    setEditAccuracyRate(user.accuracyRate ?? 100.0);
    setEditError('');
    setEditSuccess('');
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setEditError(''); setEditSuccess('');
    setUpdating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          name: editName,
          email: editEmail,
          role: editRole,
          itemsProcessed: editItemsProcessed,
          accuracyRate: editAccuracyRate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditSuccess('User updated successfully.');
      setTimeout(() => setEditingUser(null), 1000);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role: targetRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User created successfully.');
      setEmail(''); setName('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to completely remove access for ${userEmail}?`)) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User deleted successfully.');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-8 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">User Management</h2>
           <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Manage personnel access and roles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border border-slate-200 bg-slate-50 p-6 h-fit rounded-md shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FF6700] mb-6">Authorize Personnel</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Role</label>
              <select value={targetRole} onChange={e => setTargetRole(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>}
            {success && <p className="text-xs text-green-600 mt-2 font-medium">{success}</p>}
            <button type="submit" className="w-full mt-4 bg-white border border-slate-300 hover:border-[#FF6700] hover:text-[#FF6700] hover:bg-[#FF6700]/5 text-slate-700 px-4 py-3 text-xs uppercase tracking-widest transition-all font-semibold rounded">
              Grant Access
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 border border-slate-200 bg-white overflow-hidden flex flex-col rounded-md shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700">Active Personnel Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium text-right">Items Proc.</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading directory...</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-[10px] font-black shrink-0">
                          {(user.name || user.email).slice(0, 2).toUpperCase()}
                        </div>
                        <span>{user.name || <span className="text-slate-400 italic text-xs">No name</span>}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="bg-[#FF6700]/5 border border-[#FF6700]/10 px-2 py-1 text-[10px] tracking-wide uppercase text-[#FF6700] font-bold rounded-sm">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs">{user.itemsProcessed}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      <div className="flex justify-end items-center space-x-3">
                        {user.id !== currentUserId && (user.role === 'RECEIVER' || user.role === 'INSPECTOR') && (
                          <button 
                            onClick={() => openEditModal(user)} 
                            className="text-indigo-600 hover:text-indigo-800 uppercase font-bold tracking-widest text-[10px]"
                          >
                            Edit
                          </button>
                        )}
                        {user.id !== currentUserId && (user.role === 'RECEIVER' || user.role === 'INSPECTOR') && (
                          <button 
                            onClick={() => handleDelete(user.id, user.email)} 
                            className="text-red-500 hover:text-red-700 uppercase font-bold tracking-widest text-[10px]"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">No active personnel.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Premium Edit User Dialog (Restricted to RECEIVER & INSPECTOR for Admin) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-black to-slate-900 p-6 text-white flex justify-between items-center border-b border-black/10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#FF6700]">Edit Personnel</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Modifying {editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={editEmail} onChange={e => setEditEmail(e.target.value)} 
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} 
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                  {['RECEIVER', 'INSPECTOR'].map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Items Processed</label>
                  <input type="number" min="0" required value={editItemsProcessed} onChange={e => setEditItemsProcessed(parseInt(e.target.value, 10) || 0)} 
                    className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Accuracy Rate (%)</label>
                  <input type="number" step="0.1" min="0" max="100" required value={editAccuracyRate} onChange={e => setEditAccuracyRate(parseFloat(e.target.value) || 0.0)} 
                    className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded" />
                </div>
              </div>
              {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}
              {editSuccess && <p className="text-xs text-green-600 font-medium">{editSuccess}</p>}
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updating} className="flex-1 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded shadow-sm disabled:opacity-50 transition-colors">
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimsTab() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/claims');
      const data = await res.json();
      if (res.ok) setClaims(data.claims);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => { fetchClaims(); }); }, []);

  const handleResolve = async (id: string) => {
    if (!confirm('Mark claim as resolved?')) return;
    try {
      const res = await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestId: id })
      });
      if (res.ok) fetchClaims();
    } catch(err) {
      alert('Error updating claim');
    }
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-6 overflow-hidden">
      <div className="shrink-0 flex justify-between items-end border-b border-slate-200 pb-4">
         <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Claims Staging</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Pending marketplace reimbursements.</p>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto bg-white border border-slate-200 rounded-md shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Tracking AWB</th>
              <th className="px-6 py-4 font-medium">Order ID</th>
              <th className="px-6 py-4 font-medium">Condition Filter</th>
              <th className="px-6 py-4 font-medium">Evidence Data</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading items...</td></tr>
            ) : claims.map((c: any) => {
              const inspection = c.inspection;
              const cond = inspection?.isMissingItems ? 'MISSING ITEMS' : 'INSPECTED';
              const ev = inspection?.evidenceUrl;
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-800 font-medium">{c.trackingId}</td>
                  <td className="px-6 py-4 font-mono text-[11px]">{c.orderId}</td>
                  <td className="px-6 py-4 text-xs font-bold text-red-500">{cond}</td>
                  <td className="px-6 py-4">
                    {ev ? (
                      <a href={ev} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-[#FF6700] hover:text-[#FF6700] hover:bg-[#FF6700]/5 text-xs border border-[#FF6700]/20 px-2 py-1 bg-white rounded-sm transition-colors">
                        <span>View Artifact</span> <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">None attached</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleResolve(c.id)} className="text-[10px] uppercase font-bold tracking-widest text-green-600 hover:text-green-700 transition-colors">
                      Mark Resolved
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && claims.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">No pending claims.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: any; label: string; action: string }> = {
  L4: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', icon: <ShieldAlert size={18} className="text-red-600" />, label: 'CRITICAL', action: 'Phone + WhatsApp' },
  L3: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: <AlertTriangle size={18} className="text-orange-600" />, label: 'HIGH', action: 'Dashboard Banner' },
  L2: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: <Bell size={18} className="text-amber-600" />, label: 'MEDIUM', action: 'Email / Push' },
  L1: { color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: <Info size={18} className="text-slate-500" />, label: 'LOW', action: 'In-app only' },
};

function AlertsTab({ userRole }: { userRole: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [counts, setCounts] = useState<any>({ L1: 0, L2: 0, L3: 0, L4: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingSopType, setEditingSopType] = useState<string | null>(null);
  const [editingSopSteps, setEditingSopSteps] = useState<{ stepOrder: number; instruction: string }[]>([]);
  const [savingSop, setSavingSop] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolutionText, setBulkResolutionText] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [quickResolvingId, setQuickResolvingId] = useState<string | null>(null);
  const [resolveDataErrors, setResolveDataErrors] = useState<Record<string, string>>({});

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?resolved=${showResolved}`);
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.alerts || []);
        setSopMap(data.sopMap || {});
        if (data.counts) setCounts(data.counts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { queueMicrotask(() => { fetchAlerts(); }); }, [showResolved]);

  const handleResolve = async (alertId: string, alertLevel: string) => {
    setResolveError('');
    if (!resolutionText.trim() && !confirm('Resolve without notes?')) return;
    setResolving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || 'Failed to resolve');
        return;
      }
      setExpandedId(null);
      setResolutionText('');
      fetchAlerts();
    } finally {
      setResolving(false);
    }
  };

  const startEditSop = (alertType: string) => {
    const existing = sopMap[alertType] || [];
    setEditingSopSteps(existing.length > 0
      ? existing.map(s => ({ stepOrder: s.stepOrder, instruction: s.instruction }))
      : [{ stepOrder: 1, instruction: '' }]
    );
    setEditingSopType(alertType);
  };

  const saveSop = async () => {
    if (!editingSopType) return;
    setSavingSop(true);
    try {
      await fetch('/api/alerts/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: editingSopType, steps: editingSopSteps }),
      });
      setEditingSopType(null);
      fetchAlerts();
    } finally {
      setSavingSop(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(alerts.map((a: any) => a.id)));
  const selectNone = () => setSelectedIds(new Set());
  const selectNext10 = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      alerts.filter((a: any) => !next.has(a.id)).slice(0, 10).forEach((a: any) => next.add(a.id));
      return next;
    });
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkResolutionText.trim() && !confirm(`Resolve ${selectedIds.size} alert${selectedIds.size > 1 ? 's' : ''} without notes?`)) return;
    setBulkResolving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(alertId =>
          fetch('/api/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId, resolution: bulkResolutionText.trim() || 'Bulk resolved by admin', forceResolve: true }),
          })
        )
      );
      setSelectedIds(new Set());
      setBulkResolutionText('');
      fetchAlerts();
    } finally {
      setBulkResolving(false);
    }
  };

  const handleQuickResolve = async (alertId: string) => {
    setQuickResolvingId(alertId);
    setResolveDataErrors(prev => { const next = { ...prev }; delete next[alertId]; return next; });
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: 'Resolved by admin' }),
      });
      const data = await res.json();
      if (res.status === 422 && data.dataIssue) {
        setResolveDataErrors(prev => ({ ...prev, [alertId]: data.error }));
      } else if (res.ok) {
        setExpandedId(null);
        fetchAlerts();
      } else {
        setResolveDataErrors(prev => ({ ...prev, [alertId]: data.error || 'Failed to resolve alert.' }));
      }
    } catch {
      setResolveDataErrors(prev => ({ ...prev, [alertId]: 'Network error. Please try again.' }));
    } finally {
      setQuickResolvingId(null);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // ADMIN can now see and resolve all L1-L4 alerts.
  const isAdminView = userRole === 'ADMIN';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats Header */}
      <div className="shrink-0 p-6 border-b border-slate-200 bg-slate-50">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Alert Centre</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Escalations &amp; incidents requiring action.</p>
          </div>
          <div className="flex items-center space-x-2">
            {isAdminView && (
              <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded">
                L1–L4 Visible
              </span>
            )}
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest border rounded transition-colors ${
                showResolved ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF6700]'
              }`}
            >
              {showResolved ? 'Show Active' : 'Show Resolved'}
            </button>
          </div>
        </div>

        {/* Bulk Selection Controls */}
        {!showResolved && alerts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {selectedIds.size > 0 ? (
              <>
                <span className="text-xs font-black text-[#FF6700] shrink-0">
                  {selectedIds.size} / {alerts.length} selected
                </span>
                <input
                  value={bulkResolutionText}
                  onChange={e => setBulkResolutionText(e.target.value)}
                  placeholder="Bulk resolution note (optional)..."
                  className="flex-1 min-w-[200px] bg-white border border-slate-300 px-3 py-1.5 text-xs rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                />
                <button
                  onClick={handleBulkResolve}
                  disabled={bulkResolving}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded transition-colors shadow-sm shrink-0"
                >
                  {bulkResolving ? 'Resolving...' : `✓ Resolve ${selectedIds.size}`}
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 border border-slate-300 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-slate-400 transition-colors shrink-0"
                >
                  Deselect All
                </button>
              </>
            ) : (
              <>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">Bulk Select:</span>
                <button
                  onClick={() => selectNext10()}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  + 10 Alerts
                </button>
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#FF6700] hover:text-[#FF6700] transition-colors"
                >
                  Select All ({alerts.length})
                </button>
              </>
            )}
          </div>
        )}

        {!showResolved && (
          <div className="grid grid-cols-4 gap-3">
            {(['L1', 'L2', 'L3', 'L4'] as const).map(level => {
              const cfg = LEVEL_CONFIG[level];
              const isHidden = false;
              return (
                <div key={level} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg px-4 py-3 shadow-sm ${isHidden ? 'opacity-30' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-2xl font-mono font-black ${cfg.color}`}>{isHidden ? '—' : (counts[level] || 0)}</p>
                    <div className="shrink-0">{cfg.icon}</div>
                  </div>
                  <p className={`text-[9px] uppercase tracking-widest font-black ${cfg.color}`}>{cfg.label}</p>
                  <p className={`text-[8px] uppercase tracking-widest font-bold mt-0.5 ${cfg.color} opacity-60`}>{cfg.action}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-lg">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">
              {showResolved ? 'No resolved alerts' : 'All Clear — No Active Alerts'}
            </h3>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.L1;
            const isExpanded = expandedId === alert.id;
            const sopSteps = sopMap[alert.type] || [];
            const canResolve = true;

            return (
              <div
                key={alert.id}
                className={`bg-white border ${cfg.borderColor} rounded-lg overflow-hidden shadow-sm transition-all ${
                  alert.level === 'L4' ? 'ring-1 ring-red-200' : ''
                } ${selectedIds.has(alert.id) ? 'ring-2 ring-[#FF6700]/40' : ''}`}
              >
                <div className={`flex items-stretch ${cfg.bgColor}`}>
                  {/* Checkbox */}
                  {!showResolved && (
                    <div
                      className="flex items-center pl-4 pr-2 shrink-0 border-r border-black/5 cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleSelect(alert.id); }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(alert.id)}
                        onChange={() => toggleSelect(alert.id)}
                        className="w-4 h-4 cursor-pointer accent-[#FF6700] rounded"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {/* Alert Header Button */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); setResolveError(''); }}
                    className={`flex-1 flex items-center justify-between ${!showResolved ? 'pl-3 pr-5' : 'px-5'} py-4 ${cfg.bgColor} hover:brightness-95 transition-all text-left`}
                  >
                  <div className="flex items-center space-x-3 min-w-0">
                     <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.bgColor} border ${cfg.borderColor}`}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{alert.level} — {cfg.label}</span>
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bgColor} ${cfg.borderColor} opacity-70`}>{cfg.action}</span>
                        {alert.resolved && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">RESOLVED</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{alert.title}</p>
                      {alert.targetUser && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          → {alert.targetUser.name || alert.targetUser.email} <span className="opacity-60">({alert.targetUser.role})</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    {alert.manifest && (
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{alert.manifest.trackingId}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">{timeAgo(alert.createdAt)}</span>
                    {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  </div>
                  </button>
                  {/* Quick Resolve Button */}
                  {!alert.resolved && !showResolved && (
                    <div
                      className="flex items-center px-3 shrink-0 border-l border-black/5"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleQuickResolve(alert.id)}
                        disabled={quickResolvingId === alert.id}
                        title="Quick Resolve — checks that the underlying issue is fixed before resolving"
                        className="text-[9px] font-black uppercase tracking-widest text-green-600 hover:text-green-800 disabled:opacity-50 border border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded transition-all whitespace-nowrap"
                      >
                        {quickResolvingId === alert.id ? '···' : '✓ Resolve'}
                      </button>
                    </div>
                  )}
                </div>
                {/* Data-check error banner */}
                {resolveDataErrors[alert.id] && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0">⚠ Data Check:</span>
                    <p className="text-[10px] text-amber-700 flex-1 leading-snug">{resolveDataErrors[alert.id]}</p>
                    <button
                      onClick={() => setResolveDataErrors(prev => { const next = { ...prev }; delete next[alert.id]; return next; })}
                      className="text-amber-400 hover:text-amber-600 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 py-5 space-y-4 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-sm text-slate-600 leading-relaxed">{alert.description}</p>

                    {/* SOP Steps */}
                    {editingSopType === alert.type ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Edit Resolution Steps</h4>
                          <div className="flex space-x-2">
                            <button onClick={() => setEditingSopType(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button onClick={saveSop} disabled={savingSop} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700]">
                              {savingSop ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                        {editingSopSteps.map((step, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400 w-6">{i + 1}.</span>
                            <input
                              value={step.instruction}
                              onChange={e => {
                                const updated = [...editingSopSteps];
                                updated[i] = { ...updated[i], instruction: e.target.value };
                                setEditingSopSteps(updated);
                              }}
                              className="flex-1 bg-white border border-slate-300 px-3 py-2 text-sm rounded focus:border-[#FF6700] focus:outline-none"
                              placeholder="Step instruction..."
                            />
                            <button
                              onClick={() => setEditingSopSteps(editingSopSteps.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 p-1"
                            ><X size={14} /></button>
                          </div>
                        ))}
                        <button
                          onClick={() => setEditingSopSteps([...editingSopSteps, { stepOrder: editingSopSteps.length + 1, instruction: '' }])}
                          className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest"
                        >+ Add Step</button>
                      </div>
                    ) : sopSteps.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Resolution SOP</h4>
                          <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest flex items-center space-x-1">
                            <Pencil size={10} /><span>Edit</span>
                          </button>
                        </div>
                        <ol className="space-y-2">
                          {sopSteps.map((step: any, i: number) => (
                            <li key={step.id || i} className="flex items-start space-x-3">
                              <span className="shrink-0 w-6 h-6 bg-[#FF6700]/10 text-[#FF6700] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <p className="text-sm text-slate-700">{step.instruction}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">No SOP configured for this alert type.</p>
                        <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] hover:text-[#FF6700] tracking-widest">
                          + Create SOP Steps
                        </button>
                      </div>
                    )}

                    {/* Resolve Action */}
                    {!alert.resolved && (
                      <div className="space-y-2">
                        {!canResolve ? (
                          <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            <ShieldAlert size={14} className="text-red-500 shrink-0" />
                            <p className="text-xs text-red-700 font-bold">L4 Critical alerts can only be resolved by Super Access.</p>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3 pt-2">
                            <input
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              placeholder="Resolution notes (optional)..."
                              className="flex-1 bg-white border border-slate-300 px-4 py-3 text-sm rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                            />
                            <button
                              onClick={() => handleResolve(alert.id, alert.level)}
                              disabled={resolving}
                              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors shadow-sm disabled:opacity-50"
                            >
                              {resolving ? 'Resolving...' : 'Resolve'}
                            </button>
                          </div>
                        )}
                        {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
                      </div>
                    )}

                    {/* Resolved info */}
                    {alert.resolved && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Resolved</p>
                        <p className="text-sm text-green-800">{alert.resolution || 'No notes'}</p>
                        <p className="text-[10px] text-green-600 mt-2">
                          By: {alert.resolvedBy?.name || alert.resolvedBy?.email || 'System'} • {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
