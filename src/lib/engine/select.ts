import type { ScoredCandidate } from "./types";

export const MAX_BRIDGES = 3;
export const MAX_RUNNERS_UP = 6;
/**
 * A shown bridge needs solid support from BOTH groups (harmonic mean of the two percentiles).
 * The evaluation found third bridges at ~51st/51st percentile; showing two strong bridges is
 * better than padding with a weak third. If nothing clears the bar, the single best discovered
 * candidate is still shown so a run isn't empty.
 */
export const MIN_BRIDGE_BILATERAL = 0.55;

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
  const strong = discovered.filter((c) => c.bilateral >= MIN_BRIDGE_BILATERAL);
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
