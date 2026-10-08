import { getIntakeStore } from "@/lib/intake/server";
import { handleSubmitIntake } from "@/lib/server/intake-handlers";

export const runtime = "nodejs";

/** Submit one participant's confirmed picks (1–3). */
export async function POST(req: Request, ctx: RouteContext<"/api/intake/[id]/[side]">) {
  const { id, side } = await ctx.params;
  return handleSubmitIntake(req, id, side, getIntakeStore);
}
