import { getIntakeStore } from "@/lib/intake/server";
import { handleCreateIntake } from "@/lib/server/intake-handlers";
import { getLimiter } from "@/lib/server/limiter";
import { limit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/** Create an intake session with one share link per community. */
export async function POST(req: Request) {
  return (
    (await limit(getLimiter(), "intakeCreate", req)) ?? handleCreateIntake(req, getIntakeStore)
  );
}
