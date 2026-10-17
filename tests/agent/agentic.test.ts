import { describe, expect, it } from "vitest";
import { applyDirectives, interpretInstructions, NO_DIRECTIVES } from "@/lib/agent/directives";
import { runAgentToCompletion } from "@/lib/agent/orchestrator";
import { betterResult, validActions } from "@/lib/agent/review";
import { findPlaceTheme } from "@/lib/agent/tools";
import type { EngineResult } from "@/lib/engine";
import type { QlooClient, TagMatch } from "@/lib/qloo";
import { fakeClient } from "../engine/helpers";
import { compare, world, worldScenario } from "../engine/world";
import { routerLlm } from "./router";

const withTags = (client: QlooClient, tags: TagMatch[]): QlooClient => ({
  ...client,
  searchTags: async () => tags,
});

const jazz: TagMatch = {
  id: "urn:tag:genre:place:jazz_club",
  name: "Jazz club",
  type: "urn:tag:genre:place",
  parents: [],
};

describe("organizer instructions", () => {
  it("costs nothing when there are none", async () => {
    const { llm, seen } = routerLlm();
    expect(await interpretInstructions(llm, worldScenario())).toEqual(NO_DIRECTIVES);
    expect(seen).toEqual([]);
  });

  it("skip and add change the searched domains in a stable order", () => {
    const d = {
      ...NO_DIRECTIVES,
      skipDomains: ["podcast" as const],
      addDomains: ["videoGame" as const],
    };
    expect(applyDirectives(["tvShow", "artist", "podcast", "place"], d)).toEqual([
      "tvShow",
      "artist",
      "place",
      "videoGame",
    ]);
  });

  it("steer the search and the plan, and are logged as decisions", async () => {
    const { llm } = routerLlm({
      directives: () =>
        JSON.stringify({
          skipDomains: ["podcast"],
          addDomains: [],
          placeThemes: ["jazz"],
          audience: "all_ages",
          rules: ["Keep every session free"],
        }),
    });
    const { client, calls } = fakeClient(world, compare);
    const r = await runAgentToCompletion(
      { qloo: withTags(client, [jazz]), llm },
      { ...worldScenario(), instructions: "All ages, free, no podcasts, somewhere with jazz" },
    );
    expect(r.investigation?.domains).not.toContain("podcast");
    expect(r.investigation?.placeThemes).toEqual([{ tagId: jazz.id, name: "Jazz club" }]);
    expect(calls.some((c) => c.filterTags?.includes(jazz.id))).toBe(true);
    expect(r.decisions[0]).toMatchObject({ step: "instructions" });
    expect(r.decisions[0].text).toMatch(/skip podcasts.*jazz.*Keep every session free/);
    expect(r.brief?.scenario.rules).toEqual(["Keep every session free"]);
    expect(r.brief?.scenario.audience).toBe("all_ages");
  });
});

describe("review and investigate", () => {
  it("runs the tool the agent picks, re-scores, and keeps the better evidence", async () => {
    const { llm, seen } = routerLlm({
      review: () =>
        JSON.stringify({
          assessment: "Only two strong bridges.",
          actions: [{ tool: "explore_domain", domain: "movie", reason: "both groups watch films" }],
        }),
    });
    const { client, calls } = fakeClient(world, compare);
    const r = await runAgentToCompletion({ qloo: client, llm }, worldScenario());
    // The film search ran...
    expect(calls.some((c) => c.filterType === "urn:entity:movie")).toBe(true);
    expect(seen.filter((s) => s === "review")).toHaveLength(1);
    // ...but the synthetic world has no films, so the earlier bridges stay and the recorded
    // investigation matches what produced them.
    expect(r.decisions.map((d) => d.step)).toEqual(["plan", "review", "tool", "outcome"]);
    expect(r.decisions.at(-1)?.text).toMatch(/didn't beat/);
    expect(r.investigation).toMatchObject({ rounds: 2 });
    expect(r.investigation?.domains).not.toContain("movie");
    expect(r.engine?.bridges).toHaveLength(2);
  });

  it("drops actions it can't take: repeats, searched domains, places without a city", () => {
    const scenario = { ...worldScenario(), location: null };
    const actions = validActions(
      {
        assessment: "x",
        actions: [
          { tool: "explore_domain", domain: "tvShow", reason: "already searched" },
          { tool: "explore_domain", domain: "videoGame", reason: "gamers" },
          { tool: "explore_domain", domain: "videoGame", reason: "again" },
          { tool: "focus_places", theme: "jazz", reason: "no city" },
        ],
      },
      scenario,
      ["tvShow", "artist"],
      NO_DIRECTIVES,
      [],
    );
    expect(actions).toEqual([{ tool: "explore_domain", domain: "videoGame", reason: "gamers" }]);
  });

  it("keeps the earlier result when the extra search is weaker", () => {
    const strong = {
      status: "ok",
      bridges: [{ bridgePotential: 60, bilateral: 0.8, pct: { A: 0.8, B: 0.8 } }],
    };
    const weaker = {
      status: "ok",
      bridges: [{ bridgePotential: 70, bilateral: 0.5, pct: { A: 0.9, B: 0.35 } }],
    };
    expect(betterResult(strong as EngineResult, weaker as EngineResult)).toBe(strong);
    expect(betterResult(weaker as EngineResult, strong as EngineResult)).toBe(strong);
  });

  it("prefers venue-type place tags over amenity tags", async () => {
    const tags: TagMatch[] = [
      {
        id: "urn:tag:offerings:place:food",
        name: "Food",
        type: "urn:tag:offerings:place",
        parents: [],
      },
      {
        id: "urn:tag:genre:place:restaurant:food",
        name: "Food",
        type: "urn:tag:genre:place",
        parents: [],
      },
      { id: "urn:tag:genre:place:food", name: "Food", type: "urn:tag:genre:place", parents: [] },
    ];
    const theme = await findPlaceTheme(withTags(fakeClient(() => []).client, tags), "food");
    expect(theme?.tagId).toBe("urn:tag:genre:place:food");
  });
});
