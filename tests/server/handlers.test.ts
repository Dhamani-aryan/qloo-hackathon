import { describe, expect, it } from "vitest";
import { runAgentToCompletion } from "@/lib/agent/orchestrator";
import { MissingEnvError } from "@/lib/env";
import {
  handleAnalysis,
  handleInvitations,
  handleProgram,
  handleResolve,
} from "@/lib/server/handlers";
import { QlooError, type EntityMatch, type QlooClient } from "@/lib/qloo";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "../agent/router";
import { createMemoryCache } from "@/lib/cache/cache";

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

  it("marks only the rate-limited queries for retry", async () => {
    const busy = {
      ...qloo,
      searchEntities: async ({ query }: { query: string }) => {
        if (query === "Busy") throw new QlooError("rate_limited", "/search", 429);
        return [match];
      },
    } as QlooClient;
    const res = await handleResolve(
      post({ queries: [{ input: "Atlanta" }, { input: "Busy" }] }),
      () => busy,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results[0]).toMatchObject({ input: "Atlanta", bestId: "E1" });
    expect(body.results[1]).toMatchObject({ input: "Busy", retry: true, bestId: null });
  });

  it("still fails the request on non-retryable Qloo errors", async () => {
    const denied = {
      ...qloo,
      searchEntities: async () => {
        throw new QlooError("unauthorized", "/search", 401);
      },
    } as QlooClient;
    const res = await handleResolve(post({ queries: [{ input: "x" }] }), () => denied);
    expect(res.status).toBeGreaterThanOrEqual(400);
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
    const cache = createMemoryCache(10, new Map());
    const briefId = crypto.randomUUID();
    await cache.set(`brief:${briefId}`, first.brief, 60);
    const res = await handleProgram(
      post({ briefId, bridgeRef: "B2" }),
      () => deps,
      () => cache,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.program.sessions.length).toBeGreaterThan(0);
    expect(body.critique[0].check).toBe("generic_roles");
  });

  it("refuses expired or browser-authored evidence before calling the model", async () => {
    const cache = createMemoryCache(10, new Map());
    const deps = () => {
      throw new Error("Model must not be called");
    };
    const expired = await handleProgram(
      post({ briefId: crypto.randomUUID(), bridgeRef: "B1" }),
      deps,
      () => cache,
    );
    expect(expired.status).toBe(410);
    const forged = await handleProgram(
      post({ brief: { entities: [], themes: [] }, bridgeRef: "B1" }),
      deps,
      () => cache,
    );
    expect(forged.status).toBe(400);
  });

  it("rejects unknown bridges and malformed briefs", async () => {
    const deps = () => ({ qloo: fakeClient(() => []).client, llm: routerLlm().llm });
    const brief = { scenario: {}, entities: [], themes: [] };
    expect((await handleProgram(post({ brief, bridgeRef: "B1" }), deps)).status).toBe(400);
    expect((await handleProgram(post({ brief: "nope", bridgeRef: "B1" }), deps)).status).toBe(400);
  });
});

describe("handleInvitations", () => {
  const setup = async () => {
    const deps = { qloo: fakeClient(world, compare).client, llm: routerLlm().llm };
    const first = await runAgentToCompletion(deps, worldScenario(), { baseline: false });
    const cache = createMemoryCache(10, new Map());
    const briefId = crypto.randomUUID();
    await cache.set(`brief:${briefId}`, first.brief, 60);
    return { deps, cache, briefId, program: first.program! };
  };

  it("writes guarded invitations for a program version from server-held evidence", async () => {
    const { deps, cache, briefId, program } = await setup();
    const res = await handleInvitations(
      post({ briefId, program }),
      () => deps,
      () => cache,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.invitations.A.subject).toBeTruthy();
    expect(body.invitations.A.message).toBe('If you love "SA1", try "Shared Comedy".');
  });

  it("rejects expired evidence and anchors outside it before calling the model", async () => {
    const { cache, briefId, program } = await setup();
    const noModel = () => {
      throw new Error("Model must not be called");
    };
    const expired = await handleInvitations(
      post({ briefId: crypto.randomUUID(), program }),
      noModel,
      () => cache,
    );
    expect(expired.status).toBe(410);
    const forged = {
      ...program,
      sessions: [{ ...program.sessions[0], entity: { id: "INVENTED", name: "Invented" } }],
    };
    const res = await handleInvitations(post({ briefId, program: forged }), noModel, () => cache);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_anchor");
  });
});

describe("handleProgram time budget", () => {
  it("returns the guarded draft when the critique can't finish in time", async () => {
    const base = { qloo: fakeClient(world, compare).client, llm: routerLlm().llm };
    const first = await runAgentToCompletion(base, worldScenario(), { baseline: false });
    const cache = createMemoryCache(10, new Map());
    const briefId = crypto.randomUUID();
    await cache.set(`brief:${briefId}`, first.brief, 60);
    const slowCritic = {
      ...base.llm,
      generateText: (req: Parameters<typeof base.llm.generateText>[0]) =>
        req.system.includes("demanding reviewer")
          ? new Promise<never>(() => {})
          : base.llm.generateText(req),
    };
    const res = await handleProgram(
      post({ briefId, bridgeRef: "B2" }),
      () => ({ ...base, llm: slowCritic }),
      () => cache,
      300,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.critiqueSkipped).toBe(true);
    expect(body.program.title).toBe("Shared Nights");
    expect(body.critique).toEqual([]);
  });
});
