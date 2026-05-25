"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, PackageSearch, FileWarning, Pencil, Search, Clock, Save, X, ExternalLink, Activity, Shield, Bell, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Info, CheckCircle2, Menu, User, Package, TrendingUp, Calendar } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'users' | 'claims' | 'alerts'>('alerts');
  const [alertCount, setAlertCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUserData(d.user); })
      .catch(() => {});
  }, []);

  const displayName = userData?.name || (name !== email ? name : '') || email;
  const isEmail = displayName.includes('@');
  const initials = isEmail
    ? displayName.slice(0, 2).toUpperCase()
    : displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Fetch alert count for badge
  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/alerts').then(r => r.json()).then(d => {
        if (d.counts) setAlertCount(d.counts.total || 0);
      }).catch(() => {});
    };
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="h-screen w-screen bg-white text-[#313079] font-sans flex flex-col lg:flex-row overflow-hidden relative">

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={{ name: displayName, email, role }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-black text-white shrink-0 shadow-lg z-20 flex items-center justify-between px-6 h-14 border-b border-white/10 w-full">
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
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-1 text-white/70 hover:text-white focus:outline-none"
        >
          <Menu size={22} />
        </button>
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
      <main className="flex-1 overflow-hidden relative bg-slate-50 p-6">
        <div className="absolute inset-6 bg-white border border-slate-200 shadow-xl flex flex-col rounded-2xl overflow-hidden">
          {activeTab === 'users'    && <UsersTab role={role} />}
          {activeTab === 'alerts'   && <AlertsTab />}
          {activeTab === 'claims'   && <ClaimsTab />}
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

function UsersTab({ role }: { role: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('ADMIN');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableRoles = ['ADMIN', 'RECEIVER', 'INSPECTOR'];

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
           <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">Manage personnel access and roles globally.</p>
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
                    <td className="px-6 py-4 text-right font-mono text-xs">{user.itemsProcessed}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {user.role !== 'SUPER_ACCESS' && (
                        <button 
                          onClick={() => handleDelete(user.id, user.email)} 
                          className="text-red-500 hover:text-red-700 uppercase font-bold tracking-widest text-[10px]"
                        >
                          Revoke
                        </button>
                      )}
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
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingSopType, setEditingSopType] = useState<string | null>(null);
  const [editingSopSteps, setEditingSopSteps] = useState<{ stepOrder: number; instruction: string }[]>([]);
  const [savingSop, setSavingSop] = useState(false);

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
    } finally { setLoading(false); }
  };

  useEffect(() => { queueMicrotask(() => { fetchAlerts(); }); }, [showResolved]);

  const handleResolve = async (alertId: string) => {
    if (!resolutionText.trim() && !confirm('Resolve without notes?')) return;
    setResolving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, resolution: resolutionText }),
      });
      if (res.ok) { setExpandedId(null); setResolutionText(''); fetchAlerts(); }
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
              <div key={alert.id} className={`bg-white border ${cfg.borderColor} rounded-lg overflow-hidden shadow-sm transition-all ${alert.level === 'L4' ? 'ring-1 ring-red-200' : ''}`}>
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : alert.id); setResolutionText(''); }}
                  className={`w-full flex items-center justify-between px-5 py-4 ${cfg.bgColor} hover:brightness-95 transition-all text-left`}
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
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">No SOP configured.</p>
                        <button onClick={() => startEditSop(alert.type)} className="text-[10px] uppercase font-bold text-[#FF6700] tracking-widest">+ Create SOP Steps</button>
                      </div>
                    )}
                    {!alert.resolved && (
                      <div className="flex items-center space-x-3 pt-2">
                        <input value={resolutionText} onChange={e => setResolutionText(e.target.value)} placeholder="Resolution notes..." className="flex-1 bg-white border border-slate-300 px-4 py-3 text-sm rounded focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]" />
                        <button onClick={() => handleResolve(alert.id)} disabled={resolving} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors shadow-sm disabled:opacity-50">{resolving ? 'Resolving...' : 'Resolve'}</button>
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
