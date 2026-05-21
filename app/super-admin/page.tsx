import { headers } from 'next/headers';
import SuperAdminDashboard from './SuperAdminDashboard';
import { AlertOctagon } from 'lucide-react';

export default async function SuperAdminPage() {
  const headersList = await headers();
  const role = headersList.get('x-user-role') || '';
  const name = headersList.get('x-user-name') || '';
  const email = headersList.get('x-user-email') || '';
  const userId = headersList.get('x-user-id') || '';
  
  if (role !== 'SUPER_ACCESS') {
    return (
      <div className="h-screen w-screen bg-red-50 text-red-800 flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-red-200">
        <AlertOctagon size={120} className="mb-8 text-red-400" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight text-red-700">Access Denied</h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-red-500">Requires Super Admin Privileges</p>
      </div>
    );
  }

  return <SuperAdminDashboard role={role} name={name} email={email} userId={userId} />;
}
