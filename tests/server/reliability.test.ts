import { describe, expect, it } from "vitest";
import { runAgentToCompletion } from "@/lib/agent/orchestrator";
import { createMemoryCache } from "@/lib/cache/cache";
import { QlooError } from "@/lib/qloo";
import { handleAnalysis } from "@/lib/server/handlers";
import { LIMITS, clientId, createMemoryLimiter, limit } from "@/lib/server/rate-limit";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "../agent/router";

const scenario = worldScenario();
const req = (ip = "1.2.3.4", body: unknown = { scenario }) =>
  new Request("http://test.local/api", {
    method: "POST",
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });

describe("rate limits", () => {
  it("allows the bucket maximum per window, then asks the client to wait", async () => {
    let now = 1_000_000_000_000;
    const limiter = createMemoryLimiter(() => now);
    for (let i = 0; i < LIMITS.analysis.max; i++)
      expect(await limit(limiter, "analysis", req())).toBeNull();
    const refused = await limit(limiter, "analysis", req());
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Other clients and the next window are unaffected.
    expect(await limit(limiter, "analysis", req("5.6.7.8"))).toBeNull();
    now += LIMITS.analysis.windowSeconds * 1000;
    expect(await limit(limiter, "analysis", req())).toBeNull();
  });

  it("identifies clients by the first forwarded address", () => {
    expect(clientId(req("9.9.9.9"))).toBe("9.9.9.9");
    expect(clientId(new Request("http://x"))).toBe("local");
  });

  it("only charges live analysis runs, not cached replays", async () => {
    const cache = createMemoryCache(10, new Map());
    const deps = () => ({ qloo: fakeClient(world, compare).client, llm: routerLlm().llm });
    let charged = 0;
    const beforeLive = async () =>
      ++charged > 1 ? new Response("limited", { status: 429 }) : null;
    await (await handleAnalysis(req(), deps, () => cache, beforeLive)).text();
    const replay = await handleAnalysis(req(), deps, () => cache, beforeLive);
    expect(replay.status).toBe(200);
    expect(charged).toBe(1);
    const live = await handleAnalysis(
      req("1.2.3.4", { scenario, fresh: true }),
      deps,
      () => cache,
      beforeLive,
    );
    expect(live.status).toBe(429);
  });
});

describe("failure handling", () => {
  it("reports Qloo as unavailable instead of 'no bridge' when every call fails", async () => {
    const down = fakeClient(() => {
      throw new QlooError("unauthorized", "/v2/insights", 401);
    }).client;
    down.compareProfiles = async () => {
      throw new QlooError("unauthorized", "/v2/analysis/compare", 401);
    };
    const r = await runAgentToCompletion({ qloo: down, llm: routerLlm().llm }, scenario, {
      baseline: false,
    });
    expect(r.status).toBe("partial");
    expect(r.failure).toMatch(/Qloo is unavailable: .*unauthorized/);
    expect(r.engine).toBeNull();
  });

  it("stops making calls once the run is cancelled", async () => {
    const controller = new AbortController();
    const { client, calls } = fakeClient(world, compare);
    const { llm, seen } = routerLlm({
      plan: () => {
        controller.abort();
        return JSON.stringify({
          domains: [
            { domain: "tvShow", reason: "x" },
            { domain: "artist", reason: "x" },
            { domain: "place", reason: "x" },
          ],
        });
      },
    });
    const r = await runAgentToCompletion({ qloo: client, llm }, scenario, {
      baseline: false,
      signal: controller.signal,
    });
    expect(r.failure).toMatch(/cancelled/);
    expect(calls).toHaveLength(0);
    expect(seen).toEqual(["plan"]);
  });
});
