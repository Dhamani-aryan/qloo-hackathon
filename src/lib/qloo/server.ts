import "server-only";
import { getQlooEnv } from "@/lib/env";
import { createQlooClient } from "./client";
import type { QlooClient } from "./types";

let client: QlooClient | null = null;

/**
 * The Qloo client for app code (route handlers, server components). The `server-only`
 * import makes the build fail if this is ever pulled into a browser bundle, so the
 * API key can't leak client-side. Throws `MissingEnvError` when no key is configured.
 */
export function getQlooClient(): QlooClient {
  client ??= createQlooClient(getQlooEnv());
  return client;
}
