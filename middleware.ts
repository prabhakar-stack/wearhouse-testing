import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback_secret_for_dev_only_change_in_prod";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET_CONFIGURED = !!process.env.JWT_SECRET;

const ROUTE_ROLE_MAP: Record<string, string[]> = {
  "/super-admin": ["SUPER_ACCESS"],
  "/admin":       ["SUPER_ACCESS", "ADMIN"],
  "/receiver":    ["SUPER_ACCESS", "ADMIN", "RECEIVER"],
  "/inspector":   ["SUPER_ACCESS", "ADMIN", "INSPECTOR"],
  "/claims-specialist": ["SUPER_ACCESS", "ADMIN", "CLAIMS_SPECIALIST"],
  "/recoverer":   ["SUPER_ACCESS", "ADMIN", "RECOVERER"],
  "/qc-agent":    ["SUPER_ACCESS", "ADMIN", "QC_AGENT"],
};

export async function middleware(request: NextRequest) {
  if (IS_PRODUCTION && !JWT_SECRET_CONFIGURED) {
    console.error(
      "[SECURITY CRITICAL] JWT_SECRET environment variable is not set. " +
        "All requests are being rejected to prevent insecure operation.",
    );
    return NextResponse.json(
      { error: "Server misconfiguration: authentication service unavailable" },
      { status: 500 },
    );
  }

  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/product/status") ||
    pathname.startsWith("/api/health") || 
    pathname.startsWith("/api/cron") || 
    pathname.startsWith("/api/otp/bridge") || 
    pathname.startsWith("/api/admin/smarthub-session/import")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/alerts/seed")) {
    if (IS_PRODUCTION) {
      return NextResponse.json(
        { error: "This endpoint is disabled in production." },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(session, secret);
    const userRole = payload.role as string;
    
    if (userRole !== "SUPER_ACCESS") {
      for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLE_MAP)) {
        if (pathname.startsWith(routePrefix)) {
          if (!allowedRoles.includes(userRole)) {
            if (!pathname.startsWith("/api/")) {
              const loginUrl = new URL("/login", request.url);
              loginUrl.searchParams.set("error", "unauthorized");
              return NextResponse.redirect(loginUrl);
            }
            return NextResponse.json(
              { error: "Forbidden: insufficient role" },
              { status: 403 }
            );
          }
          break; // matched a route prefix, no need to keep checking
        }
      }
    }

    // Add user headers for downstream Server Components/Actions
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", userRole);
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
