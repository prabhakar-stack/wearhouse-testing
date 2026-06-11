import { Outlet } from 'react-router-dom';
import { LanguageProvider } from '../utils/i18n';

export default function Layout() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white text-slate-900">
        <main className="min-h-screen">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </LanguageProvider>
  );
}
