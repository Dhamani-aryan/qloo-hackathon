/**
 * Fixed-window rate limits per client IP, so a public demo can't exhaust the Qloo key or the
 * owner's ChatGPT subscription. Uses Upstash Redis when configured (shared across instances),
 * otherwise per-instance memory.
 */

export const LIMITS = {
  /** Live agent runs (cached replays are free). */
  analysis: { max: 5, windowSeconds: 600 },
  program: { max: 6, windowSeconds: 600 },
  resolve: { max: 200, windowSeconds: 600 },
  intakeCreate: { max: 10, windowSeconds: 600 },
  intakeSubmit: { max: 30, windowSeconds: 600 },
} as const;
export type Bucket = keyof typeof LIMITS;

export interface RateLimiter {
  /** Count one request; returns seconds to wait if over the limit, else 0. */
  hit(bucket: Bucket, client: string): Promise<number>;
}

export function clientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
}

const windowStart = (seconds: number, now: number) => Math.floor(now / 1000 / seconds) * seconds;

export function createMemoryLimiter(now: () => number = Date.now): RateLimiter {
  const counts = new Map<string, number>();
  return {
    async hit(bucket, client) {
      const { max, windowSeconds } = LIMITS[bucket];
      const start = windowStart(windowSeconds, now());
      const key = `${bucket}:${client}:${start}`;
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      if (counts.size > 5000) counts.clear(); // bounded memory; windows are short anyway
      return n > max ? Math.max(1, start + windowSeconds - Math.floor(now() / 1000)) : 0;
    },
  };
}

export function createRedisLimiter(
  env: { url: string; token: string },
  doFetch: typeof fetch = fetch,
): RateLimiter {
  return {
    async hit(bucket, client) {
      const { max, windowSeconds } = LIMITS[bucket];
      const start = windowStart(windowSeconds, Date.now());
      const key = `cg:rl:${bucket}:${client}:${start}`;
      try {
        const res = await doFetch(`${env.url.replace(/\/+$/, "")}/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.token}`, "content-type": "application/json" },
          body: JSON.stringify([
            ["INCR", key],
            ["EXPIRE", key, windowSeconds],
          ]),
        });
        const [incr] = (await res.json()) as { result?: number }[];
        const n = Number(incr?.result) || 0;
        return n > max ? Math.max(1, start + windowSeconds - Math.floor(Date.now() / 1000)) : 0;
      } catch {
        return 0; // fail open: a limiter outage must not take the demo down
      }
    },
  };
}

export function tooManyRequests(retryAfter: number): Response {
  return Response.json(
    {
      error: "rate_limited",
      detail: `Too many requests. Please try again in about ${Math.ceil(retryAfter / 60)} minute(s).`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Returns a 429 response if the client is over the bucket's limit, else null. */
export async function limit(
  limiter: RateLimiter,
  bucket: Bucket,
  req: Request,
): Promise<Response | null> {
  const wait = await limiter.hit(bucket, clientId(req));
  return wait > 0 ? tooManyRequests(wait) : null;
}
