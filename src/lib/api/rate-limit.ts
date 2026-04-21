const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory per-user, per-route rate limiter.
 *
 * Each route passes a unique `routeKey` so that rate-limit counters stay
 * independent across endpoints (matching the original per-file behaviour).
 *
 * @param userId   - The user to rate-limit.
 * @param limit    - Maximum allowed requests within the 1-hour window.
 * @param routeKey - A stable string identifying the calling route (e.g. "generate").
 * @returns `{ allowed, remaining }` indicating whether the request should proceed.
 */
export function checkRateLimit(
  userId: string,
  limit: number,
  routeKey: string,
): { allowed: boolean; remaining: number } {
  const key = `${routeKey}:${userId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) return { allowed: false, remaining: 0 };

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
