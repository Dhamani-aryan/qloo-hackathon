import type { ScoredCandidate } from "./types";

export const MAX_BRIDGES = 3;
export const MAX_RUNNERS_UP = 6;
/**
 * A shown bridge needs solid support from BOTH groups: a harmonic mean of the two percentiles
 * of at least 0.55, and neither group below the 50th percentile. Evaluation runs found third
 * bridges at the 41st–49th percentile for one group, which reads as "one group doesn't really
 * like it". The next strong candidate takes the slot instead; if nothing clears the bar, the
 * single best discovered candidate is still shown so a run isn't empty.
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
export function selectBridges(scored: ScoredCandidate[]): Selection {
  const discovered = scored.filter((c) => c.verdict === "discovered").sort(byPotential);
  const strong = discovered.filter(isStrongBridge);
  const eligible = strong.length > 0 ? strong : discovered.slice(0, 1);
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
      .filter((c) => c.verdict === "obvious")
      .sort((x, y) => y.bilateral - x.bilateral || x.entity.name.localeCompare(y.entity.name))[0] ??
    null;

  return {
    status: picked.length > 0 ? "ok" : "insufficient_evidence",
    bridges: picked.sort(byPotential),
    obvious,
    runnersUp: discovered.filter((c) => !picked.includes(c)).slice(0, MAX_RUNNERS_UP),
  };
}
