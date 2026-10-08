import { getIntakeStore } from "@/lib/intake/server";
import { handleSubmitIntake } from "@/lib/server/intake-handlers";
import { getLimiter } from "@/lib/server/limiter";
import { limit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/** Submit one participant's confirmed picks (1–3). */
export async function POST(req: Request, ctx: RouteContext<"/api/intake/[id]/[side]">) {
  const refused = await limit(getLimiter(), "intakeSubmit", req);
  if (refused) return refused;
  const { id, side } = await ctx.params;
  return handleSubmitIntake(req, id, side, getIntakeStore);
}
