interface WindowRecord {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  buckets: Map<string, WindowRecord>;
  lastPrunedAt: number;
}

export interface RateLimitPolicy {
  perMinute: number;
  perDay: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
  reason?: "minute" | "day";
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

function getStore(): RateLimitStore {
  const globalState = globalThis as typeof globalThis & {
    __SECURITY_RATE_LIMIT_STORE__?: RateLimitStore;
  };

  if (!globalState.__SECURITY_RATE_LIMIT_STORE__) {
    globalState.__SECURITY_RATE_LIMIT_STORE__ = {
      buckets: new Map<string, WindowRecord>(),
      lastPrunedAt: Date.now(),
    };
  }

  return globalState.__SECURITY_RATE_LIMIT_STORE__;
}

function pruneExpired(store: RateLimitStore, now: number): void {
  if (now - store.lastPrunedAt < PRUNE_INTERVAL_MS) {
    return;
  }

  store.lastPrunedAt = now;
  store.buckets.forEach((record, key) => {
    if (record.resetAt <= now) {
      store.buckets.delete(key);
    }
  });
}

function incrementWindow(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { ok: boolean; retryAfterSec: number } {
  const current = store.buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    store.buckets.set(key, {
      count: 1,
      resetAt,
    });

    return {
      ok: true,
      retryAfterSec: Math.ceil((resetAt - now) / 1000),
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return {
    ok: true,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function createRateLimitKey(routeKey: string, clientIp: string): string {
  return `${routeKey}:${clientIp}`;
}

export function checkRateLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneExpired(store, now);

  const dayResult = incrementWindow(store, `${key}:day`, policy.perDay, DAY_MS, now);
  if (!dayResult.ok) {
    return {
      ok: false,
      retryAfterSec: dayResult.retryAfterSec,
      reason: "day",
    };
  }

  const minuteResult = incrementWindow(store, `${key}:minute`, policy.perMinute, MINUTE_MS, now);
  if (!minuteResult.ok) {
    return {
      ok: false,
      retryAfterSec: minuteResult.retryAfterSec,
      reason: "minute",
    };
  }

  return {
    ok: true,
  };
}
