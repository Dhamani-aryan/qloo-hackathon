import { getAgentDeps } from "@/lib/server/deps";
import { handleProgram } from "@/lib/server/handlers";
import { getLimiter } from "@/lib/server/limiter";
import { limit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Regenerates the program for another bridge from a finished analysis's evidence brief. */
export async function POST(req: Request) {
  return (await limit(getLimiter(), "program", req)) ?? handleProgram(req, getAgentDeps);
}
