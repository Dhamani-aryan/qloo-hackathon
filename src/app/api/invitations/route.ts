import { getCache } from "@/lib/cache/server";
import { getAgentDeps } from "@/lib/server/deps";
import { handleInvitations } from "@/lib/server/handlers";
import { getLimiter } from "@/lib/server/limiter";
import { limit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Writes invitations for a plan rebuilt on another bridge, from server-held evidence. */
export async function POST(req: Request) {
  return (
    (await limit(getLimiter(), "program", req)) ?? handleInvitations(req, getAgentDeps, getCache)
  );
}
