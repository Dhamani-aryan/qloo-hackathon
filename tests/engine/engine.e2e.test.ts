import { describe, expect, it } from "vitest";
import { runBridgeEngine, ScenarioSchema, type EngineResult } from "@/lib/engine";
import type { InsightsEntity, InsightsInput } from "@/lib/qloo";
import { entity, fakeClient } from "./helpers";

/**
 * End-to-end run over a small SYNTHETIC world (no network, made-up names).
 * Each entity has a popularity and an affinity for community A and for community B.
 */
type World = Record<string, { name: string; pop: number; a: number; b: number; tags?: string[] }>;

const WORLD: Record<string, World> = {
  "urn:entity:tv_show": {
    T_FAMOUS: { name: "Famous Drama", pop: 0.98, a: 0.96, b: 0.97 },
    T_SHARED: { name: "Shared Comedy", pop: 0.7, a: 0.95, b: 0.94 },
    T_ONESIDED: { name: "Campus Only Show", pop: 0.6, a: 0.97, b: 0.8 },
    T_NICHE: { name: "Tiny Cult Show", pop: 0.1, a: 0.93, b: 0.93 },
    T_MID: { name: "Mid Show", pop: 0.5, a: 0.9, b: 0.9 },
    T_LOW: { name: "Low Show", pop: 0.5, a: 0.82, b: 0.83 },
  },
  "urn:entity:artist": {
    A_POL: { name: "Political Anthems", pop: 0.6, a: 0.95, b: 0.95 },
    A_GOOD: { name: "Jazz Fusion Duo", pop: 0.6, a: 0.92, b: 0.93 },
    A_STAR: { name: "Global Star", pop: 0.99, a: 0.9, b: 0.9 },
    A_LOW: { name: "Quiet Folk", pop: 0.5, a: 0.8, b: 0.81 },
  },
  "urn:entity:place": {
    P_HOTEL: {
      name: "Grand Stay",
      pop: 0.6,
      a: 0.95,
      b: 0.95,
      tags: ["urn:tag:category:place:hotel"],
    },
    P_CAFE: { name: "Corner Café", pop: 0.55, a: 0.91, b: 0.92 },
    P_LANDMARK: { name: "Famous Square", pop: 0.99, a: 0.95, b: 0.96 },
    P_LOW: { name: "Far Away Diner", pop: 0.5, a: 0.8, b: 0.8 },
  },
};

const A = ["SA1", "SA2", "SA3"];
const B = ["SB1", "SB2", "SB3"];

function world(input: InsightsInput): InsightsEntity[] {
  const table = WORLD[input.filterType] ?? {};
  const make = (id: string, affinity: number) => {
    const w = table[id];
    return entity(id, w.name, {
      type: input.filterType,
      popularity: w.pop,
      affinity,
      tags: (w.tags ?? []).map((t) => ({ id: t, name: null, type: null })),
      explainability: { SA1: 0.08, SB1: 0.08 },
    });
  };
  if (input.resultEntities) {
    const side = input.signalEntities?.[0]?.startsWith("SA") ? "a" : "b";
    return input.resultEntities.filter((id) => table[id]).map((id) => make(id, table[id][side]));
  }
  return Object.keys(table)
    .filter((id) => table[id].pop <= (input.popularityMax ?? 1))
    .map((id) => make(id, (table[id].a + table[id].b) / 2))
    .sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0));
}

function scenario(a = A, b = B) {
  const seed = (id: string) => ({ input: id, entityId: id, name: id, type: null, confirmed: true });
  return ScenarioSchema.parse({
    id: "synthetic",
    title: "Synthetic scenario",
    location: "Test City",
    a: { side: "A", label: "A", source: "organizer", seeds: a.map(seed) },
    b: { side: "B", label: "B", source: "organizer", seeds: b.map(seed) },
  });
}

const compare = {
  sharedTags: [
    {
      id: "t:growth",
      name: "Personal growth",
      subtype: "urn:tag:theme:qloo",
      popularity: 0.9,
      score: 0.7,
      count: null,
      aEntityIds: ["SA1"],
      bEntityIds: ["SB2"],
    },
  ],
};

function summary(r: EngineResult) {
  return {
    status: r.status,
    bridges: r.bridges.map((b) => `${b.entity.name} (${b.domain}) BP ${b.bridgePotential}`),
    obvious: r.obvious?.entity.name ?? null,
    themes: r.themes.map((t) => t.name),
    rejections: r.rejections.map((x) => `${x.name}: ${x.reason}`).sort(),
    calls: r.stats.qlooCalls,
  };
}

describe("runBridgeEngine (synthetic world)", () => {
  it("finds two-sided, non-mainstream bridges and explains every rejection", async () => {
    const { client } = fakeClient(world, compare);
    const r = await runBridgeEngine(client, scenario(), {
      domains: ["tvShow", "artist", "place"],
    });
    const s = summary(r);

    expect(s.status).toBe("ok");
    expect(s.bridges.map((b) => b.split(" (")[0])).toEqual([
      "Jazz Fusion Duo",
      "Corner Café",
      "Shared Comedy",
    ]);
    expect(["Famous Drama", "Famous Square", "Global Star"]).toContain(s.obvious);
    expect(s.themes).toEqual(["Personal growth"]);
    expect(s.rejections).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Political Anthems: Sensitive topic/),
        expect.stringMatching(/^Grand Stay: Unsuitable venue for a program \(hotel\)/),
        expect.stringMatching(/^Campus Only Show: One-sided: community B/),
        expect.stringMatching(/^Tiny Cult Show: Too niche/),
        expect.stringMatching(/^Low Show: Weak support from both/),
      ]),
    );
    // 3 domains × (2 discovery + 2 shortlist) + 1 compare
    expect(s.calls).toBe(13);
    expect(s).toMatchSnapshot();
  });

  it("traces every bridge and theme to the evidence ledger", async () => {
    const { client } = fakeClient(world, compare);
    const r = await runBridgeEngine(client, scenario(), { domains: ["tvShow", "artist", "place"] });
    const ids = new Set(r.evidence.map((e) => e.evidenceId));
    for (const b of r.bridges) {
      expect(b.evidenceIds.length).toBeGreaterThanOrEqual(3);
      for (const id of b.evidenceIds) expect(ids.has(id)).toBe(true);
      const profiles = r.evidence
        .filter((e) => b.evidenceIds.includes(e.evidenceId))
        .map((e) => e.profile);
      expect(profiles).toEqual(expect.arrayContaining(["AB", "A", "B"]));
    }
    for (const t of r.themes) expect(ids.has(t.evidenceId)).toBe(true);
  });

  it("is deterministic for fixed inputs", async () => {
    const run = async () =>
      summary(
        await runBridgeEngine(fakeClient(world, compare).client, scenario(), {
          domains: ["tvShow", "artist", "place"],
        }),
      );
    expect(await run()).toEqual(await run());
  });

  it("returns insufficient evidence when no candidate is two-sided", async () => {
    const oneSided = (input: InsightsInput) =>
      world(input).map((e) =>
        input.resultEntities && input.signalEntities?.[0]?.startsWith("SB")
          ? { ...e, affinity: e.id === "T_LOW" ? 0.99 : 0.5 }
          : e,
      );
    const r = await runBridgeEngine(fakeClient(oneSided).client, scenario(), {
      domains: ["tvShow"],
    });
    expect(r.status).toBe("insufficient_evidence");
    expect(r.warnings.at(-1)).toMatch(/No candidate/);
  });

  it("refuses to run with too few confirmed seeds", async () => {
    const { client, calls } = fakeClient(world);
    const r = await runBridgeEngine(client, scenario(["SA1"], B));
    expect(r.status).toBe("insufficient_evidence");
    expect(r.warnings[0]).toMatch(/Community A has 1 confirmed seeds/);
    expect(calls).toHaveLength(0);
  });
});
