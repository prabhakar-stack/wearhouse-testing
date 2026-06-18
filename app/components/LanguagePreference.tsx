"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  getStoredLanguage,
  setStoredLanguage,
  type PreferredLanguage,
} from "@/lib/i18n";

type LanguagePreferenceProps = {
  compact?: boolean;
};

export default function LanguagePreference({
  compact = false,
}: LanguagePreferenceProps) {
  const [language, setLanguage] = useState<PreferredLanguage>("en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    requestAnimationFrame(() => {
      setLanguage(getStoredLanguage());
    });
    const sync = () => setLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("preferred-language-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveLanguage = async (nextLanguage: PreferredLanguage) => {
    setLanguage(nextLanguage);
    setSaving(true);
    setError("");
    try {
      setStoredLanguage(nextLanguage);
      window.dispatchEvent(new CustomEvent("preferred-language-changed", { detail: nextLanguage }));
    } catch (err) {
      setError("Language update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "px-4 py-3 border-b border-slate-100" : "bg-slate-50 border border-slate-100 rounded-xl p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Languages size={13} />
            Language
          </p>
          {!compact && (
            <p className="text-xs text-slate-500 mt-1">
              SOP and workflow instructions
            </p>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shrink-0">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => saveLanguage(option.value)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-colors ${
                language === option.value
                  ? "bg-[#313079] text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
              title={option.label}
            >
              {option.nativeLabel}
            </button>
          ))}
        </div>
      </div>
      {(saving || error) && (
        <p className={`text-[10px] mt-2 font-bold uppercase tracking-widest ${error ? "text-red-500" : "text-slate-400"}`}>
          {error || "Saving..."}
        </p>
      )}
    </div>
  );
}
