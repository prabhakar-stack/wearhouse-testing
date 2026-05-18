import { OAuth2Client } from 'google-auth-library';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(clientId);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only_change_in_prod';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'prabhakar16032004@gmail.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
    }

    // ----- DATABASE VALIDATION -----
    // Connect to Supabase via Prisma to check if user exists.
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Zero-Trust Enforced: No DB record = Deny.
    if (!user) {
      return NextResponse.json({ 
        error: `You are not authorized. User (${email}) lacks access to this system.` 
      }, { status: 401 });
    }

    // Generate Custom HTTP-Only JWT (as requested by PRD)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' } // Typical shift duration
    );

    const response = NextResponse.json({ success: true, role: user.role });
    
    // Set HTTP-only Cookie
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 12 // 12 hours
    });

    return response;
  } catch (error: any) {
    console.error('Core Auth Error:', error);
    return NextResponse.json({ error: 'System Authentication failed. Verify tokens and Google Client UI.' }, { status: 500 });
  }
}
