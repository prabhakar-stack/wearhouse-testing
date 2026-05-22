import { headers } from 'next/headers';
import AdminDashboard from './AdminDashboard';
import { AlertOctagon } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export default async function AdminPage() {
  const headersList = await headers();
  const role = headersList.get('x-user-role') || '';
  const email = headersList.get('x-user-email') || '';
  const userId = headersList.get('x-user-id') || '';
  
  if (role !== 'SUPER_ACCESS' && role !== 'ADMIN') {
    return (
      <div className="h-screen w-screen bg-red-50 text-red-800 flex flex-col justify-center items-center p-6 select-none overscroll-none border-8 border-red-200">
        <AlertOctagon size={120} className="mb-8 text-red-400" />
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center leading-tight text-red-700">Access Denied</h1>
        <p className="text-xl mt-6 font-bold tracking-wider text-red-500">Invalid Role Authorization</p>
      </div>
    );
  }

  // Fetch the fresh database user name directly on the server
  let resolvedName = '';
  if (userId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });
      if (dbUser?.name) {
        resolvedName = dbUser.name;
      }
    } catch (e) {
      console.error('Error fetching database user on server:', e);
    }
  }

  // If no database name exists, fallback to the full email address
  if (!resolvedName) {
    resolvedName = email;
  }

  return <AdminDashboard role={role} name={resolvedName} email={email} userId={userId} />;
}
