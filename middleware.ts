import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback_secret_for_dev_only_change_in_prod";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET_CONFIGURED = !!process.env.JWT_SECRET;

export async function middleware(request: NextRequest) {
  // Fail-fast in production if JWT_SECRET is not configured.
  // This prevents a misconfigured deployment from silently accepting any token
  // signed with the hardcoded fallback secret.
  if (IS_PRODUCTION && !JWT_SECRET_CONFIGURED) {
    console.error(
      "[SECURITY CRITICAL] JWT_SECRET environment variable is not set. "
      + "All requests are being rejected to prevent insecure operation."
    );
    return NextResponse.json(
      { error: "Server misconfiguration: authentication service unavailable" },
      { status: 500 },
    );
  }

  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  // Unprotected routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/product/status") ||
    pathname.startsWith("/api/cron") ||       // Cron routes validate their own secret
    pathname.startsWith("/api/alerts/seed")   // Test seed validates its own secret
  ) {
    return NextResponse.next();
  }

  // Enforce session presence
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Verify custom HTTP-only JWT
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(session, secret);

    // Strict Role-Based Gateway logic can go here in the future
    // e.g., if (pathname.startsWith('/admin') && payload.role !== 'SUPER_ACCESS') { redirect }

    // Add user headers for downstream Server Components/Actions
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", payload.role as string);
    requestHeaders.set("x-user-email", payload.email as string);
    if (payload.name) {
      requestHeaders.set("x-user-name", payload.name as string);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    // Invalid or expired token
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired session" },
        { status: 401 },
      );
      response.cookies.delete("session");
      return response;
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
    return response;
  }
}

export const config = {
  matcher: [
    // Protect all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
