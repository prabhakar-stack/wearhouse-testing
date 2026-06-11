"use client";

import { LogOut, X } from "lucide-react";
import { type PreferredLanguage } from "@/lib/i18n";

interface LogoutConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
  preferredLanguage: PreferredLanguage;
}

export default function LogoutConfirmModal({
  onClose,
  onConfirm,
  preferredLanguage,
}: LogoutConfirmModalProps) {
  const lang = preferredLanguage === "hi" ? "hi" : "en";

  const t = {
    title: lang === "hi" ? "लॉगआउट की पुष्टि करें" : "Confirm Logout",
    message:
      lang === "hi"
        ? "क्या आप निश्चित रूप से अपने सेशन से लॉगआउट करना चाहते हैं?"
        : "Are you sure you want to log out of your session?",
    cancel: lang === "hi" ? "रद्द करें" : "Cancel",
    confirm: lang === "hi" ? "लॉगआउट" : "Logout",
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          title={t.cancel}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 text-white text-center relative overflow-hidden border-b border-black/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <LogOut size={100} className="text-white" />
          </div>
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-4 shadow-lg shadow-red-500/5">
            <LogOut size={24} />
          </div>
          <h2 className="text-lg font-black tracking-wide uppercase">{t.title}</h2>
        </div>

        {/* Modal Content */}
        <div className="p-6 text-center bg-[#FF6700]/5">
          <p className="text-sm font-semibold text-[#313079]/80 leading-relaxed">
            {t.message}
          </p>

          <div className="flex gap-4 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-red-500/20"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
