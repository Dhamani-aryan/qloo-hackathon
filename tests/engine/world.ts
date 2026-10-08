import type { CompareResult, InsightsEntity, InsightsInput } from "@/lib/qloo";
import { ScenarioSchema } from "@/lib/engine/types";
import { entity } from "./helpers";

/**
 * A small SYNTHETIC Qloo world for end-to-end tests (no network, made-up names).
 * Each entity has a popularity and an affinity for community A and for community B.
 */
export type World = Record<
  string,
  { name: string; pop: number; a: number; b: number; tags?: string[] }
>;

export const WORLD: Record<string, World> = {
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

export const A = ["SA1", "SA2", "SA3"];
export const B = ["SB1", "SB2", "SB3"];

export function world(input: InsightsInput): InsightsEntity[] {
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

export function worldScenario(a = A, b = B) {
  const seed = (id: string) => ({ input: id, entityId: id, name: id, type: null, confirmed: true });
  return ScenarioSchema.parse({
    id: "synthetic",
    title: "Synthetic scenario",
    location: "Test City",
    a: { side: "A", label: "A", source: "organizer", seeds: a.map(seed) },
    b: { side: "B", label: "B", source: "organizer", seeds: b.map(seed) },
  });
}

export const compare: Partial<CompareResult> = {
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
