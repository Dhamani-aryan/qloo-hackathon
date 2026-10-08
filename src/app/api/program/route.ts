import { getAgentDeps } from "@/lib/server/deps";
import { handleProgram } from "@/lib/server/handlers";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Regenerates the program for another bridge from a finished analysis's evidence brief. */
export async function POST(req: Request) {
  return handleProgram(req, getAgentDeps);
}
