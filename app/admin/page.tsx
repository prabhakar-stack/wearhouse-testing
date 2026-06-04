import { headers } from 'next/headers';
import AdminDashboard from './AdminDashboard';
import AccessDenied from '@/app/components/AccessDenied';
import { prisma } from '@/lib/prisma';

export default async function AdminPage() {
  const headersList = await headers();
  const role = headersList.get('x-user-role') || '';
  const email = headersList.get('x-user-email') || '';
  const userId = headersList.get('x-user-id') || '';
  
  if (role !== 'SUPER_ACCESS' && role !== 'ADMIN') {
    return <AccessDenied message="Invalid Role Authorization" />;
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
