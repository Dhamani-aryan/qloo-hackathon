import { getIntakeStore } from "@/lib/intake/server";
import { handleCreateIntake } from "@/lib/server/intake-handlers";

export const runtime = "nodejs";

/** Create an intake session with one share link per community. */
export async function POST(req: Request) {
  return handleCreateIntake(req, getIntakeStore);
}
