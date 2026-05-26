/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Triage from './pages/Triage';
import SmartFiling from './pages/SmartFiling';
import RecoveryHubTab from './pages/RecoveryHubTab';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/filing" element={<SmartFiling />} />
          <Route path="/recovery" element={<RecoveryHubTab />} />
          <Route path="/audit" element={<Placeholder title="QC Audit" />} />
          <Route path="/performance" element={<Placeholder title="Performance Reports" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
        <span className="text-2xl animate-pulse">🛠️</span>
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-slate-500 text-sm">This module is currently under development.</p>
    </div>
  );
}

