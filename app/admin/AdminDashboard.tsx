"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, PackageSearch, FileWarning, Pencil, Search, Clock, Save, X, ExternalLink, Activity } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard({ role }: { role: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'timeline' | 'claims'>('users');

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] p-6 lg:p-12 font-sans selection:bg-[#C5A059] selection:text-white border-8 border-[#1A1A1A] flex flex-col h-screen overflow-hidden">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-[#C5A059] flex items-center justify-center shadow-[0_0_15px_rgba(197,160,89,0.3)]">
            <Activity className="text-[#0A0A0A]" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-serif italic text-[#F5F2ED] tracking-wide">Command Center</h1>
            <p className="text-[#888888] text-[10px] tracking-[0.2em] uppercase mt-0.5">Role: {role}</p>
          </div>
        </div>
        <div className="flex bg-[#111111] border border-[#333333] rounded-sm p-1 items-center">
          <TabButton id="users" icon={<Users size={16} />} label="Users" activeTab={activeTab} setActive={setActiveTab} />
          <TabButton id="timeline" icon={<Clock size={16} />} label="Timeline" activeTab={activeTab} setActive={setActiveTab} />
          <TabButton id="claims" icon={<FileWarning size={16} />} label="Claims" activeTab={activeTab} setActive={setActiveTab} />
          <div className="h-4 w-px bg-[#333333] mx-2"></div>
          <Link href="/receiver" className="text-[#888888] hover:text-[#C5A059] text-[10px] uppercase font-bold tracking-widest px-2 transition-colors">Receiver</Link>
          <Link href="/inspector" className="text-[#888888] hover:text-[#C5A059] text-[10px] uppercase font-bold tracking-widest px-2 transition-colors">Inspector</Link>
          <div className="h-4 w-px bg-[#333333] mx-2"></div>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch (e) {}
              router.push('/login');
            }}
            className="text-[#FF4444] hover:text-[#FF9999] text-[10px] uppercase font-bold tracking-widest px-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-[#111111] border border-[#333333] shadow-2xl flex flex-col">
          {activeTab === 'users' && <UsersTab role={role} />}
          {activeTab === 'timeline' && <TimelineTab role={role} />}
          {activeTab === 'claims' && <ClaimsTab />}
        </div>
      </main>

    </div>
  );
}

// --- TABS COMPONENTS ---

function TabButton({ id, icon, label, activeTab, setActive }: any) {
  const isActive = activeTab === id;
  return (
    <button 
      onClick={() => setActive(id)}
      className={`flex items-center space-x-2 px-6 py-2.5 text-xs font-medium tracking-wider uppercase transition-all duration-300 ${
        isActive ? 'bg-[#1A1A1A] text-[#C5A059] border border-[#C5A059]/30 shadow-[0_0_10px_rgba(197,160,89,0.1)]' : 'text-[#666666] hover:text-[#E0E0E0] hover:bg-[#151515] border border-transparent'
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  );
}

function UsersTab({ role }: { role: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('RECEIVER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const res = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE'
      });
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
           <h2 className="text-xl font-light text-[#F5F2ED] uppercase tracking-widest">User Management</h2>
           <p className="text-[#888888] text-xs tracking-wider mt-1">Manage personnel access and roles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border border-[#333333] bg-[#0A0A0A] p-6 h-fit">
          <h3 className="text-sm uppercase tracking-widest text-[#C5A059] mb-6">Authorize Personnel</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#666666] mb-1">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                className="w-full bg-[#111111] border border-[#333333] text-[#E0E0E0] px-4 py-2 text-sm focus:border-[#C5A059] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#666666] mb-1">Full Name (Optional)</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} 
                className="w-full bg-[#111111] border border-[#333333] text-[#E0E0E0] px-4 py-2 text-sm focus:border-[#C5A059] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#666666] mb-1">Assigned Role</label>
              <select value={targetRole} onChange={e => setTargetRole(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] text-[#E0E0E0] px-4 py-2 text-sm focus:border-[#C5A059] focus:outline-none transition-colors">
                {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-[#FF4444] mt-2">{error}</p>}
            {success && <p className="text-xs text-[#34A853] mt-2">{success}</p>}
            <button type="submit" className="w-full mt-4 bg-[#1A1A1A] border border-[#333333] hover:border-[#C5A059] text-[#E0E0E0] px-4 py-3 text-xs uppercase tracking-widest transition-colors font-medium">
              Grant Access
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 border border-[#333333] bg-[#0A0A0A] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#333333] bg-[#111111]">
            <h3 className="text-xs uppercase tracking-widest text-[#E0E0E0]">Active Personnel Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#111111] text-[#666666] text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium text-right">Items Proc.</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A] text-[#B0B0B0]">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading directory...</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="hover:bg-[#111111]/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-[#E0E0E0]">{user.email}</td>
                    <td className="px-6 py-4">{user.email.split('@')[0]}</td>
                    <td className="px-6 py-4">
                      <span className="bg-[#1A1A1A] border border-[#333333] px-2 py-1 text-[10px] tracking-wide uppercase text-[#C5A059]">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs">{user.itemsProcessed}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {(role === 'ADMIN' && user.role !== 'SUPER_ACCESS' && user.role !== 'ADMIN') ? (
                        <button 
                          onClick={() => handleDelete(user.id, user.email)} 
                          className="text-[#FF4444] hover:text-[#FF9999] uppercase font-bold tracking-widest text-[10px]"
                        >
                          Revoke
                        </button>
                      ) : null}
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

function TimelineTab({ role }: { role: string }) {
  const [awb, setAwb] = useState('');
  const [manifest, setManifest] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
// Modal State removed for regular Admin
  
  const handleSearch = async (e: any) => {
    e.preventDefault();
    if (!awb.trim()) return;
    setLoading(true); setManifest(null); setError('');
    try {
      const res = await fetch(`/api/manifest/${awb.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setManifest(data.manifest);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (recordId: string, recordType: string, currentVal: string) => {
    // Regular Admins cannot edit timeline timestamps
  };

  const handleUpdateTimestamp = async () => {
    // Removed
  };

  // Compile chronologically
  let events: any[] = [];
  if (manifest) {
    if (manifest.expectedDate) events.push({ type: 'Manifest_Expected', id: manifest.id, time: manifest.expectedDate, title: 'Expected from Marketplace' });
    if (manifest.receivedAt) events.push({ type: 'Manifest_Received', id: manifest.id, time: manifest.receivedAt, title: 'Received at Dock' });
    manifest.handshakes.forEach((h: any) => events.push({ type: 'Handshake', id: h.id, time: h.timestamp, title: `Handshake: ${h.type.replace(/_/g, ' ')}` }));
    const i = manifest.inspection;
    if (i) events.push({ type: 'Inspection', id: i.id, time: i.completedAt, title: `Inspected - Missing: ${i.isMissingItems}` });
    manifest.returnItems?.forEach((d: any) => events.push({ type: 'ReturnItem', id: d.id, time: new Date().toISOString(), title: `Return Item: ${d.sku} - ${d.condition}` }));
    events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-8 border-b border-[#333333] shrink-0">
        <h2 className="text-xl font-light text-[#F5F2ED] uppercase tracking-widest mb-4">Package Timeline</h2>
        <form onSubmit={handleSearch} className="flex max-w-xl">
          <div className="flex-1 flex bg-[#0A0A0A] border border-[#333333] focus-within:border-[#C5A059] transition-colors">
            <div className="pl-4 flex items-center justify-center text-[#666666]"><Search size={16} /></div>
            <input 
              type="text" 
              placeholder="Scan or enter Tracking AWB..." 
              value={awb} onChange={e => setAwb(e.target.value)}
              className="w-full bg-transparent border-none text-[#E0E0E0] px-4 py-3 text-sm focus:outline-none font-mono placeholder-[#444444]" 
            />
          </div>
          <button type="submit" disabled={loading} className="px-8 bg-[#1A1A1A] border-y border-r border-[#333333] hover:bg-[#C5A059] hover:text-[#0A0A0A] transition-colors uppercase tracking-widest text-[11px] font-bold">
            Track
          </button>
        </form>
        {error && <p className="text-xs text-[#FF4444] mt-3">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {loading ? (
          <div className="text-center text-[#666666] text-xs uppercase tracking-widest">Searching records...</div>
        ) : manifest ? (
          <div className="max-w-2xl mx-auto py-4">
            <div className="mb-12 flex justify-between items-end border-b border-[#333333] pb-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-1">Marketplace / Order</p>
                <p className="text-lg text-[#F5F2ED]">{manifest.marketplace} <span className="text-[#888888] mx-2">/</span> <span className="font-mono text-sm">{manifest.orderId}</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-1">Status</p>
                <p className="text-[#C5A059] text-xs tracking-wider uppercase font-medium">{manifest.status.replace(/_/g, ' ')}</p>
              </div>
            </div>

            <div className="relative border-l border-[#333333] ml-4 space-y-12 pb-12">
              {events.map((ev, i) => (
                <div key={i} className="relative pl-8 group">
                  <div className="absolute -left-2 top-1.5 w-4 h-4 bg-[#111111] border-2 border-[#C5A059] rounded-full shadow-[0_0_8px_rgba(197,160,89,0.5)]"></div>
                  <h4 className="text-sm font-medium text-[#E0E0E0] uppercase tracking-wider">{ev.title}</h4>
                  <div className="flex items-center space-x-3 mt-1.5">
                    <p className="text-xs font-mono text-[#888888]">{new Date(ev.time).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="pl-8 text-xs text-[#666666]">No history recorded.</p>}
            </div>
          </div>
        ) : (
          !error && <div className="text-center text-[#444444] text-xs uppercase tracking-widest h-full flex items-center justify-center">Awaiting query parameters</div>
        )}
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
      <div className="shrink-0 flex justify-between items-end border-b border-[#333333] pb-4">
         <div>
            <h2 className="text-xl font-light text-[#F5F2ED] uppercase tracking-widest">Claims Staging</h2>
            <p className="text-[#888888] text-xs tracking-wider mt-1">Pending marketplace reimbursements.</p>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto bg-[#0A0A0A] border border-[#333333]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#111111] text-[#666666] text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-[#333333]">
            <tr>
              <th className="px-6 py-4 font-medium">Tracking AWB</th>
              <th className="px-6 py-4 font-medium">Order ID</th>
              <th className="px-6 py-4 font-medium">Condition Filter</th>
              <th className="px-6 py-4 font-medium">Evidence Data</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A] text-[#B0B0B0]">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-xs">Loading items...</td></tr>
            ) : claims.map((c: any) => {
              const inspection = c.inspection;
              const cond = inspection?.isMissingItems ? 'MISSING ITEMS' : 'INSPECTED';
              const ev = inspection?.evidenceUrl;
              return (
                <tr key={c.id} className="hover:bg-[#111111]/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-[#E0E0E0]">{c.trackingAwb}</td>
                  <td className="px-6 py-4 font-mono text-[11px]">{c.orderId}</td>
                  <td className="px-6 py-4 text-xs font-medium text-[#FF9999]">{cond}</td>
                  <td className="px-6 py-4">
                    {ev ? (
                      <a href={ev} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-[#C5A059] hover:text-white text-xs border border-[#C5A059]/30 px-2 py-1 bg-[#1A1A1A]">
                        <span>View Artifact</span> <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#666666]">None attached</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleResolve(c.id)} className="text-[10px] uppercase font-bold tracking-widest text-[#34A853] hover:text-white transition-colors">
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
