import { describe, expect, it } from "vitest";
import { runAgentToCompletion } from "@/lib/agent/orchestrator";
import { MissingEnvError } from "@/lib/env";
import { handleAnalysis, handleProgram, handleResolve } from "@/lib/server/handlers";
import type { EntityMatch, QlooClient } from "@/lib/qloo";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "../agent/router";

const post = (body: unknown) =>
  new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function readSse(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.startsWith("event:"))
    .map((b) => JSON.parse(b.split("\ndata: ")[1]));
}

describe("handleResolve", () => {
  const match: EntityMatch = {
    id: "E1",
    name: "Atlanta",
    type: "urn:entity:tv_show",
    subtype: null,
    description: "A made-up description",
    imageUrl: null,
    popularity: 0.9,
    disambiguation: null,
    geocode: null,
    tags: [],
    rank: 1,
  };
  const qloo = {
    ...fakeClient(() => []).client,
    searchEntities: async () => [match],
  } as QlooClient;

  it("resolves each query and suggests a best match", async () => {
    const res = await handleResolve(
      post({ queries: [{ input: "Atlanta", type: "tvShow" }] }),
      () => qloo,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results[0]).toMatchObject({ input: "Atlanta", ambiguous: false, bestId: "E1" });
    expect(body.results[0].matches[0]).toMatchObject({ id: "E1", name: "Atlanta" });
  });

  it("rejects invalid bodies and reports missing configuration", async () => {
    expect((await handleResolve(post({ queries: [] }), () => qloo)).status).toBe(400);
    expect((await handleResolve(post("{not json"), () => qloo)).status).toBe(400);
    const res = await handleResolve(post({ queries: [{ input: "x" }] }), () => {
      throw new MissingEnvError("Qloo API", ["QLOO_API_KEY is missing"]);
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("not_configured");
  });
});

describe("handleAnalysis", () => {
  it("streams agent events as SSE, ending with the result", async () => {
    const deps = () => ({ qloo: fakeClient(world, compare).client, llm: routerLlm().llm });
    const res = await handleAnalysis(post({ scenario: worldScenario() }), deps);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const events = await readSse(res);
    expect(events[0]).toEqual({ type: "state", state: "UNDERSTAND" });
    const done = events.at(-1);
    expect(done.type).toBe("done");
    expect(done.result.status).toBe("ok");
    expect(done.result.program.sessions[0].entity).not.toBeNull();
  });

  it("validates the scenario before streaming", async () => {
    const res = await handleAnalysis(post({ scenario: { id: "x" } }), () => {
      throw new Error("deps should not be needed");
    });
    expect(res.status).toBe(400);
  });
});

describe("handleProgram", () => {
  it("regenerates a program for another bridge from the brief", async () => {
    const deps = { qloo: fakeClient(world, compare).client, llm: routerLlm().llm };
    const first = await runAgentToCompletion(deps, worldScenario(), { baseline: false });
    const res = await handleProgram(post({ brief: first.brief, bridgeRef: "B2" }), () => deps);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.program.sessions.length).toBeGreaterThan(0);
    expect(body.critique[0].check).toBe("generic_roles");
  });

  it("rejects unknown bridges and malformed briefs", async () => {
    const deps = () => ({ qloo: fakeClient(() => []).client, llm: routerLlm().llm });
    const brief = { scenario: {}, entities: [], themes: [] };
    expect((await handleProgram(post({ brief, bridgeRef: "B1" }), deps)).status).toBe(400);
    expect((await handleProgram(post({ brief: "nope", bridgeRef: "B1" }), deps)).status).toBe(400);
  });
});
