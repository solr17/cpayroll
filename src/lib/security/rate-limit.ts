/**
 * Rate limiter with Upstash Redis backend (serverless-safe).
 * Falls back to in-memory Map when UPSTASH_REDIS_REST_URL is not configured (local dev).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// In-memory fallback (used when Redis is not configured, e.g. local dev)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanupMemoryStore(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of memoryStore) {
    if (now >= entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}

function checkRateLimitInMemory(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanupMemoryStore();

  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetMs: windowMs };
  }

  entry.count += 1;
  const remaining = Math.max(0, maxAttempts - entry.count);
  const resetMs = entry.resetAt - now;

  if (entry.count > maxAttempts) {
    return { allowed: false, remaining: 0, resetMs };
  }

  return { allowed: true, remaining, resetMs };
}

// ---------------------------------------------------------------------------
// Upstash Redis rate limiter (used in production / Vercel)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

/**
 * Cache of Ratelimit instances keyed by "maxAttempts:windowMs" so we reuse
 * the same limiter for identical configurations.
 */
const limiterCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  return null;
}

function getLimiter(maxAttempts: number, windowMs: number): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  const cacheKey = `${maxAttempts}:${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (limiter) return limiter;

  // Convert windowMs to a duration string for @upstash/ratelimit
  const windowSeconds = Math.ceil(windowMs / 1000);
  const duration = `${windowSeconds} s` as Parameters<typeof Ratelimit.slidingWindow>[1];

  limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(maxAttempts, duration),
    prefix: "clinicpay:ratelimit",
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Public API — same signature as before
// ---------------------------------------------------------------------------

let warnedOnce = false;

/**
 * Check rate limit for a given key.
 *
 * @param key          Unique identifier (e.g., "login:192.168.1.1")
 * @param maxAttempts  Maximum attempts allowed in the window
 * @param windowMs     Window duration in milliseconds
 * @returns { allowed, remaining, resetMs }
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const limiter = getLimiter(maxAttempts, windowMs);

  if (!limiter) {
    // No Redis configured — fall back to in-memory (fine for local dev)
    if (!warnedOnce) {
      logger.warn(
        "UPSTASH_REDIS_REST_URL not configured — using in-memory rate limiter. " +
          "This does NOT work correctly on serverless. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.",
      );
      warnedOnce = true;
    }
    return checkRateLimitInMemory(key, maxAttempts, windowMs);
  }

  const result = await limiter.limit(key);
  const resetMs = Math.max(0, result.reset - Date.now());

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetMs,
  };
}
