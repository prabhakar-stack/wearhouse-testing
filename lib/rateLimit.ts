/**
 * lib/rateLimit.ts
 *
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding window approach — no Redis dependency required.
 *
 * Why in-memory (not @vercel/kv)?
 * - @vercel/kv requires a Vercel KV store to be provisioned.
 * - Since you're on Render (persistent server), in-memory works perfectly:
 *   the process stays alive and the rate limit map is shared across requests.
 * - On Vercel serverless, each invocation has isolated memory — KV would be
 *   needed there. If you ever move to Vercel, swap this for @vercel/kv.
 *
 * Usage:
 *   const result = checkRateLimit(ip, 'auth', 10, 60_000); // 10 req / 60s
 *   if (!result.allowed) return tooManyRequests(result.retryAfterSec);
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

// Global store: key → sliding window entry
const store = new Map<string, WindowEntry>();

// Periodically prune expired entries to prevent memory leak (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries that haven't been touched for more than 10 minutes
      if (now - entry.windowStart > 10 * 60_000) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param identifier  Client identifier — use IP address or userId
 * @param namespace   Route namespace — prevents collisions between different limits
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMs    Time window in milliseconds (e.g. 60_000 = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  namespace: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const key = `${namespace}:${identifier}`;

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // Start a new window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSec: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterSec: 0 };
}

/**
 * Extract the real client IP from a Next.js Request.
 * Checks Vercel/Render forwarded headers before falling back to a placeholder.
 */
export function getClientIp(req: Request): string {
  const headers = (req as any).headers;
  return (
    headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers?.get?.('x-real-ip') ||
    'unknown'
  );
}

/**
 * Convenience: build the 429 Too Many Requests response.
 */
export function tooManyRequests(retryAfterSec: number) {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down and try again.',
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfterSec),
      },
    }
  );
}
