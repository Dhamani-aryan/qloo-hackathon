import { getCache } from "@/lib/cache/server";
import { getAgentDeps } from "@/lib/server/deps";
import { getLimiter } from "@/lib/server/limiter";
import { handleMcp } from "@/lib/server/mcp";
import { clientId } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
/** A live run takes ~60–100 s; cached runs return in a second or two. */
export const maxDuration = 300;

/** MCP endpoint (Streamable HTTP, JSON responses): one tool, `find_common_ground`. */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  return handleMcp(req, {
    deps: getAgentDeps,
    cache: getCache,
    appUrl: origin,
    beforeLive: async () => {
      const wait = await getLimiter().hit("analysis", clientId(req));
      return wait > 0
        ? `Rate limit: live analyses are limited per visitor. Try again in about ${Math.ceil(wait / 60)} minute(s).`
        : null;
    },
  });
}

/** This server doesn't push server-initiated messages, so there is no SSE stream to open. */
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
