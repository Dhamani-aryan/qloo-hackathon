import { getCache } from "@/lib/cache/server";
import { withCache } from "@/lib/qloo/cached";
import { getQlooClient } from "@/lib/qloo/server";
import { handleResolve } from "@/lib/server/handlers";
import { getLimiter } from "@/lib/server/limiter";
import { limit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return (
    (await limit(getLimiter(), "resolve", req)) ??
    handleResolve(req, () => withCache(getQlooClient(), getCache()))
  );
}
