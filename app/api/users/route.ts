import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const users = await prisma.user.findMany({
      orderBy: [
        { role: 'asc' },
        { createdAt: 'desc' }
      ],
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

export async function PATCH(req: Request) {
  try {
    const sessionRole = req.headers.get('x-user-role');
    const sessionUserId = req.headers.get('x-user-id');
    if (!sessionRole || (sessionRole !== 'SUPER_ACCESS' && sessionRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, email, name, role: targetRole, itemsProcessed, accuracyRate } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Admins or Super-access cannot edit themselves in this view to avoid access lockout
    if (sessionUserId === id) {
      return NextResponse.json({ error: 'Self-editing is disabled to prevent accidental access lockout.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Super Access accounts are read-only and cannot be modified or assigned
    if (existingUser.role === 'SUPER_ACCESS' || targetRole === 'SUPER_ACCESS') {
      return NextResponse.json({ error: 'Super Access accounts are completely read-only and cannot be modified.' }, { status: 400 });
    }

    // Role boundary checks
    if (sessionRole === 'ADMIN') {
      // Admin cannot edit other ADMINs (SUPER_ACCESS is already blocked above)
      if (existingUser.role === 'ADMIN') {
        return NextResponse.json({ error: 'Admins cannot edit other Admin or Super Access accounts.' }, { status: 401 });
      }
      // Admin cannot assign SUPER_ACCESS or ADMIN roles
      if (targetRole && targetRole !== 'RECEIVER' && targetRole !== 'INSPECTOR') {
        return NextResponse.json({ error: 'Admins can only assign RECEIVER or INSPECTOR roles.' }, { status: 401 });
      }
    }

    const updateData: any = {};
    if (email) updateData.email = email.toLowerCase().trim();
    if (name !== undefined) updateData.name = name ? name.trim() : null;
    if (targetRole) updateData.role = targetRole;
    if (itemsProcessed !== undefined) updateData.itemsProcessed = parseInt(itemsProcessed, 10) || 0;
    if (accuracyRate !== undefined) updateData.accuracyRate = parseFloat(accuracyRate) || 0.0;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error('PATCH /api/users error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user.' }, { status: 500 });
  }
}
