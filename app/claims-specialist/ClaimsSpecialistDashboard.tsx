"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  Bell,
  ChevronDown,
  AlertOctagon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileWarning,
} from "lucide-react";

interface ClaimsSpecialistDashboardProps {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export default function ClaimsSpecialistDashboard({
  userId,
  role,
  name,
  email,
}: ClaimsSpecialistDashboardProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "triage" | "smartfiling">("overview");

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                Claims Specialist
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

        {/* Tab Navigation */}
        <div className="border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 flex items-center space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Activity size={16} />
                <span>Overview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("triage")}
              className={`px-4 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === "triage"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileWarning size={16} />
                <span>Claims Triage</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("smartfiling")}
              className={`px-4 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === "smartfiling"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Activity size={16} />
                <span>Smart Filing Monitor</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "overview" && (
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Stats Cards */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Pending Claims
                    </p>
                    <p className="text-3xl font-black text-slate-900 mt-2">0</p>
                  </div>
                  <AlertOctagon size={32} className="text-orange-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Processed Today
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
                      Disputes
                    </p>
                    <p className="text-3xl font-black text-slate-900 mt-2">0</p>
                  </div>
                  <AlertTriangle size={32} className="text-red-500 opacity-20" />
                </div>
              </div>
            </div>

            {/* Main Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
              <div className="flex items-center space-x-3 mb-6">
                <Activity size={24} className="text-blue-600" />
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                  Claims Processing Queue
                </h2>
              </div>

              <div className="bg-slate-50 rounded-lg p-12 text-center border-2 border-dashed border-slate-200">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-bold text-slate-600 uppercase tracking-wider">
                  No Claims Pending
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  New claims will appear here when they are ready for processing
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "triage" && (
          <iframe
            src="http://localhost:5000/triage"
            className="w-full h-full border-none"
            title="Claims Triage"
            style={{
              height: "calc(100vh - 200px)", 
            }}
          />
        )}

        {activeTab === "smartfiling" && (
          <iframe
            src="http://localhost:5000/smartfiling"
            className="w-full h-full border-none"
            title="Smart Filing Monitor"
            style={{
              height: "calc(100vh - 200px)", 
            }}
          />
        )}
      </main>
    </div>
  );
}
