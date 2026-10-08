import { handleResolve } from "@/lib/server/handlers";
import { getCache } from "@/lib/cache/server";
import { withCache } from "@/lib/qloo/cached";
import { getQlooClient } from "@/lib/qloo/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleResolve(req, () => withCache(getQlooClient(), getCache()));
}
