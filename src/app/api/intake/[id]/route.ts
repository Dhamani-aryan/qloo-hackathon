import { getIntakeStore } from "@/lib/intake/server";
import { handleGetIntake } from "@/lib/server/intake-handlers";

export const runtime = "nodejs";

/** Aggregated picks and participant counts for both communities. */
export async function GET(_req: Request, ctx: RouteContext<"/api/intake/[id]">) {
  const { id } = await ctx.params;
  return handleGetIntake(id, getIntakeStore);
}
