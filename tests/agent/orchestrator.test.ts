import { describe, expect, it } from "vitest";
import { runAgentToCompletion, type AgentEvent } from "@/lib/agent/orchestrator";
import type { LlmClient, LlmRequest } from "@/lib/llm/types";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";

/** Answers each agent step by recognising its system prompt (steps run concurrently). */
function routerLlm(overrides: Partial<Record<string, (req: LlmRequest) => string>> = {}) {
  const seen: string[] = [];
  const session = (n: number, entityRef: string | null) => ({
    number: n,
    title: `Session ${n}`,
    entityRef,
    themeRef: null,
    activity: "Co-create",
    roles: { A: "Scores", B: "Writes" },
  });
  const program = {
    title: "Shared Nights",
    objective: "Recurring shared making",
    bridgeRef: "B1",
    format: "Monthly",
    sessions: [session(1, "B1"), session(2, "B2"), session(3, "B3"), session(4, null)],
    venueType: "Community room",
    partnerTypes: [],
    accessibility: [],
    frictionMitigations: [],
    successMeasures: ["Return attendance"],
    limitations: [],
    evidenceIds: [],
  };
  const handlers: Record<string, (req: LlmRequest) => string> = {
    plan: () =>
      JSON.stringify({
        domains: [
          { domain: "tvShow", reason: "watch club" },
          { domain: "artist", reason: "listening night" },
          { domain: "place", reason: "venue" },
        ],
      }),
    notes: (req) =>
      JSON.stringify({
        notes: ["B1", "B2", "B3"]
          .filter((r) => req.prompt.includes(`"ref": "${r}"`))
          .map((ref) => ({
            ref,
            activityFit: "Make something together",
            mainFriction: "Timing",
            whyBeatsObvious: "Less mainstream, supported on both sides",
            evidenceIds: ["ev_0001"],
          })),
      }),
    program: () => JSON.stringify(program),
    critic: () =>
      JSON.stringify({
        issues: [{ check: "generic_roles", problem: "Similar roles", fix: "Distinct roles" }],
        revised: { ...program, title: "Shared Nights (revised)" },
      }),
    baseline: () =>
      JSON.stringify({
        title: "Generic Exchange",
        bridge: "Film",
        format: "Monthly",
        sessions: [1, 2, 3].map((n) => ({
          number: n,
          title: `S${n}`,
          anchor: "A Famous Film",
          activity: "Watch",
          roles: { A: "Watch", B: "Watch" },
        })),
        venueType: "Library",
        successMeasures: ["Attendance"],
      }),
    ...overrides,
  };
  const step = (req: LlmRequest) =>
    req.system.includes("plan research")
      ? "plan"
      : req.system.includes("analyst")
        ? "notes"
        : req.system.includes("demanding reviewer")
          ? "critic"
          : req.system.includes("Choose a shared cultural bridge yourself")
            ? "baseline"
            : "program";
  const llm: LlmClient = {
    provider: "test",
    model: "test",
    generateText: async (req) => {
      const s = step(req);
      seen.push(s);
      return { text: handlers[s](req), usage: null, model: "test", ms: 1 };
    },
  };
  return { llm, seen };
}

const scenario = worldScenario();

describe("runAgent", () => {
  it("runs the full state machine and returns a critiqued, evidence-anchored program", async () => {
    const { llm, seen } = routerLlm();
    const events: AgentEvent[] = [];
    const r = await runAgentToCompletion(
      { qloo: fakeClient(world, compare).client, llm },
      scenario,
      {},
      (e) => events.push(e),
    );

    expect(r.status).toBe("ok");
    expect(
      events.filter((e) => e.type === "state").map((e) => e.type === "state" && e.state),
    ).toEqual([
      "UNDERSTAND",
      "PLAN_DOMAINS",
      "QUERY_QLOO",
      "DESIGN",
      "CRITIQUE",
      "EXPLAIN",
      "DONE",
    ]);
    expect(r.plan?.domains.map((d) => d.domain)).toEqual(["tvShow", "artist", "place"]);
    expect(r.engine?.bridges).toHaveLength(3);
    expect(r.notes).toHaveLength(3);
    expect(r.program?.title).toBe("Shared Nights (revised)");
    expect(r.critique[0].check).toBe("generic_roles");
    expect(r.program?.sessions[0].entity?.name).toBe(r.engine?.bridges[0].entity.name);
    expect(r.baseline?.kind).toBe("llm_only");
    expect(events.some((e) => e.type === "engine" && e.event.type === "qloo_query_done")).toBe(
      true,
    );
    expect(seen.sort()).toEqual(["baseline", "critic", "notes", "plan", "program"]);
  });

  it("stops after the engine when evidence is insufficient", async () => {
    const { llm, seen } = routerLlm();
    const r = await runAgentToCompletion({ qloo: fakeClient(() => []).client, llm }, scenario, {
      domains: ["tvShow"],
    });
    expect(r.status).toBe("insufficient_evidence");
    expect(r.program).toBeNull();
    expect(seen).toEqual(["baseline"]);
  });

  it("degrades gracefully when LLM steps fail", async () => {
    const { llm } = routerLlm({
      critic: () => "not json",
      notes: () => {
        throw new Error("notes down");
      },
    });
    const r = await runAgentToCompletion(
      { qloo: fakeClient(world, compare).client, llm },
      scenario,
    );
    expect(r.status).toBe("ok");
    expect(r.program?.title).toBe("Shared Nights");
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Bridge notes failed/),
        expect.stringMatching(/Critic failed; keeping the first draft/),
      ]),
    );
  });

  it("reports partial results when the program cannot be generated", async () => {
    const { llm } = routerLlm({ program: () => "{}" });
    const r = await runAgentToCompletion(
      { qloo: fakeClient(world, compare).client, llm },
      scenario,
      {
        baseline: false,
      },
    );
    expect(r.status).toBe("partial");
    expect(r.engine?.bridges.length).toBeGreaterThan(0);
    expect(r.baseline).toBeNull();
  });
});
