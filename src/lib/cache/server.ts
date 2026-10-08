import "server-only";
import { getIntakeEnv } from "@/lib/env";
import { createMemoryCache, createRedisCache, type Cache } from "./cache";

let cache: Cache | null = null;

/** Shares the Upstash Redis database with intake when configured; in-memory otherwise. */
export function getCache(): Cache {
  if (cache) return cache;
  try {
    cache = createRedisCache(getIntakeEnv());
  } catch {
    cache = createMemoryCache();
  }
  return cache;
}
