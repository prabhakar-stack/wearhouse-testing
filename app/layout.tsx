"use client";
import { useEffect, useState } from 'react';
import LanguagePreference from '@/app/components/LanguagePreference';
import { getStoredLanguage, setStoredLanguage, type PreferredLanguage } from '@/lib/i18n';
import './globals.css'; // Global styles

export default function RootLayout({children}: {children: React.ReactNode}) {
  const [language, setLanguage] = useState<PreferredLanguage>(() => getStoredLanguage());

  useEffect(() => {
    const sync = () => setLanguage(getStoredLanguage());
    sync();
    window.addEventListener('preferred-language-changed', sync as any);
    window.addEventListener('storage', sync as any);
    return () => {
      window.removeEventListener('preferred-language-changed', sync as any);
      window.removeEventListener('storage', sync as any);
    };
  }, []);

  return (
    <html lang={language}>
      <body suppressHydrationWarning>
        <div className="fixed top-4 right-4 z-50">
          <LanguagePreference />
        </div>
        {children}
      </body>
    </html>
  );
}
