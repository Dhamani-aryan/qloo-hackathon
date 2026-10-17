import { describe, expect, it } from "vitest";
import { createMemoryCache } from "@/lib/cache/cache";
import type { EntityMatch, QlooClient } from "@/lib/qloo";
import { handleMcp, type McpDeps } from "@/lib/server/mcp";
import { fakeClient } from "../engine/helpers";
import { A, B, compare, world } from "../engine/world";
import { routerLlm } from "../agent/router";

const post = (body: unknown) =>
  new Request("http://test.local/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const rpc = (method: string, params?: unknown) => post({ jsonrpc: "2.0", id: 1, method, params });

/** Search resolves each synthetic seed ID to itself, so the world's insights apply. */
function qloo(): QlooClient {
  const client = fakeClient(world, compare).client;
  return {
    ...client,
    searchEntities: async ({ query }) =>
      query === "nothing"
        ? []
        : [
            {
              id: query,
              name: query,
              type: "urn:entity:tv_show",
              subtype: null,
              description: null,
              imageUrl: null,
              popularity: 0.5,
              disambiguation: null,
              geocode: null,
              tags: [],
              rank: 1,
            } satisfies EntityMatch,
          ],
  };
}

const deps = (overrides: Partial<McpDeps> = {}): McpDeps => ({
  deps: () => ({ qloo: qloo(), llm: routerLlm().llm }),
  appUrl: "https://example.test",
  ...overrides,
});

const call = (args: unknown) => rpc("tools/call", { name: "find_common_ground", arguments: args });
const args = {
  group_a: { name: "Film club", favourites: A },
  group_b: { name: "Arts group", favourites: B },
  city: "Test City",
};

describe("MCP endpoint", () => {
  it("initializes, negotiates the protocol version and lists one tool", async () => {
    const init = await (
      await handleMcp(rpc("initialize", { protocolVersion: "2025-03-26" }), deps())
    ).json();
    expect(init.result.protocolVersion).toBe("2025-03-26");
    expect(init.result.capabilities.tools).toBeDefined();
    const list = await (await handleMcp(rpc("tools/list"), deps())).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["find_common_ground"]);
  });

  it("acknowledges notifications without a body", async () => {
    const res = await handleMcp(
      post({ jsonrpc: "2.0", method: "notifications/initialized" }),
      deps(),
    );
    expect(res.status).toBe(202);
  });

  it("finds common ground and answers with bridges, evidence numbers and the plan", async () => {
    const body = await (await handleMcp(call(args), deps())).json();
    const text: string = body.result.content[0].text;
    expect(body.result.isError).toBeUndefined();
    expect(text).toMatch(/# Common ground: Film club \+ Arts group/);
    expect(text).toMatch(/1\. Jazz Fusion Duo \(artist\): Film club \d+th, Arts group \d+th/);
    expect(text).toMatch(/## Plan: Shared Nights/);
    expect(text).toMatch(/Explore it visually: https:\/\/example\.test/);
  });

  it("replays from the cache without hitting the live limit", async () => {
    const cache = createMemoryCache(10, new Map());
    let live = 0;
    const d = deps({
      cache: () => cache,
      beforeLive: async () => (++live > 1 ? "Rate limit" : null),
    });
    await handleMcp(call(args), d);
    const again = await (await handleMcp(call(args), d)).json();
    expect(live).toBe(1);
    expect(again.result.content[0].text).toMatch(/Jazz Fusion Duo/);
  });

  it("explains bad input instead of failing", async () => {
    const few = await (
      await handleMcp(call({ ...args, group_b: { name: "B", favourites: ["x"] } }), deps())
    ).json();
    expect(few.result.isError).toBe(true);
    expect(few.result.content[0].text).toMatch(/Invalid arguments/);

    const missing = await (
      await handleMcp(
        call({ ...args, group_b: { name: "B", favourites: ["nothing", "nothing", "SB1"] } }),
        deps(),
      )
    ).json();
    expect(missing.result.isError).toBe(true);
    expect(missing.result.content[0].text).toMatch(/Only 1 of B's favourites/);
  });
});
