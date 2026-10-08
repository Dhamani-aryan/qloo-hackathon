import { handleResolve } from "@/lib/server/handlers";
import { getQlooClient } from "@/lib/qloo/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleResolve(req, getQlooClient);
}
