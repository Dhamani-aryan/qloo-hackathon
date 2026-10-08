import "server-only";
import type { AgentDeps } from "@/lib/agent/orchestrator";
import { getLlm } from "@/lib/llm";
import { getQlooClient } from "@/lib/qloo/server";

/** Real clients for route handlers. Throws a configuration error if keys are missing. */
export function getAgentDeps(): AgentDeps {
  return { qloo: getQlooClient(), llm: getLlm() };
}
