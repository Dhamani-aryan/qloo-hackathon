import "server-only";
import { getIntakeEnv } from "@/lib/env";
import { createMemoryStore, createRedisStore, type IntakeStore } from "./store";

let store: IntakeStore | null = null;

/** Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set, otherwise in-memory (dev only). */
export function getIntakeStore(): IntakeStore {
  if (store) return store;
  try {
    store = createRedisStore(getIntakeEnv());
  } catch {
    store = createMemoryStore();
  }
  return store;
}
