import type { ScoredCandidate } from "./types";
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

/** True when both groups clearly support the candidate. */
export function isStrongBridge(c: ScoredCandidate): boolean {
  return (
    c.bilateral >= MIN_BRIDGE_BILATERAL && Math.min(c.pct.A ?? 0, c.pct.B ?? 0) >= MIN_BRIDGE_SIDE
  );
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
export function selectBridges(scored: ScoredCandidate[], settings = DEFAULT_SETTINGS): Selection {
  const order = (a: ScoredCandidate, b: ScoredCandidate) =>
    Number(assessActivityFit(b, settings).level === "good") -
      Number(assessActivityFit(a, settings).level === "good") || byPotential(a, b);
  const discovered = scored
    .filter(
      (c) =>
        c.verdict === "discovered" || (settings.novelty === "familiar" && c.verdict === "obvious"),
    )
    .sort(order);
  const strong = discovered.filter(isStrongBridge);
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
