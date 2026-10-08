import { getAgentDeps } from "@/lib/server/deps";
import { getCache } from "@/lib/cache/server";
import { handleAnalysis } from "@/lib/server/handlers";

export const runtime = "nodejs";
/** A full live run takes ~60–90 s (Qloo engine + four LLM steps). */
export const maxDuration = 300;

/** Runs the agent (or replays a cached run) and streams its events as server-sent events. */
export async function POST(req: Request) {
  return handleAnalysis(req, getAgentDeps, getCache);
}
