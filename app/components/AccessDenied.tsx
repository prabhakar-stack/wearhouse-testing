"use client";

import { useEffect, useState } from "react";
import { AlertOctagon } from "lucide-react";
import { getStoredLanguage, translateInstruction, PreferredLanguage } from "@/lib/i18n";

interface AccessDeniedProps {
  message?: string;
}

export default function AccessDenied({ message = "Invalid Role Authorization" }: AccessDeniedProps) {
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");
  const lang = preferredLanguage === 'hi' ? 'hi' : 'en';

  useEffect(() => {
    requestAnimationFrame(() => {
      setPreferredLanguage(getStoredLanguage());
    });
    const syncLanguage = () => setPreferredLanguage(getStoredLanguage());
    window.addEventListener("preferred-language-changed", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("preferred-language-changed", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-red-50 text-red-800 flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-red-200">
      <AlertOctagon size={120} className="mb-8 text-red-400" />
      <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight text-red-700">
        {lang === 'hi' ? 'प्रवेश अस्वीकृत' : 'Access Denied'}
      </h1>
      <p className="text-xl mt-6 font-bold tracking-wider text-red-500">
        {lang === 'hi' ? 'अमान्य भूमिका प्राधिकरण' : message}
      </p>
    </div>
  );
}
