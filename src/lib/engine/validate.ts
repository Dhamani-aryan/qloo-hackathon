import { QLOO_TYPES } from "@/lib/qloo";
import { qlooCall, type EngineContext } from "./context";
import { ordinalPct, percentiles } from "./normalize";
import { SIDES, type Candidate, type DomainKey, type Side } from "./types";

/** Each side must place a candidate at least this high in the pool (validated in the spike). */
export const MIN_SIDE_PERCENTILE = 0.4;

export interface SideScores {
  affinity: Record<Side, Map<string, number>>;
  pct: Record<Side, Map<string, number>>;
}

/**
 * Bilateral validation: score the whole pool against A alone and B alone using
 * `filter.results.entities`, then convert to within-pool percentiles so the two sides
 * are comparable. Every score is written to the ledger.
 */
export async function scoreSides(
  ctx: EngineContext,
  domain: DomainKey,
  candidates: Candidate[],
): Promise<SideScores> {
  const ids = candidates.map((c) => c.entity.id);
  const byId = new Map(candidates.map((c) => [c.entity.id, c]));
  const location = domain === "place" ? (ctx.scenario.location ?? undefined) : undefined;
  const scores: SideScores = {
    affinity: { A: new Map(), B: new Map() },
    pct: { A: new Map(), B: new Map() },
  };
  if (ids.length === 0) return scores;

  await Promise.all(
    SIDES.map(async (side) => {
      try {
        const r = await qlooCall(
          ctx,
          `shortlist-${side}`,
          domain,
          () =>
            ctx.client.getInsights({
              filterType: QLOO_TYPES[domain],
              signalEntities: ctx.seedIds[side],
              resultEntities: ids,
              filterLocationQuery: location,
              take: ids.length,
            }),
          (x) => x.entities.length,
        );
        for (const e of r.entities) {
          if (e.affinity !== null && byId.has(e.id)) scores.affinity[side].set(e.id, e.affinity);
        }
      } catch (err) {
        ctx.emit({
          type: "warning",
          message: `${domain} scoring against ${side} failed: ${(err as Error).message}`,
        });
      }
    }),
  );

  for (const side of SIDES) {
    scores.pct[side] = percentiles(scores.affinity[side]);
    for (const [id, affinity] of scores.affinity[side]) {
      const c = byId.get(id)!;
      const evidenceId = ctx.ledger.add({
        endpoint: "/v2/insights",
        profile: side,
        purpose: "shortlist",
        outputType: QLOO_TYPES[domain],
        candidateId: id,
        candidateName: c.entity.name,
        supportingSeedIds: c.supportingSeeds[side],
        rank: null,
        rawScore: affinity,
        normalizedScore: scores.pct[side].get(id) ?? null,
        popularityBaseline: c.entity.popularity,
        locationConditioned: domain === "place",
        kind: "rank-based",
        limitations: [`Percentile within a pool of ${ids.length} ${domain} candidates`],
      });
      c.evidenceIds.push(evidenceId);
    }
  }
  return scores;
}

/** Reason a candidate fails bilateral validation, or null if both sides support it. */
export function bilateralFailure(pctA: number | null, pctB: number | null): string | null {
  if (pctA === null && pctB === null) return "Qloo returned no support from either community";
  if (pctA === null) return "No support measured for community A";
  if (pctB === null) return "No support measured for community B";
  if (pctA < MIN_SIDE_PERCENTILE && pctB < MIN_SIDE_PERCENTILE) {
    return `Weak support from both communities (${ordinalPct(pctA)} and ${ordinalPct(pctB)} percentile of the pool)`;
  }
  const [low, side] = pctA <= pctB ? [pctA, "A"] : [pctB, "B"];
  if (low < MIN_SIDE_PERCENTILE) {
    return `One-sided: community ${side} support is only at the ${ordinalPct(low)} percentile of the pool`;
  }
  return null;
}
