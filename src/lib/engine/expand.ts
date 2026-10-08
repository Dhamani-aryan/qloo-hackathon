import { QLOO_TYPES, type InsightsEntity } from "@/lib/qloo";
import { qlooCall, type EngineContext } from "./context";
import type { AdmissionRule, DomainKey, Side } from "./types";

/** Popularity cap for the second discovery query (validated in the spike). */
export const POPULARITY_CAP = 0.9;
/** Minimum explainability score for a seed to count as "supporting" a result. */
export const SUPPORT_THRESHOLD = 0.05;
const TAKE = 25;

export interface DomainExpansion {
  domain: DomainKey;
  /** Results per admission rule, in Qloo rank order. */
  results: Record<AdmissionRule, InsightsEntity[]>;
  /** Evidence IDs recorded for each entity during expansion. */
  evidenceIds: Map<string, string[]>;
  /** Explainability-credited seeds per entity, split by side. */
  supportingSeeds: Map<string, Record<Side, string[]>>;
  locationConditioned: boolean;
  error: string | null;
}

/**
 * Discovery queries for one domain using the COMBINED A+B signal:
 *  - "combined-top": the strongest joint recommendations (with explainability),
 *  - "popularity-capped": the same query with `filter.popularity.max`, to reach past the mainstream.
 * Seeds themselves are excluded from results.
 */
export async function expandDomain(
  ctx: EngineContext,
  domain: DomainKey,
): Promise<DomainExpansion> {
  const { scenario, seedIds } = ctx;
  const signal = [...seedIds.A, ...seedIds.B];
  const locationConditioned = domain === "place";
  const expansion: DomainExpansion = {
    domain,
    results: { "combined-top": [], "popularity-capped": [] },
    evidenceIds: new Map(),
    supportingSeeds: new Map(),
    locationConditioned,
    error: null,
  };

  if (locationConditioned && !scenario.location) {
    ctx.emit({ type: "warning", message: "Skipped places: the scenario has no location." });
    expansion.error = "no_location";
    return expansion;
  }

  ctx.emit({ type: "domain_started", domain });
  const common = {
    filterType: QLOO_TYPES[domain],
    signalEntities: signal,
    excludeEntities: signal,
    filterLocationQuery: locationConditioned ? (scenario.location ?? undefined) : undefined,
    take: TAKE,
  };

  const runs: [AdmissionRule, Parameters<typeof ctx.client.getInsights>[0]][] = [
    ["combined-top", { ...common, explainability: true }],
    ["popularity-capped", { ...common, popularityMax: POPULARITY_CAP }],
  ];

  await Promise.all(
    runs.map(async ([rule, input]) => {
      try {
        const r = await qlooCall(
          ctx,
          rule,
          domain,
          () => ctx.client.getInsights(input),
          (x) => x.entities.length,
        );
        expansion.results[rule] = r.entities;
        for (const e of r.entities) record(ctx, expansion, rule, e);
      } catch (err) {
        expansion.error = (err as Error).message;
        ctx.emit({
          type: "warning",
          message: `${domain} ${rule} query failed: ${(err as Error).message}`,
        });
      }
    }),
  );
  return expansion;
}

function record(ctx: EngineContext, x: DomainExpansion, rule: AdmissionRule, e: InsightsEntity) {
  const support: Record<Side, string[]> = x.supportingSeeds.get(e.id) ?? { A: [], B: [] };
  // Strongest contributors first, so "supported by" lists lead with the most relevant seeds.
  const ranked = Object.entries(e.explainability ?? {}).sort((p, q) => q[1] - p[1]);
  for (const [seedId, score] of ranked) {
    const side = ctx.sideOf.get(seedId);
    if (side && score >= SUPPORT_THRESHOLD && !support[side].includes(seedId))
      support[side].push(seedId);
  }
  x.supportingSeeds.set(e.id, support);

  const id = ctx.ledger.add({
    endpoint: "/v2/insights",
    profile: "AB",
    purpose: rule,
    outputType: QLOO_TYPES[x.domain],
    candidateId: e.id,
    candidateName: e.name,
    supportingSeedIds: [...support.A, ...support.B],
    rank: e.rank,
    rawScore: e.affinity,
    normalizedScore: null,
    popularityBaseline: e.popularity,
    locationConditioned: x.locationConditioned,
    kind: x.locationConditioned ? "location-conditioned" : "direct",
    limitations:
      rule === "popularity-capped" ? [`Results limited to popularity ≤ ${POPULARITY_CAP}`] : [],
  });
  x.evidenceIds.set(e.id, [...(x.evidenceIds.get(e.id) ?? []), id]);
}
