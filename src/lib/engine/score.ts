import { assessLift } from "./lift";
import type { Candidate, ScoredCandidate, Theme } from "./types";
import type { SideScores } from "./validate";

/**
 * Bridge Potential (plan §8 Stage 6, simplified in Revision 3.0):
 *   0.70 × BilateralLift + 0.20 × EvidenceDiversity + 0.10 × LocalAvailability
 * Shown as 0–100. It is a transparent ranking score, not a probability.
 */
export const WEIGHTS = { bilateralLift: 0.7, evidenceDiversity: 0.2, localAvailability: 0.1 };

/**
 * Independent kinds of Qloo evidence for a candidate (0–1):
 * appears in the combined top results, survives the popularity cap, is credited by
 * explainability to seeds on BOTH sides, and carries a tag that is a shared theme.
 */
export function evidenceDiversity(c: Candidate, themeTagIds: Set<string>): number {
  const signals = [
    c.admittedBy.includes("combined-top"),
    c.admittedBy.includes("popularity-capped"),
    c.supportingSeeds.A.length > 0 && c.supportingSeeds.B.length > 0,
    c.entity.tags.some((t) => themeTagIds.has(t.id)),
  ];
  return signals.filter(Boolean).length / signals.length;
}

export function scoreCandidate(
  c: Candidate,
  scores: SideScores,
  themes: Theme[] = [],
): ScoredCandidate {
  const id = c.entity.id;
  const pct = { A: scores.pct.A.get(id) ?? null, B: scores.pct.B.get(id) ?? null };
  const lift = assessLift(pct.A, pct.B, c.entity.popularity);
  const diversity = evidenceDiversity(c, new Set(themes.map((t) => t.tagId)));
  const local = c.domain === "place" ? 1 : 0;
  const raw =
    WEIGHTS.bilateralLift * lift.bilateralLift +
    WEIGHTS.evidenceDiversity * diversity +
    WEIGHTS.localAvailability * local;

  return {
    ...c,
    affinity: { A: scores.affinity.A.get(id) ?? null, B: scores.affinity.B.get(id) ?? null },
    pct,
    popularity: c.entity.popularity,
    bilateral: lift.bilateral,
    novelty: lift.novelty,
    bilateralLift: lift.bilateralLift,
    evidenceDiversity: diversity,
    localAvailability: local,
    bridgePotential: Math.round(raw * 100),
    verdict: lift.verdict,
    rejectionReason: lift.verdict === "rejected" ? lift.reason : null,
  };
}
