import { OAuth2Client } from 'google-auth-library';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(clientId);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only_change_in_prod';
const isProduction = process.env.NODE_ENV === 'production';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { credential } = body;
    if (!credential) return NextResponse.json({ error: 'Missing Google credentials token.' }, { status: 400 });

    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return NextResponse.json({ error: 'Failed to verify Google token.' }, { status: 400 });

    const email = payload.email.toLowerCase();
    const googleName = payload.name || null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: `User (${email}) lacks access to this system.` }, { status: 401 });

    let resolvedName = user.name;
    if (!resolvedName && googleName) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { name: googleName },
      });
      resolvedName = updatedUser.name;
    }

    if (!resolvedName) {
      resolvedName = user.email;
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, name: resolvedName }, JWT_SECRET, { expiresIn: '12h' });
    const response = NextResponse.json({ success: true, role: user.role, name: resolvedName });
    response.cookies.set('session', token, { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', path: '/', maxAge: 60 * 60 * 12 });
    return response;
  } catch (error: any) {
    console.error('Core Auth Error:', error);
    return NextResponse.json({ error: 'System Authentication failed.' }, { status: 500 });
  }
}
