import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, PlanningSettingsSchema } from "@/lib/planning";
import { assessActivityFit } from "@/lib/engine/fit";
import { selectBridges } from "@/lib/engine/select";
import { scoreCandidate } from "@/lib/engine/score";
import { buildBrief } from "@/lib/agent/brief";
import { deliveryChecks } from "@/lib/agent/readiness";
import { guardProgram } from "@/lib/agent/program";
import { runAgentToCompletion } from "@/lib/agent/orchestrator";
import { RESULT, SCENARIO, scored } from "./fixtures";
import { routerLlm } from "./router";
import { world, compare, worldScenario } from "../engine/world";
import { fakeClient } from "../engine/helpers";

describe("planning evidence and feasibility", () => {
  it("passes retrieved descriptions and categories without inventing venue availability", () => {
    const result = structuredClone(RESULT);
    result.bridges[1].entity.description = "A vegetarian restaurant offering takeaway.";
    result.bridges[1].entity.tags = [
      { id: "urn:tag:category:place:restaurant", name: "Restaurant", type: null },
    ];
    const brief = buildBrief(
      { ...SCENARIO, settings: { ...DEFAULT_SETTINGS, activity: "make", budget: "free" } },
      result,
    );
    expect(brief.entities[1]).toMatchObject({
      description: "A vegetarian restaurant offering takeaway.",
      categories: ["Restaurant"],
      activityFit: { level: "conditional" },
    });
    expect(brief.entities[1].unknowns.join(" ")).toContain("not been verified");
    expect(brief.entities[1].activityFit.confirmations.join(" ")).toContain("zero-cost");
  });

  it("prefers an appropriate medium without relaxing bilateral evidence", () => {
    const game = scored("game", "Shared Game", "videoGame", "discovered", 60);
    const cafe = scored("cafe", "A Café", "place", "discovered", 90);
    const settings = { ...DEFAULT_SETTINGS, activity: "play" as const };
    expect(selectBridges([cafe, game], settings).bridges[0].entity.id).toBe("game");
    expect(assessActivityFit(cafe, settings).level).toBe("conditional");
    game.pct.B = 0.2;
    expect(selectBridges([game], settings).status).toBe("insufficient_evidence");
  });

  it("allows familiar mainstream choices when the organizer asks for them", () => {
    const familiar = scored("known", "Shared Favorite", "movie", "obvious", 80);
    expect(selectBridges([familiar]).bridges).toHaveLength(0);
    expect(
      selectBridges([familiar], { ...DEFAULT_SETTINGS, novelty: "familiar" }).bridges,
    ).toHaveLength(1);
  });

  it("does not give places a cultural score bonus merely for being local", () => {
    const place = scored("same", "Same", "place", "discovered", 50);
    const book = { ...place, domain: "book" as const };
    const scores = {
      affinity: { A: new Map([["same", 0.9]]), B: new Map([["same", 0.9]]) },
      pct: { A: new Map([["same", 0.8]]), B: new Map([["same", 0.8]]) },
      failed: [],
    };
    expect(scoreCandidate(place, scores).bridgePotential).toBe(
      scoreCandidate(book, scores).bridgePotential,
    );
  });

  it("keeps free access pending rather than claiming it is verified", () => {
    const result = structuredClone(RESULT);
    const brief = buildBrief(
      { ...SCENARIO, settings: { ...DEFAULT_SETTINGS, budget: "free" } },
      result,
    );
    const session = {
      number: 1,
      title: "Meet",
      entityRef: "B1",
      themeRef: null,
      activity: "Discuss",
      roles: { A: "Share", B: "Share" },
    };
    const program = guardProgram(
      {
        title: "Together",
        objective: "Make",
        bridgeRef: "B1",
        format: "Weekly",
        sessions: [session],
        venueType: "Meet at B2",
        partnerTypes: [],
        accessibility: [],
        frictionMitigations: [],
        successMeasures: [],
        limitations: [],
        evidenceIds: [],
      },
      brief,
    );
    expect(program.venueType).toBe("Meet at Corner Café");
    expect(deliveryChecks(program, brief).find((c) => c.id === "budget")?.status).toBe("confirm");
  });

  it("rejects unbounded practical inputs", () => {
    expect(PlanningSettingsSchema.safeParse({ groupSize: 501 }).success).toBe(false);
    expect(PlanningSettingsSchema.safeParse({ groupSize: 2.5 }).success).toBe(false);
  });
  it("flags a direct outing conflict with an existing-venue requirement", () => {
    const brief = buildBrief(
      { ...SCENARIO, settings: { ...DEFAULT_SETTINGS, venue: "existing" } },
      RESULT,
    );
    const session = {
      number: 1,
      title: "Meet",
      entityRef: "B2",
      themeRef: null,
      activity: "Meet at Corner Café to make something.",
      roles: { A: "Share", B: "Share" },
    };
    const program = guardProgram(
      {
        title: "Together",
        objective: "Make",
        bridgeRef: "B2",
        format: "Weekly",
        sessions: [session],
        venueType: "Library",
        partnerTypes: [],
        accessibility: [],
        frictionMitigations: [],
        successMeasures: [],
        limitations: [],
        evidenceIds: [],
      },
      brief,
    );
    expect(deliveryChecks(program, brief).find((c) => c.id === "venue")?.status).toBe("conflict");
  });

  it("applies explicit age and cost controls even without free-text notes", async () => {
    const { client } = fakeClient(world, compare);
    const r = await runAgentToCompletion(
      { qloo: client, llm: routerLlm().llm },
      {
        ...worldScenario(),
        settings: { ...DEFAULT_SETTINGS, budget: "free", audience: "all_ages" },
      },
    );
    expect(r.directives.audience).toBe("all_ages");
    expect(r.brief?.scenario.rules.join(" ")).toContain("Every session must be free");
  });

  it("bounds Qloo operations across investigation rounds", async () => {
    const { client, calls } = fakeClient(world, compare);
    const r = await runAgentToCompletion({ qloo: client, llm: routerLlm().llm }, worldScenario(), {
      maxCalls: 3,
      baseline: false,
    });
    expect(calls.length).toBeLessThanOrEqual(3);
    expect(r.engine?.warnings.some((w) => w.includes("budget"))).toBe(true);
  });
});
