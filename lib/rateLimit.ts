interface WindowEntry {
  timestamps: number[];
  blocked: boolean;
  blockedUntil: number;
}

const windows = new Map<string, WindowEntry>();

const PRUNE_INTERVAL_MS = 60_000;
let lastPruned = Date.now();

function prune(now: number) {
  if (now - lastPruned < PRUNE_INTERVAL_MS) return;
  lastPruned = now;
  for (const [key, entry] of windows) {
    if (entry.blockedUntil < now && entry.timestamps.length === 0) {
      windows.delete(key);
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  prune(now);

  let entry = windows.get(ip);
  if (!entry) {
    entry = { timestamps: [], blocked: false, blockedUntil: 0 };
    windows.set(ip, entry);
  }

  // Still in a hard block window
  if (entry.blocked && now < entry.blockedUntil) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }
  if (entry.blocked && now >= entry.blockedUntil) {
    entry.blocked = false;
    entry.timestamps = [];
  }

  // Drop timestamps outside the sliding window
  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    entry.blocked = true;
    entry.blockedUntil = now + config.blockDurationMs;
    return { allowed: false, retryAfterMs: config.blockDurationMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down.",
      retryAfterSeconds: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

export const RATE_LIMITS = {
  run: {
    windowMs: 60_000,
    maxRequests: 10,
    blockDurationMs: 60_000,
  } satisfies RateLimitConfig,

  batch: {
    windowMs: 60_000,
    maxRequests: 60,
    blockDurationMs: 30_000,
  } satisfies RateLimitConfig,

  runs: {
    windowMs: 60_000,
    maxRequests: 60,
    blockDurationMs: 30_000,
  } satisfies RateLimitConfig,
} as const;
