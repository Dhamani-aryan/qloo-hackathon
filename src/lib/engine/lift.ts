import { clamp01, harmonicMean, ordinalPct } from "./normalize";
import { bilateralFailure } from "./validate";

/** Popularity band for discovered bridges (docs/SPIKE_FINDINGS.md). */
export const MIN_POPULARITY = 0.3;
export const MAX_POPULARITY = 0.9;
/**
 * Novelty only modulates bilateral support: it ranges from NOVELTY_FLOOR (at the popularity
 * cap) to 1 (at the niche end). With a full 0–1 range, a 54th/85th-percentile show beat a
 * 96th/96th-percentile one in the first live run just for being less popular.
 */
export const NOVELTY_FLOOR = 0.5;

export interface LiftResult {
  bilateral: number;
  novelty: number;
  /** bilateral × novelty: high only for items both sides like that aren't mainstream. */
  bilateralLift: number;
  verdict: "discovered" | "obvious" | "rejected";
  reason: string | null;
}

/**
 * Popularity adjustment. Raw bilateral support favours famous items, which are the
 * "obvious" bridge; discovered bridges must be well supported on both sides AND outside
 * the mainstream. Unknown popularity is treated as mid-band (0.5).
 */
export function assessLift(
  pctA: number | null,
  pctB: number | null,
  popularity: number | null,
): LiftResult {
  const bilateral = pctA !== null && pctB !== null ? harmonicMean(pctA, pctB) : 0;
  const pop = popularity ?? 0.5;
  const novelty =
    NOVELTY_FLOOR +
    (1 - NOVELTY_FLOOR) * clamp01((MAX_POPULARITY - pop) / (MAX_POPULARITY - MIN_POPULARITY));
  const base = { bilateral, novelty, bilateralLift: bilateral * novelty };

  const failure = bilateralFailure(pctA, pctB);
  if (failure) return { ...base, verdict: "rejected", reason: failure };
  if (pop > MAX_POPULARITY) {
    return {
      ...base,
      verdict: "obvious",
      reason: `Mainstream (popularity ${ordinalPct(pop)} percentile): shown as the obvious alternative`,
    };
  }
  if (pop < MIN_POPULARITY) {
    return {
      ...base,
      verdict: "rejected",
      reason: `Too niche to recruit around (popularity ${ordinalPct(pop)} percentile)`,
    };
  }
  return { ...base, verdict: "discovered", reason: null };
}
