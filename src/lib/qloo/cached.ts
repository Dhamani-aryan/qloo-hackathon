import { cacheKey, type Cache } from "@/lib/cache/cache";
import type { QlooClient } from "./types";

/** Qloo answers change slowly; a day keeps demo runs fast without going stale. */
export const QLOO_CACHE_TTL = 24 * 60 * 60;

/**
 * Wrap a Qloo client so identical requests are served from the server-side cache.
 * Errors are never cached.
 */
export function withCache(client: QlooClient, cache: Cache, ttl = QLOO_CACHE_TTL): QlooClient {
  const cached =
    <I, O>(name: string, fn: (input: I) => Promise<O>) =>
    async (input: I): Promise<O> => {
      const key = cacheKey(`qloo:${name}`, input);
      const hit = await cache.get<O>(key);
      if (hit) return hit;
      const result = await fn(input);
      await cache.set(key, result, ttl);
      return result;
    };
  return {
    searchEntities: cached("search", (i) => client.searchEntities(i)),
    searchTags: cached("tags", (i) => client.searchTags(i)),
    getInsights: cached("insights", (i) => client.getInsights(i)),
    compareProfiles: cached("compare", (i) => client.compareProfiles(i)),
  };
}
