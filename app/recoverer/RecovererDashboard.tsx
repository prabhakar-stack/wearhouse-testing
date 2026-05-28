"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  Bell,
  ChevronDown,
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";

interface RecovererDashboardProps {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export default function RecovererDashboard({
  userId,
  role,
  name,
  email,
}: RecovererDashboardProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <RefreshCw size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                Recoverer
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Dashboard
              </p>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <User size={18} className="text-slate-600" />
              <span className="text-sm font-bold text-slate-700">{name}</span>
              <ChevronDown
                size={16}
                className={`text-slate-600 transition-transform ${
                  isUserMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Logged in as
                  </p>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-red-50 text-red-600 font-bold text-sm uppercase tracking-wider transition-colors"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Items in Recovery
                </p>
                <p className="text-3xl font-black text-slate-900 mt-2">0</p>
              </div>
              <RefreshCw size={32} className="text-purple-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Recovered This Week
                </p>
                <p className="text-3xl font-black text-slate-900 mt-2">0</p>
              </div>
              <CheckCircle2 size={32} className="text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Failed Recoveries
                </p>
                <p className="text-3xl font-black text-slate-900 mt-2">0</p>
              </div>
              <AlertTriangle size={32} className="text-red-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <iframe src="http://localhost:5000/recoveryhubtab" className="w-full h-screen border-none" style={{
              height: "calc(100vh - 200px)", 
            }}/>
        </div>
      </main>
    </div>
  );
}
