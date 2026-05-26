"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, PackageSearch } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [showBypass, setShowBypass] = useState(false);
  const router = useRouter();
  
  // Prevent hydration mismatch
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const handleGoogleSuccess = async (credential: string) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        setError(data.error || 'Google Authentication failed');
      } else {
        setError('');
        
        // Save role locally (if needed for downstream UI logic)
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
      setError(`A network error occurred during Google Sign-In: ${err.message}`);
    }
  };

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
        
        // Save role locally
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

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="bg-white text-[#313079] min-h-screen flex flex-col font-sans overflow-hidden border-8 border-slate-100 transition-colors duration-500 relative">
        <header className="p-8 md:p-12 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-[#000000] border border-[#FF6700]/20 rounded shadow-md flex items-center justify-center hover:scale-105 transition-transform duration-300">
              <PackageSearch size={20} strokeWidth={2.5} className="text-[#FF6700]" />
            </div>
            <span className="text-lg font-black tracking-[0.25em] uppercase text-[#313079]">Aegis System</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Internal Deployment v1.0.4</div>
        </header>

        {/* Dynamic Blurred Background Decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#FF6700]/10 to-[#313079]/15 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" />

        <main className="flex-1 flex flex-col justify-center items-center px-6 md:px-12 pb-24 relative z-10">
          <div className="w-full max-w-md text-center space-y-10">
            
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-[#313079] leading-tight drop-shadow-sm">Returns Management App</h1>
              <p className="text-slate-500 font-bold text-xs tracking-widest leading-relaxed uppercase">
                Secure, access-controlled ecosystem for reverse logistics operations. Verification via organizational identity is required for entry.
              </p>
            </div>
            
            <div className="pt-4 space-y-6 flex flex-col items-center">
              
              {/* Primary Google Sign-In */}
              <div className="w-full flex flex-col items-center space-y-3">
                <div className="w-full max-w-[320px] flex justify-center py-2 animate-in fade-in zoom-in-95 duration-500">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      if (credentialResponse.credential) {
                        await handleGoogleSuccess(credentialResponse.credential);
                      }
                    }}
                    onError={() => {
                      setError("Google Authentication failed. Please try again.");
                    }}
                    theme="filled_blue"
                    shape="rectangular"
                    size="large"
                    text="signin_with"
                    width="320"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed text-center">
                  Secure single sign-on with organization Google Workspace
                </p>
              </div>
 
              {/* Decorative Divider */}
              <div className="w-full flex items-center justify-between my-2 max-w-[320px]">
                <div className="h-[1px] bg-slate-200 flex-1"></div>
                <span className="text-[9px] font-black text-slate-300 uppercase px-3 tracking-widest">or</span>
                <div className="h-[1px] bg-slate-200 flex-1"></div>
              </div>
 
              {/* Developer Sandbox Bypass Collapsible Trigger */}
              <div className="w-full max-w-[320px] text-center">
                <button
                  type="button"
                  onClick={() => setShowBypass(!showBypass)}
                  className="text-[9px] text-slate-400 hover:text-[#FF6700] transition-colors uppercase font-bold tracking-widest focus:outline-none"
                >
                  {showBypass ? 'Hide Sandbox Options [-]' : 'Developer Sandbox Bypass [+]'}
                </button>
 
                {showBypass && (
                  <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 w-full text-left">
                    <form onSubmit={handleLogin} className="flex flex-col space-y-3">
                       <input
                          type="email"
                          placeholder="ENTER EMAIL ADDRESS"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-6 py-4 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#FF6700] focus:ring-1 focus:ring-[#FF6700] transition-all shadow-sm uppercase tracking-widest text-xs text-center"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full flex justify-center items-center space-x-2 py-4 border border-slate-300 rounded-md bg-white hover:bg-[#FF6700]/5 hover:border-[#FF6700] hover:shadow-md transition-all duration-300 outline-none text-xs font-black tracking-widest uppercase text-slate-700 hover:text-[#FF6700]"
                        >
                          <span>Design Mode Login</span>
                        </button>
                     </form>
 
                     <div className="flex flex-col items-start space-y-2 px-6 py-4 bg-[#FF6700]/5 border border-[#FF6700]/10 rounded-md text-left w-full shadow-sm hover:shadow-md transition-shadow">
                       <div className="flex items-center space-x-2">
                         <ShieldCheck className="h-4 w-4 text-[#FF6700] shrink-0" />
                         <strong className="text-[11px] text-[#FF6700] font-black uppercase tracking-wider">Design Mode Active</strong>
                       </div>
                       <p className="text-[10px] text-[#313079]/80 uppercase tracking-widest leading-relaxed font-bold">
                         Google Auth bypassed for testing. Just enter the email address of a user in your database.
                       </p>
                     </div>
                   </div>
                 )}
               </div>
 
               {error && (
                 <div className="flex items-center space-x-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-left w-full max-w-[320px] shadow-sm animate-in fade-in slide-in-from-top-2 mt-4">
                   <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                   </svg>
                   <span className="text-[11px] text-red-700 font-bold uppercase tracking-wider leading-relaxed">{error}</span>
                 </div>
               )}
             </div>
           </div>
         </main>
 
         <footer className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-200 bg-white/50 backdrop-blur-sm z-10 relative">
           <div className="space-y-2">
             <p className="text-[10px] uppercase text-slate-400 tracking-tighter font-black">Security Protocol</p>
             <p className="text-xs font-bold text-slate-600">Encrypted Session (AES-256)</p>
           </div>
           <div className="space-y-2 max-md:text-left md:text-center">
             <p className="text-[10px] uppercase text-slate-400 tracking-tighter font-black">Access Restrictions</p>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Internal warehouse systems. Unauthorized access strictly prohibited.</p>
           </div>
           <div className="space-y-2 md:text-right">
           </div>
         </footer>
      </div>
    </GoogleOAuthProvider>
  );
}
