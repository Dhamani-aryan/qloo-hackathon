import "server-only";
import type { AgentDeps } from "@/lib/agent/orchestrator";
import { getLlm } from "@/lib/llm";
import { getCache } from "@/lib/cache/server";
import { withCache } from "@/lib/qloo/cached";
import { getQlooClient } from "@/lib/qloo/server";

/** Real clients for route handlers (Qloo responses cached server-side). Throws if keys are missing. */
export function getAgentDeps(): AgentDeps {
  return { qloo: withCache(getQlooClient(), getCache()), llm: getLlm() };
}
