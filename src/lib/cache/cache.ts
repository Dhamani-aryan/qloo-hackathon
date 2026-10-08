import { createHash } from "node:crypto";

/**
 * Small server-side cache. Qloo's hackathon terms allow server-side caching but not storing
 * responses in the public repo, so nothing here is ever written to disk in the project.
 * Backed by Upstash Redis when configured (shared across serverless instances), otherwise an
 * in-process LRU.
 */

export interface Cache {
  readonly kind: "redis" | "memory";
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

const globalForCache = globalThis as unknown as {
  __cgCache?: Map<string, { v: string; exp: number }>;
};

export function createMemoryCache(
  maxEntries = 500,
  store?: Map<string, { v: string; exp: number }>,
): Cache {
  const map = store ?? (globalForCache.__cgCache ??= new Map());
  return {
    kind: "memory",
    async get<T>(key: string) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.exp < Date.now()) {
        map.delete(key);
        return null;
      }
      // Refresh recency for LRU eviction.
      map.delete(key);
      map.set(key, hit);
      return JSON.parse(hit.v) as T;
    },
    async set(key, value, ttlSeconds) {
      map.delete(key);
      map.set(key, { v: JSON.stringify(value), exp: Date.now() + ttlSeconds * 1000 });
      while (map.size > maxEntries) map.delete(map.keys().next().value!);
    },
  };
}

export function createRedisCache(
  env: { url: string; token: string },
  doFetch: typeof fetch = fetch,
): Cache {
  const call = async (command: (string | number)[]) => {
    const res = await doFetch(env.url.replace(/\/+$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`Cache error (${res.status})`);
    return ((await res.json()) as { result?: unknown }).result;
  };
  return {
    kind: "redis",
    async get<T>(key: string) {
      try {
        const raw = await call(["GET", key]);
        return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
      } catch {
        return null; // A cache failure must never break a request.
      }
    },
    async set(key, value, ttlSeconds) {
      try {
        await call(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
      } catch {
        // ignore
      }
    },
  };
}

/** Stable key from any JSON-able value (object keys sorted). */
export function cacheKey(prefix: string, value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return `cg:${prefix}:${digest(JSON.stringify(stable(value)))}`;
}

function digest(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}
