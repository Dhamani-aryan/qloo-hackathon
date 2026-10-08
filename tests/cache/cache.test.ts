import { describe, expect, it, vi } from "vitest";
import { cacheKey, createMemoryCache, createRedisCache } from "@/lib/cache/cache";
import { loadRecording, recordRun, replayRun, runKey } from "@/lib/agent/replay";
import { runAgent, type AgentEvent } from "@/lib/agent/orchestrator";
import { withCache } from "@/lib/qloo/cached";
import { handleAnalysis } from "@/lib/server/handlers";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "../agent/router";

const fresh = () => createMemoryCache(3, new Map());

describe("memory cache", () => {
  it("expires entries and evicts the least recently used", async () => {
    const c = fresh();
    await c.set("a", 1, 60);
    await c.set("b", 2, 60);
    await c.set("c", 3, 60);
    await c.get("a"); // a is now most recent
    await c.set("d", 4, 60); // evicts b
    expect(await c.get("b")).toBeNull();
    expect(await c.get("a")).toBe(1);
    await c.set("old", 5, -1);
    expect(await c.get("old")).toBeNull();
  });

  it("builds keys that ignore object key order and undefined fields", () => {
    expect(cacheKey("x", { a: 1, b: [1, { c: 2, d: undefined }] })).toBe(
      cacheKey("x", { b: [1, { c: 2 }], a: 1 }),
    );
    expect(cacheKey("x", { a: 1 })).not.toBe(cacheKey("y", { a: 1 }));
  });
});

describe("redis cache", () => {
  it("never throws on backend errors", async () => {
    const c = createRedisCache(
      { url: "https://r.test", token: "t" },
      (async () => new Response("down", { status: 500 })) as unknown as typeof fetch,
    );
    await expect(c.set("k", 1, 60)).resolves.toBeUndefined();
    expect(await c.get("k")).toBeNull();
  });
});

describe("withCache", () => {
  it("serves repeated Qloo requests from the cache", async () => {
    const { client, calls } = fakeClient(world, compare);
    const cached = withCache(client, fresh());
    const input = { filterType: "urn:entity:tv_show", signalEntities: ["SA1"] };
    const one = await cached.getInsights(input);
    const two = await cached.getInsights({
      signalEntities: ["SA1"],
      filterType: "urn:entity:tv_show",
    });
    expect(two).toEqual(one);
    expect(calls).toHaveLength(1);
  });
});

describe("run recording and replay", () => {
  const deps = () => ({ qloo: fakeClient(world, compare).client, llm: routerLlm().llm });
  const scenario = worldScenario();

  it("records a successful run and replays the same events, compressed", async () => {
    const cache = fresh();
    const key = runKey(scenario, {});
    const live: AgentEvent[] = [];
    for await (const e of recordRun(runAgent(deps(), scenario), cache, key)) live.push(e);

    const recording = await loadRecording(cache, key);
    expect(recording?.result.status).toBe("ok");
    const sleep = vi.fn(async () => {});
    const replayed = [];
    for await (const e of replayRun(recording!, sleep)) replayed.push(e);

    expect(replayed[0]).toMatchObject({ type: "replay" });
    expect(replayed.slice(1).map((e) => e.type)).toEqual(live.map((e) => e.type));
    expect(replayed.at(-1)).toEqual(live.at(-1));
  });

  it("does not record runs whose program failed", async () => {
    const cache = fresh();
    const key = runKey(scenario, {});
    const broken = {
      qloo: fakeClient(world, compare).client,
      llm: routerLlm({ program: () => "{}" }).llm,
    };
    for await (const e of recordRun(runAgent(broken, scenario), cache, key)) void e;
    expect(await loadRecording(cache, key)).toBeNull();
  });

  it("keys runs by confirmed seeds and options, not by scenario id or title", () => {
    const a = runKey(scenario, {});
    expect(runKey({ ...scenario, id: "other", title: "Other" }, {})).toBe(a);
    expect(runKey(scenario, { domains: ["tvShow"] })).not.toBe(a);
  });

  it("handleAnalysis replays from the cache unless fresh is requested", async () => {
    const cache = fresh();
    const post = (body: unknown) =>
      new Request("http://test.local/api", { method: "POST", body: JSON.stringify(body) });
    const read = async (res: Response) => (await res.text()).match(/^event: (\w+)/gm) ?? [];

    const first = await read(await handleAnalysis(post({ scenario }), deps, () => cache));
    expect(first).not.toContain("event: replay");
    const second = await read(await handleAnalysis(post({ scenario }), deps, () => cache));
    expect(second[0]).toBe("event: replay");
    const live = await read(
      await handleAnalysis(post({ scenario, fresh: true }), deps, () => cache),
    );
    expect(live).not.toContain("event: replay");
  });
});
