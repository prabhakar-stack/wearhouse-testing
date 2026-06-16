'use client';

import React, { useState, useEffect } from 'react';
import { Save, Clock, ShieldAlert, CheckCircle } from 'lucide-react';

export default function SettingsTab() {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      if (res.ok && data.config) {
        setStartTime(data.config.startTime || '00:00');
        setEndTime(data.config.endTime || '24:00');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load warehouse configuration.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings.');
      }

      setMessage({ type: 'success', text: 'Warehouse operational hours updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred while saving.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <div className="w-8 h-8 border-4 border-[#FF6700] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-light text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <Clock size={20} className="text-[#FF6700]" />
          <span>Warehouse Operations Control</span>
        </h2>
        <p className="text-slate-500 text-xs tracking-wider mt-1 font-medium">
          Manage operating windows. Alert counters accumulate duration ONLY during these hours.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert size={16} className="text-red-600 mt-0.5 shrink-0" />
          )}
          <p className="text-xs font-bold uppercase tracking-wider leading-relaxed">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Operational Shift Timing</h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Shift Start Time
              </label>
              <input 
                type="time" 
                required 
                value={startTime} 
                onChange={e => setStartTime(e.target.value)} 
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Shift End Time
              </label>
              <input 
                type="time" 
                required 
                value={endTime} 
                onChange={e => setEndTime(e.target.value)} 
                className="w-full bg-white border border-slate-300 text-slate-800 px-4 py-2.5 text-sm font-mono focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] focus:outline-none transition-all rounded"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Overnight Support</p>
            <p className="text-[10px] text-amber-600 leading-relaxed font-bold uppercase tracking-wide">
              Shifts extending past midnight (e.g. 22:00 to 06:00) are automatically split at midnight by the alert processor to prevent calculation drift.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-[#FF6700] hover:bg-[#FF6700]/90 disabled:opacity-50 text-white px-5 py-3 text-xs uppercase tracking-widest font-black rounded shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={13} />
            )}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
