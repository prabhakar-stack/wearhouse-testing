import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        itemsProcessed: true,
        accuracyRate: true,
        createdAt: true,
      }
    });
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || (role !== 'SUPER_ACCESS' && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('id');

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Admins cannot delete Super Access or other Admins
    if (role === 'ADMIN') {
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser || targetUser.role === 'SUPER_ACCESS' || targetUser.role === 'ADMIN') {
        return NextResponse.json({ error: 'Admins can only delete RECEIVER or INSPECTOR roles.' }, { status: 401 });
      }
    }

    await prisma.user.delete({ where: { id: targetUserId } });

    return NextResponse.json({ success: true, message: 'User deleted.' });
  } catch (error: any) {
    console.error('Core User API Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const role = req.headers.get('x-user-role');
    if (!role || (role !== 'SUPER_ACCESS' && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }

    const { email, role: targetRole, name } = await req.json();

    if (role === 'ADMIN' && (targetRole === 'SUPER_ACCESS' || targetRole === 'ADMIN')) {
      return NextResponse.json({ error: 'Admins can only create RECEIVER or INSPECTOR roles.' }, { status: 401 });
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name?.trim() || null,
        role: targetRole
      }
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
