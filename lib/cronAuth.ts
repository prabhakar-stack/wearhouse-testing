import { NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CRON_SECRET_CONFIGURED = !!process.env.CRON_SECRET;
// Used as a local-dev convenience ONLY. Never reachable in production because
// the fail-fast below rejects all requests when CRON_SECRET is not configured.
const DEV_FALLBACK_SECRET = "secret-cron-token-local-dev-only";

export function getConfiguredCronSecret() {
  return process.env.CRON_SECRET || DEV_FALLBACK_SECRET;
}

export function getCronRequestSecret(req: Request) {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  return (
    req.headers.get("x-cron-secret") ||
    url.searchParams.get("secret") ||
    bearerMatch?.[1] ||
    null
  );
}

export function requireCronAuth(req: Request) {
  // Fail-fast in production if CRON_SECRET is not configured.
  // Prevents any external actor from triggering jobs with the dev fallback.
  if (IS_PRODUCTION && !CRON_SECRET_CONFIGURED) {
    console.error(
      "[SECURITY CRITICAL] CRON_SECRET environment variable is not set. " +
        "All cron requests are being rejected to prevent unauthorized job execution."
    );
    return NextResponse.json(
      { error: "Server misconfiguration: cron service unavailable" },
      { status: 500 }
    );
  }

  const providedSecret = getCronRequestSecret(req);
  const expectedSecret = getConfiguredCronSecret();

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
