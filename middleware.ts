import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only_change_in_prod';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // Unprotected routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Enforce session presence
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify custom HTTP-only JWT
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(session, secret);
    
    // Strict Role-Based Gateway logic can go here in the future
    // e.g., if (pathname.startsWith('/admin') && payload.role !== 'SUPER_ACCESS') { redirect }

    // Add user headers for downstream Server Components/Actions 
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId as string);
    requestHeaders.set('x-user-role', payload.role as string);
    requestHeaders.set('x-user-email', payload.email as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    // Invalid or expired token
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: [
    // Protect all routes except static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
