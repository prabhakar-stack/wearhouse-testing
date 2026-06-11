import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../utils/i18n';
import { Languages } from 'lucide-react';

function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const isHindi = lang === 'hi';

  return (
    <button
      onClick={() => setLang(isHindi ? 'en' : 'hi')}
      title={isHindi ? 'Switch to English' : 'हिंदी में जाएं'}
      className="
        fixed bottom-5 right-5 z-[200]
        flex items-center gap-2
        px-3.5 py-2.5
        bg-slate-900 text-white
        border-2 border-black
        rounded-2xl
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        transition-all duration-150
        text-xs font-extrabold tracking-wider
        select-none
      "
    >
      <Languages className="w-3.5 h-3.5 text-[#FFF700]" />
      <span className="text-[#FFF700]">{isHindi ? 'EN' : 'हि'}</span>
      <span className="text-slate-400 font-normal">|</span>
      <span>{isHindi ? 'English' : 'हिंदी'}</span>
    </button>
  );
}

export default function Layout() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white text-slate-900">
        <main className="min-h-screen">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
        <LanguageToggle />
      </div>
    </LanguageProvider>
  );
}
