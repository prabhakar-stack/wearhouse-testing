import { headers } from 'next/headers';
import ReceiverDashboard from './ReceiverDashboard';
import { AlertOctagon } from 'lucide-react';

export default async function ReceiverPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || '';
  const role = headersList.get('x-user-role') || '';
  
  if (role !== 'RECEIVER' && role !== 'ADMIN' && role !== 'SUPER_ACCESS') {
    return (
      <div className="h-screen w-screen bg-[#FF4444] text-white flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-[#CC0000]">
        <AlertOctagon size={120} className="mb-8" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight">Access Denied</h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-[#FF9999]">Invalid Role Authorization</p>
      </div>
    );
  }

  return <ReceiverDashboard userId={userId} role={role} />;
}
