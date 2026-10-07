import type { ScoredCandidate } from "./types";

export const MAX_BRIDGES = 3;

export interface Selection {
  status: "ok" | "insufficient_evidence";
  bridges: ScoredCandidate[];
  obvious: ScoredCandidate | null;
}

const byPotential = (x: ScoredCandidate, y: ScoredCandidate) =>
  y.bridgePotential - x.bridgePotential ||
  y.bilateralLift - x.bilateralLift ||
  x.entity.name.localeCompare(y.entity.name);

/**
 * Pick up to three meaningfully different discovered bridges: the best per domain first,
 * then the next best overall if there are fewer than three domains. The obvious bridge is
 * the strongest mainstream pick by raw bilateral support, for the comparison view.
 */
export function selectBridges(scored: ScoredCandidate[]): Selection {
  const discovered = scored.filter((c) => c.verdict === "discovered").sort(byPotential);
  const picked: ScoredCandidate[] = [];
  const domains = new Set<string>();

  for (const c of discovered) {
    if (picked.length >= MAX_BRIDGES) break;
    if (!domains.has(c.domain)) {
      picked.push(c);
      domains.add(c.domain);
    }
  }
  for (const c of discovered) {
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
  };
}
