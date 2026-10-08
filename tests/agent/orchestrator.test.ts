import { describe, expect, it } from "vitest";
import { runAgentToCompletion, type AgentEvent } from "@/lib/agent/orchestrator";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "./router";

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
