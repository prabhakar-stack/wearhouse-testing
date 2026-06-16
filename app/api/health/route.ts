import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Publicly accessible health check — no auth required.
// Returns 200 when the system is fully operational, 503 when degraded.
// Used by Vercel uptime checks, Render health checks, and load balancers.

export const runtime = 'nodejs';

// These are the env vars that MUST be present for the system to function.
// If any are missing, the system is misconfigured and the check will warn.
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'DATABASE_URL',
  'CRON_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_FOLDER_ID',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
] as const;

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // 1. Database connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (err: any) {
    checks.database = { ok: false, detail: err?.message || 'DB unreachable' };
  }

  // 2. Required environment variables check
  const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  checks.env = {
    ok: missingEnvVars.length === 0,
    detail: missingEnvVars.length > 0
      ? `Missing: ${missingEnvVars.join(', ')}`
      : 'All required env vars present',
  };

  // 3. Prisma client check (basic instantiation)
  checks.prisma = { ok: !!prisma };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        // Allow caching for 10s so repeated health checks don't hammer the DB
        'Cache-Control': 'public, max-age=10, s-maxage=10',
      },
    }
  );
}
