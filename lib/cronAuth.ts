import { NextResponse } from "next/server";

const DEFAULT_CRON_SECRET = "secret-cron-token";

export function getConfiguredCronSecret() {
  return process.env.CRON_SECRET || DEFAULT_CRON_SECRET;
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
  const providedSecret = getCronRequestSecret(req);
  const expectedSecret = getConfiguredCronSecret();

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
