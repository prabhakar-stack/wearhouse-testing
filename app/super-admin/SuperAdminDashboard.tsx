"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, PackageSearch, FileWarning, Pencil, Search, Clock, Save, X, ExternalLink, Activity, Shield, Bell, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Info, CheckCircle2, Menu, User, Package, TrendingUp, Calendar, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ user, onClose }: { user: { name: string; email: string; role: string }; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(d => {
      if (d.user) setProfile(d.user);
    }).catch(() => {});
  }, []);

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
        {/* Header gradient — black & slate gradient */}
        <div className="bg-gradient-to-br from-black to-slate-900 p-8 text-white relative border-b border-black/10">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="w-16 h-16 rounded-full bg-black border-2 border-[#FF6700] flex items-center justify-center text-[#FF6700] text-2xl font-black mb-4 shadow-lg shadow-black/30">
            {initials}
          </div>
          <h2 className="text-xl font-black text-white">{resolvedName}</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-mono">{user.email}</p>
          <div className="mt-3 flex items-center space-x-2">
            <Shield size={12} className="text-[#FF6700]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6700]">
              {user.role.replace(/_/g, ' ')}
            </span>
          </div>
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
            Full system access · All alert levels visible
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard({ role, name, email, userId }: { role: string; name: string; email: string; userId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'claims' | 'alerts' | 'triage' | 'smart-filing' | 'recovery' | 'qc'>('alerts');
  
  const userRoleLower = role?.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const isAdminOrSuper = userRoleLower === 'admin' || userRoleLower === 'super access' || userRoleLower === 'super_access' || userRoleLower === 'super-access';
  const canAccessTriage = userRoleLower === 'claims specialist' || isAdminOrSuper;
  const canAccessSmartFiling = userRoleLower === 'claims specialist' || isAdminOrSuper;
  const canAccessRecovery = userRoleLower === 'recoverer' || isAdminOrSuper;
  const canAccessQC = userRoleLower === 'qc agent' || userRoleLower === 'qcagent' || isAdminOrSuper;
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

  const displayName = userData?.name || (name !== email ? name : '') || 'Super Admin';
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
                return (
                  <div key={alert.id} className="bg-white border border-[#313079]/10 p-3 rounded-xl shadow-sm flex flex-col space-y-1 relative pl-4 text-left">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6700] rounded-l-xl" />
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700">
                          {alert.level} - {alert.type}
                        </span>
                        <h4 className="font-bold text-[#313079] mt-1 text-xs leading-tight">{alert.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{alert.description}</p>
                        {alert.manifest?.trackingId && (
                          <span className="inline-block mt-1 text-[8px] font-mono text-slate-400 uppercase">
                            AWB: {alert.manifest.trackingId}
                          </span>
                        )}
                      </div>
                    </div>
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
          <TabButton id="users"    icon={<Users size={14} />}       label="Users"          activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          <TabButton id="alerts"   icon={<Bell size={14} />}        label="Alerts"         activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} badge={alertCount > 0 ? alertCount : undefined} />
          <TabButton id="claims"   icon={<FileWarning size={14} />} label="Claims"         activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          {canAccessTriage && (
            <TabButton id="triage" icon={<FileWarning size={14} />} label="Claims Triage" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessSmartFiling && (
            <TabButton id="smart-filing" icon={<Activity size={14} />} label="Smart Filing Monitor" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessRecovery && (
            <TabButton id="recovery" icon={<PackageSearch size={14} />} label="Recovery Hub" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
          {canAccessQC && (
            <TabButton id="qc" icon={<CheckCircle2 size={14} />} label="QC Audit" activeTab={activeTab} setActive={(tab: any) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />
          )}
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
            {/* Avatar with orange ring for consistent super access look */}
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
              {activeTab === 'users' 
                ? 'User Directory' 
                : activeTab === 'claims' 
                ? 'Claims Staging' 
                : activeTab === 'triage'
                ? 'Claims Triage'
                : activeTab === 'smart-filing'
                ? 'Smart Filing Monitor'
                : activeTab === 'recovery'
                ? 'Recovery Hub'
                : activeTab === 'qc'
                ? 'QC Audit'
                : 'Operational Alerts'}
            </h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Returns Management App &bull; {role.replace(/_/g, ' ')}
            </p>
          </div>
          
          <div className="flex items-center">
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
          </div>
        </header>

        <div className="flex-1 p-6 relative overflow-hidden">
          <div className="absolute inset-6 bg-white border border-slate-200 shadow-xl flex flex-col rounded-2xl overflow-hidden">
            {activeTab === 'users'    && <UsersTab role={role} currentUserId={userId} />}
            {activeTab === 'alerts'   && <AlertsTab />}
            {activeTab === 'claims'   && <ClaimsTab />}
            {activeTab === 'triage' && canAccessTriage && (
              <iframe src="http://localhost:5000/triage" className="w-full h-screen border-none" />
            )}
            {activeTab === 'smart-filing' && canAccessSmartFiling && (
              <iframe src="http://localhost:5000/smartfiling" className="w-full h-screen border-none" />
            )}
            {activeTab === 'recovery' && canAccessRecovery && (
              <iframe src="http://localhost:5000/recoveryhubtab" className="w-full h-screen border-none" />
            )}
            {activeTab === 'qc' && canAccessQC && (
              <iframe src="http://localhost:5000/qcaudittab" className="w-full h-screen border-none" />
            )}
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
  const [targetRole, setTargetRole] = useState('ADMIN');
  const [alertLevel, setAlertLevel] = useState('');
  const [showCreateBlock, setShowCreateBlock] = useState(false);
  const createBlockRef = useRef<HTMLDivElement>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('ADMIN');
  const [editItemsProcessed, setEditItemsProcessed] = useState(0);
  const [editAccuracyRate, setEditAccuracyRate] = useState(100.0);
  const [editAlertLevel, setEditAlertLevel] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [updating, setUpdating] = useState(false);

  const availableRoles = ['ADMIN', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST','RECOVERER','QC_AGENT', 'SUPER_ACCESS'];

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
    setEditRole(user.role || 'ADMIN');
    setEditItemsProcessed(user.itemsProcessed || 0);
    setEditAccuracyRate(user.accuracyRate ?? 100.0);
    setEditAlertLevel(user.alertLevel || '');
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
          accuracyRate: editAccuracyRate,
          alertLevel: editAlertLevel || null
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

  const handleToggleCreateBlock = () => {
    setError('');
    setSuccess('');
    setShowCreateBlock(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          createBlockRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      return next;
    });
  };

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role: targetRole, alertLevel: alertLevel || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User created successfully.');
      setEmail(''); setName(''); setAlertLevel('');
      setTimeout(() => setShowCreateBlock(false), 1000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = (user: any) => {
    setError(''); setSuccess('');
    setDeletingUser(user);
    setDeleteConfirmEmail('');
  };

  const confirmDelete = async (id: string) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('User deleted successfully.');
      setTimeout(() => {
        setDeletingUser(null);
        setDeleteConfirmEmail('');
      }, 1000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 space-y-8 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-end shrink-0 border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">User Management</h2>
           <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Manage personnel access and roles globally.</p>
        </div>
        <button 
          onClick={handleToggleCreateBlock} 
          className="bg-black hover:bg-[#FF6700] hover:text-white text-[#FF6700] border border-[#FF6700] px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <span>+ Authorize Personnel</span>
        </button>
      </div>

      <div className="w-full border border-slate-200 bg-white overflow-hidden flex flex-col rounded-xl shadow-sm">
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
                <th className="px-6 py-4 font-medium">Alert Level</th>
                <th className="px-6 py-4 font-medium text-right">Items Proc.</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-xs">Loading directory...</td></tr>
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
                    <span className={`px-2 py-1 text-[10px] tracking-wide uppercase font-bold rounded-sm border ${
                      user.role === 'SUPER_ACCESS' 
                        ? 'bg-black border-black text-[#FF6700]'
                        : user.role === 'ADMIN'
                        ? 'bg-slate-50 border-slate-200 text-[#313079]'
                        : 'bg-[#FF6700]/5 border-[#FF6700]/10 text-[#FF6700]'
                    }`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.alertLevel || ''} 
                      onChange={async (e) => {
                        const val = e.target.value;
                        try {
                          const res = await fetch('/api/users', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: user.id, alertLevel: val || null })
                          });
                          if (!res.ok) {
                            const d = await res.json();
                            alert(d.error || 'Failed to update alert level');
                          }
                          fetchUsers();
                        } catch (err) {
                          alert('Network error updating alert level');
                        }
                      }}
                      className="bg-white border border-slate-200 text-slate-800 text-[11px] font-mono px-2 py-1 focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded cursor-pointer"
                    >
                      <option value="">None</option>
                      <option value="L1">L1</option>
                      <option value="L2">L2</option>
                      <option value="L3">L3</option>
                      <option value="L4">L4</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs">{user.itemsProcessed}</td>
                  <td className="px-6 py-4 text-right font-mono text-xs">
                    <div className="flex justify-end items-center space-x-2">
                      {user.id !== currentUserId && user.role !== 'SUPER_ACCESS' && (
                        <button 
                          onClick={() => openEditModal(user)} 
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm"
                        >
                          <Pencil size={11} />
                          <span>Edit</span>
                        </button>
                      )}
                      {user.id !== currentUserId && user.role !== 'SUPER_ACCESS' && (
                        <button 
                          onClick={() => handleDelete(user)} 
                          className="flex items-center justify-center w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm"
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-xs">No active personnel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Premium Authorize Personnel Block (Shifted to the bottom) */}
      {showCreateBlock && (
        <div 
          ref={createBlockRef}
          className="w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom duration-300 shrink-0"
        >
          <div className="bg-gradient-to-br from-black to-slate-900 p-6 text-white flex justify-between items-center border-b border-black/10">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#FF6700]">Authorize Personnel</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Grant system access and permissions</p>
            </div>
            <button onClick={() => setShowCreateBlock(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. employee@company.com"
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
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Alert Level Config (Optional)</label>
                <select value={alertLevel} onChange={e => setAlertLevel(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                  <option value="">None (Default)</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                  <option value="L4">L4</option>
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            {success && <p className="text-xs text-green-600 font-medium">{success}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setShowCreateBlock(false)} className="border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-white px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded shadow-sm transition-colors">
                Grant Access
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Premium Edit User Dialog */}
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
                  {['ADMIN', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST'].map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Alert Level Config (Optional)</label>
                <select value={editAlertLevel} onChange={e => setEditAlertLevel(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2 text-sm focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded">
                  <option value="">None (Default)</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                  <option value="L4">L4</option>
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

      {/* Premium Destructive Deletion Dialog with Email Verification */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-red-700 to-red-950 p-6 text-white flex justify-between items-center border-b border-black/10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-red-200 flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <span>Confirm Deletion</span>
                </h3>
                <p className="text-[10px] text-red-300 font-bold uppercase mt-0.5 tracking-wider">Irreversible Security Action</p>
              </div>
              <button onClick={() => { setDeletingUser(null); setDeleteConfirmEmail(''); }} className="text-red-300 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Danger Zone Warning</p>
                <p className="text-xs text-red-650 leading-relaxed">
                  You are about to permanently revoke system access for <strong className="font-extrabold font-mono text-[11px] bg-red-100 px-1 py-0.5 rounded text-red-800">{deletingUser.email}</strong>. 
                  All active roles, visual evaluations, and alert configuration links for this account will be erased.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Type the user's email to verify:
                </label>
                <input 
                  type="text" 
                  value={deleteConfirmEmail} 
                  onChange={e => setDeleteConfirmEmail(e.target.value)} 
                  placeholder={deletingUser.email}
                  className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 font-mono text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all rounded" 
                />
              </div>
              
              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
              {success && <p className="text-xs text-green-600 font-medium">{success}</p>}
              
              <div className="flex space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setDeletingUser(null); setDeleteConfirmEmail(''); }} 
                  className="flex-1 border border-slate-300 text-slate-500 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={deleteConfirmEmail !== deletingUser.email}
                  onClick={() => confirmDelete(deletingUser.id)}
                  className="flex-1 bg-red-600 hover:bg-red-750 text-white disabled:bg-red-400 disabled:opacity-50 px-4 py-2.5 text-xs uppercase tracking-widest font-black rounded shadow-sm transition-all duration-200"
                >
                  Revoke Access
                </button>
              </div>
            </div>
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
              <th className="px-6 py-4 font-medium">Condition</th>
              <th className="px-6 py-4 font-medium">Evidence</th>
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
                      <a href={ev} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-[#FF6700] text-xs border border-[#FF6700]/20 px-2 py-1 bg-white rounded-sm transition-colors hover:bg-[#FF6700]/5">
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

// ─── Alerts Tab (Super Admin sees ALL levels) ─────────────────────────────────

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: any; label: string; action: string }> = {
  L4: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', icon: <ShieldAlert size={18} className="text-red-600" />, label: 'CRITICAL', action: 'Phone + WhatsApp' },
  L3: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: <AlertTriangle size={18} className="text-orange-600" />, label: 'HIGH', action: 'Dashboard Banner' },
  L2: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: <Bell size={18} className="text-amber-600" />, label: 'MEDIUM', action: 'Email / Push' },
  L1: { color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: <Info size={18} className="text-slate-500" />, label: 'LOW', action: 'In-app only' },
};

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sopMap, setSopMap] = useState<Record<string, any[]>>({});
  const [counts, setCounts] = useState<any>({ L1: 0, L2: 0, L3: 0, L4: 0, total: 0 });
  const [stats, setStats] = useState<any>({ resolvedToday: 0, sopFollowedToday: 0, adherenceRate: 100 });
  const [sopChecked, setSopChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingSopType, setEditingSopType] = useState<string | null>(null);
  const [editingSopSteps, setEditingSopSteps] = useState<{ stepOrder: number; instruction: string }[]>([]);
  const [savingSop, setSavingSop] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolutionText, setBulkResolutionText] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [quickResolvingId, setQuickResolvingId] = useState<string | null>(null);
  const [resolveDataErrors, setResolveDataErrors] = useState<Record<string, string>>({});
  const [resolveError, setResolveError] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?resolved=${showResolved}`);
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.alerts || []);
        setSopMap(data.sopMap || {});
        if (data.counts) setCounts(data.counts);
        if (data.stats) setStats(data.stats);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { queueMicrotask(() => { fetchAlerts(); }); }, [showResolved]);

  const handleResolve = async (alertId: string) => {
    setResolveError('');
    if (!resolutionText.trim()) {
      setResolveError('Resolution notes are required.');
      return;
    }
    if (!sopChecked) {
      setResolveError('You must acknowledge following the SOP.');
      return;
    }
    setResolving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText, sopAcknowledged: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || 'Failed to resolve');
        return;
      }
      setExpandedId(null);
      setResolutionText('');
      setSopChecked(false);
      fetchAlerts();
    } finally { setResolving(false); }
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
    } finally { setSavingSop(false); }
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
        // Super-admin uses forceResolve — can override data checks
        body: JSON.stringify({ alertId, resolution: 'Resolved by super-admin', forceResolve: true }),
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 p-6 border-b border-slate-200 bg-slate-50">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest">Alert Centre</h2>
            <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">System-wide escalations &amp; incidents · All levels visible.</p>
          </div>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest border rounded transition-colors ${
              showResolved ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF6700]'
            }`}
          >
            {showResolved ? 'Show Active' : 'Show Resolved'}
          </button>
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
          <div className="mb-4 bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6700]/15 border border-[#FF6700]/30 flex items-center justify-center text-[#FF6700]">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">SOP Compliance Score</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Real-time daily adherence stack</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resolved Today</p>
                <p className="text-lg font-mono font-black text-white mt-0.5">{stats.resolvedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SOP Followed</p>
                <p className="text-lg font-mono font-black text-green-400 mt-0.5">{stats.sopFollowedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adherence Rate</p>
                <p className={`text-lg font-mono font-black mt-0.5 ${stats.adherenceRate >= 90 ? 'text-green-400' : stats.adherenceRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                  {stats.adherenceRate}%
                </p>
              </div>
            </div>
          </div>
        )}

        {!showResolved && (
          <div className="grid grid-cols-4 gap-3">
            {(['L1', 'L2', 'L3', 'L4'] as const).map(level => {
              const cfg = LEVEL_CONFIG[level];
              return (
                <div key={level} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg px-4 py-3 shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-2xl font-mono font-black ${cfg.color}`}>{counts[level] || 0}</p>
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

      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs uppercase tracking-widest animate-pulse font-bold">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 bg-white rounded-lg">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">
              {showResolved ? 'No resolved alerts' : 'All Clear'}
            </h3>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.L1;
            const isExpanded = expandedId === alert.id;
            const sopSteps = sopMap[alert.type] || [];
            return (
              <div key={alert.id} className={`bg-white border ${cfg.borderColor} rounded-lg overflow-hidden shadow-sm transition-all ${alert.level === 'L4' ? 'ring-1 ring-red-200' : ''} ${selectedIds.has(alert.id) ? 'ring-2 ring-[#FF6700]/40' : ''}`}>
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
                  {/* Expand Button */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); setResolveError(''); setSopChecked(false); }}
                    className={`flex-1 flex items-center justify-between ${!showResolved ? 'pl-3 pr-5' : 'px-5'} py-4 hover:brightness-95 transition-all text-left`}
                  >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.bgColor} border ${cfg.borderColor}`}>{cfg.icon}</div>
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
                    {alert.manifest && <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{alert.manifest.trackingId}</span>}
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
                        title="Quick Resolve (Super-Admin: bypasses data check)"
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
                {isExpanded && (
                  <div className="px-5 py-5 space-y-4 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-sm text-slate-600 leading-relaxed">{alert.description}</p>
                    {editingSopType === alert.type ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Edit Resolution Steps</h4>
                          <div className="flex space-x-2">
                            <button onClick={() => setEditingSopType(null)} className="text-[10px] uppercase font-bold text-slate-500">Cancel</button>
                            <button onClick={saveSop} disabled={savingSop} className="text-[10px] uppercase font-bold text-[#FF6700]">{savingSop ? 'Saving...' : 'Save'}</button>
                          </div>
                        </div>
                        {editingSopSteps.map((step, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400 w-6">{i + 1}.</span>
                            <input value={step.instruction} onChange={e => { const u = [...editingSopSteps]; u[i] = { ...u[i], instruction: e.target.value }; setEditingSopSteps(u); }} className="flex-1 bg-white border border-slate-300 px-3 py-2 text-sm rounded focus:border-[#FF6700] focus:outline-none" placeholder="Step instruction..." />
                            <button onClick={() => setEditingSopSteps(editingSopSteps.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                          </div>
                        ))}
                        <button onClick={() => setEditingSopSteps([...editingSopSteps, { stepOrder: editingSopSteps.length + 1, instruction: '' }])} className="text-[10px] uppercase font-bold text-[#FF6700] tracking-widest">+ Add Step</button>
                      </div>
                    ) : sopSteps.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Resolution SOP</h4>
                          <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] flex items-center space-x-1"><Pencil size={10} /><span>Edit</span></button>
                        </div>
                        <ol className="space-y-2">
                          {sopSteps.map((step: any, i: number) => (
                            <li key={step.id || i} className="flex items-start space-x-3">
                              <span className="shrink-0 w-6 h-6 bg-[#FF6700]/10 text-[#FF6700] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <p className="text-sm text-slate-700">{step.instruction}</p>
                            </li>
                          ))}
                        </ol>
                        {!alert.resolved && (
                          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`sop-check-${alert.id}`}
                              checked={sopChecked}
                              onChange={(e) => setSopChecked(e.target.checked)}
                              className="w-5 h-5 accent-green-600 rounded cursor-pointer shrink-0"
                            />
                            <label htmlFor={`sop-check-${alert.id}`} className="text-xs font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                              I have read and followed all standard operating procedure steps above
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">No SOP configured.</p>
                        <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] tracking-widest">+ Create SOP Steps</button>
                      </div>
                    )}
                    {!alert.resolved && (
                      <div className="space-y-2">
                        <div className="flex flex-col space-y-3 pt-2">
                          <div className="flex items-center space-x-3">
                            <input
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              placeholder="Resolution notes (required)..."
                              className="flex-1 bg-white border border-slate-300 px-4 py-3 text-sm rounded focus:border-[#FF6700] focus:outline-none"
                            />
                            <button
                              onClick={() => handleResolve(alert.id)}
                              disabled={resolving || !sopChecked || !resolutionText.trim()}
                              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors shadow-sm"
                            >
                              {resolving ? 'Resolving...' : 'Confirm Resolve'}
                            </button>
                          </div>
                          {!sopChecked && (
                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                              ⚠ You must check "I have read and followed all standard operating procedure steps above" before resolving.
                            </p>
                          )}
                        </div>
                        {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
                      </div>
                    )}
                    {alert.resolved && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Resolved</p>
                        <p className="text-sm text-green-800">{alert.resolution || 'No notes'}</p>
                        <p className="text-[10px] text-green-600 mt-2">By: {alert.resolvedBy?.name || alert.resolvedBy?.email || 'System'} • {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}</p>
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
