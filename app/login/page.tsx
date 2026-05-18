"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, PackageSearch } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  
  // Prevent hydration mismatch
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }), // Bypassing Google OAuth for design mode
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        setError('');
        
        // Mock auth for design mode
        localStorage.setItem('userRole', data.role);
        
        // Route according to roles established in PRD Document
        if (data.role === 'SUPER_ACCESS') {
          router.push('/super-admin');
        } else if (data.role === 'ADMIN') {
          router.push('/admin');
        } else if (data.role === 'RECEIVER') {
          router.push('/receiver');
        } else {
          router.push('/inspector');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(`A network error occurred: ${err.message}`);
    }
  };

  if (!mounted) return null;

  return (
    <div className="bg-[#0A0A0A] text-[#E0E0E0] min-h-screen flex flex-col font-sans overflow-hidden border-8 border-[#1A1A1A]">
      <header className="p-8 md:p-12 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#C5A059] flex items-center justify-center">
            <PackageSearch size={20} strokeWidth={2} className="text-[#0A0A0A]" />
          </div>
          <span className="text-xl font-light tracking-[0.3em] uppercase">Aegis System</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-[#666666]">Internal Deployment v1.0.4</div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-6 md:px-12 pb-24">
        <div className="w-full max-w-md text-center space-y-12">
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#F5F2ED] leading-tight">Returns Command Center</h1>
            <p className="text-[#888888] font-light text-sm tracking-wide leading-relaxed uppercase">
              Secure, access-controlled ecosystem for reverse logistics operations. Verification via organizational identity is required for entry.
            </p>
          </div>
          
          <div className="pt-8 space-y-6">
            <form onSubmit={handleLogin} className="flex flex-col space-y-4">
               <input
                 type="email"
                 placeholder="ENTER EMAIL ADDRESS"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full px-6 py-4 bg-[#111111] border border-[#333333] text-[#E0E0E0] focus:outline-none focus:border-[#C5A059] transition-colors uppercase tracking-widest text-xs text-center"
                 required
               />
               <button
                 type="submit"
                 className="w-full flex justify-center items-center space-x-2 py-5 border border-[#333333] bg-[#111111] hover:bg-[#1A1A1A] hover:border-[#C5A059] transition-all duration-300 outline-none text-sm font-medium tracking-widest uppercase text-[#E0E0E0] group-hover:text-[#C5A059]"
               >
                 <span>Design Mode Login</span>
               </button>
            </form>

            <div className="flex flex-col items-start space-y-2 px-6 py-4 bg-[#1A1212] border border-[#3D1A1A] text-left w-full">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-[#FF4444] shrink-0" />
                <strong className="text-[11px] text-[#FF9999] uppercase tracking-wider">Design Mode Active</strong>
              </div>
              <p className="text-[10px] text-[#FF9999] opacity-80 uppercase tracking-widest leading-relaxed">
                Google Auth bypassed for testing. Just enter the email address of a user in your database.
              </p>
            </div>

            {error && (
              <div className="flex items-center space-x-4 px-4 py-3 bg-[#1A1212] border border-[#3D1A1A] text-left w-full">
                <svg className="w-5 h-5 text-[#FF4444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span className="text-[11px] text-[#FF9999] uppercase tracking-wider leading-relaxed">{error}</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#1A1A1A]">
        <div className="space-y-2">
          <p className="text-[10px] uppercase text-[#666666] tracking-tighter">Security Protocol</p>
          <p className="text-xs font-light text-[#999999]">Encrypted Session (AES-256)</p>
        </div>
        <div className="space-y-2 max-md:text-left md:text-center">
          <p className="text-[10px] uppercase text-[#666666] tracking-tighter">Access Restrictions</p>
          <p className="text-[10px] font-light text-[#999999] uppercase tracking-widest leading-relaxed">Internal warehouse systems. Unauthorized access strictly prohibited.</p>
        </div>
        <div className="space-y-2 md:text-right">
          <p className="text-[10px] uppercase text-[#666666] tracking-tighter">Inquiries</p>
          <p className="text-xs font-light text-[#C5A059]">Contact Administrator</p>
        </div>
      </footer>
    </div>
  )
}
