/**
 * Rate limiting for API routes, backed by Upstash Redis (serverless-safe).
 *
 * DESIGN
 * ------
 * The app runs on serverless (Vercel), so instances don't share memory — a
 * per-process counter wouldn't hold. Upstash is a REST-based Redis that any
 * instance can reach, giving a single shared limiter.
 *
 * FAIL-OPEN: if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset
 * (e.g. local dev) or Redis is briefly unreachable, requests are ALLOWED rather
 * than blocked. Rate limiting is an abuse control, not an authz control — the
 * real security gates (token verification, role checks, Firestore rules) always
 * run regardless — so favouring availability here is the right trade-off.
 *
 * Set both env vars in production to activate it (see .env.example).
 */
import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Window = `${number} s` | `${number} m` | `${number} h`;

let redis: Redis | null = null;
let redisResolved = false;

function getRedis(): Redis | null {
  if (redisResolved) return redis;
  redisResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// Limiters are keyed by config so each distinct bucket is built once.
const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, window: Window): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${limit}:${window}`;
  let l = limiters.get(key);
  if (!l) {
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(key, l);
  }
  return l;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Check one request against a named bucket. Returns `true` when allowed.
 * Fails OPEN (returns true) when Redis is unconfigured or errors.
 *
 * @param name        bucket name (groups related routes)
 * @param identifier  per-caller key — a uid for authed routes, an IP otherwise
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  limit: number,
  window: Window,
): Promise<boolean> {
  const limiter = getLimiter(name, limit, window);
  if (!limiter) return true; // disabled → allow
  try {
    const { success } = await limiter.limit(identifier);
    return success;
  } catch {
    return true; // Redis hiccup → allow (availability over strictness)
  }
}

/** Standard 429 response for a tripped limit. */
export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau giây lát." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
