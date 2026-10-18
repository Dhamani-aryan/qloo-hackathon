import type { EngineResult, ScoredCandidate } from "./types";
import { DEFAULT_SETTINGS } from "@/lib/planning";
import { assessActivityFit } from "./fit";

export const MAX_BRIDGES = 3;
export const MAX_RUNNERS_UP = 6;
/**
 * A shown bridge needs solid support from BOTH groups: a harmonic mean of the two percentiles
 * of at least 0.55, and neither group below the 50th percentile. Evaluation runs found third
 * bridges at the 41st–49th percentile for one group. Candidates below the threshold remain
 * runners-up; a weak result must never be promoted just to avoid an empty run.
 */
export const MIN_BRIDGE_BILATERAL = 0.55;
export const MIN_BRIDGE_SIDE = 0.5;

export interface BridgeBar {
  bilateral: number;
  side: number;
}
export const NORMAL_BAR: BridgeBar = { bilateral: MIN_BRIDGE_BILATERAL, side: MIN_BRIDGE_SIDE };
/**
 * Percentiles are relative to the candidate pool, so two groups with almost nothing in common
 * still produce candidates "above the 50th percentile". When Qloo's Compare finds no shared
 * theme at all (true of a kids' TV vs death-metal test pair, never of the evaluation cases),
 * only clearly two-sided candidates are shown.
 */
export const WEAK_OVERLAP_BAR: BridgeBar = { bilateral: 0.7, side: 0.65 };

/** The bar a result's bridges were selected against. */
export const barFor = (r: Pick<EngineResult, "overlap">): BridgeBar =>
  r.overlap === "weak" ? WEAK_OVERLAP_BAR : NORMAL_BAR;

/** True when both groups clearly support the candidate. */
export function isStrongBridge(c: ScoredCandidate, bar: BridgeBar = NORMAL_BAR): boolean {
  return c.bilateral >= bar.bilateral && Math.min(c.pct.A ?? 0, c.pct.B ?? 0) >= bar.side;
}

export interface Selection {
  status: "ok" | "insufficient_evidence";
  bridges: ScoredCandidate[];
  obvious: ScoredCandidate | null;
  runnersUp: ScoredCandidate[];
}

const byPotential = (x: ScoredCandidate, y: ScoredCandidate) =>
  y.bridgePotential - x.bridgePotential ||
  y.bilateralLift - x.bilateralLift ||
  x.entity.name.localeCompare(y.entity.name);

/**
 * Pick up to three meaningfully different, strongly supported bridges: the best per domain
 * first, then the next best overall if there are fewer than three domains. The obvious bridge is
 * the strongest mainstream pick by raw bilateral support, for the comparison view.
 */
export function selectBridges(
  scored: ScoredCandidate[],
  settings = DEFAULT_SETTINGS,
  bar: BridgeBar = NORMAL_BAR,
): Selection {
  const order = (a: ScoredCandidate, b: ScoredCandidate) =>
    Number(assessActivityFit(b, settings).level === "good") -
      Number(assessActivityFit(a, settings).level === "good") || byPotential(a, b);
  const discovered = scored
    .filter(
      (c) =>
        c.verdict === "discovered" || (settings.novelty === "familiar" && c.verdict === "obvious"),
    )
    .sort(order);
  const strong = discovered.filter((c) => isStrongBridge(c, bar));
  const eligible = strong;
  const picked: ScoredCandidate[] = [];
  const domains = new Set<string>();

  for (const c of eligible) {
    if (picked.length >= MAX_BRIDGES) break;
    if (!domains.has(c.domain)) {
      picked.push(c);
      domains.add(c.domain);
    }
  }
  for (const c of eligible) {
    if (picked.length >= MAX_BRIDGES) break;
    if (!picked.includes(c)) picked.push(c);
  }

  const obvious =
    scored
      .filter((c) => c.verdict === "obvious" && !picked.includes(c))
      .sort((x, y) => y.bilateral - x.bilateral || x.entity.name.localeCompare(y.entity.name))[0] ??
    null;

  return {
    status: picked.length > 0 ? "ok" : "insufficient_evidence",
    bridges: picked.sort(order),
    obvious,
    runnersUp: discovered.filter((c) => !picked.includes(c)).slice(0, MAX_RUNNERS_UP),
  };
}
