import type { CompareResult, InsightsEntity, InsightsInput, QlooClient } from "@/lib/qloo";
import { ScenarioSchema, type Scenario } from "@/lib/engine/types";

/** Synthetic entity; all names and IDs are made up. */
export function entity(
  id: string,
  name: string,
  extra: Partial<InsightsEntity> = {},
): InsightsEntity {
  return {
    id,
    name,
    type: "urn:entity:tv_show",
    subtype: null,
    description: null,
    imageUrl: null,
    popularity: 0.5,
    disambiguation: null,
    geocode: null,
    tags: [],
    rank: 1,
    affinity: 0.9,
    affinityRank: null,
    explainability: null,
    ...extra,
  };
}

export function scenario(overrides: Partial<Scenario> = {}): Scenario {
  const seed = (id: string) => ({ input: id, entityId: id, name: id, type: null, confirmed: true });
  return ScenarioSchema.parse({
    id: "test",
    title: "Test scenario",
    location: "Test City",
    a: { side: "A", label: "Group A", source: "organizer", seeds: [seed("SA1"), seed("SA2")] },
    b: { side: "B", label: "Group B", source: "organizer", seeds: [seed("SB1"), seed("SB2")] },
    ...overrides,
  });
}

/**
 * Fake Qloo client driven by a handler, so tests describe responses per request.
 * Records every Insights input.
 */
export function fakeClient(
  insights: (input: InsightsInput) => InsightsEntity[],
  compare: Partial<CompareResult> = {},
) {
  const calls: InsightsInput[] = [];
  const client: QlooClient = {
    searchEntities: async () => [],
    searchTags: async () => [],
    getInsights: async (input) => {
      calls.push(input);
      const entities = insights(input).map((e, i) => ({ ...e, rank: i + 1 }));
      return { entities, aggregateExplainability: null, durationMs: 1 };
    },
    compareProfiles: async () => ({
      sharedTags: [],
      aTags: [],
      bTags: [],
      matchEntities: [],
      raw: null,
      durationMs: 1,
      ...compare,
    }),
  };
  return { client, calls };
}
