import type { Scenario } from "@/lib/engine/types";
import type { BaselineProgram } from "./baseline";
import type { Program } from "./program";

/**
 * With vs without Qloo (plan §14 ablation). Counts what the Qloo-backed program discovered
 * against what the LLM-only baseline named: favourites it merely reused vs unverified guesses.
 * Used by the UI and by the evaluation (eval/run.ts).
 */

export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split an anchor like "Lady Bird, Cinema Paradiso, and Just Kids" into names. */
export function splitAnchor(anchor: string | null): string[] {
  if (!anchor) return [];
  return anchor
    .split(/,\s*|\s+and\s+|\s*&\s*|;\s*/)
    .map((s) => s.replace(/^and\s+/i, "").trim())
    .filter(Boolean);
}

export interface ComparisonStats {
  ours: { anchored: number; discovered: number; evidence: number; sessions: number };
  baseline: { named: number; reusedSeeds: number; unverified: number; sessions: number };
}

export function compareStats(
  program: Program,
  baseline: BaselineProgram,
  scenario: Scenario,
): ComparisonStats {
  const seeds = new Set([...scenario.a.seeds, ...scenario.b.seeds].map((s) => normName(s.name)));
  const ourEntities = program.sessions.flatMap((s) => (s.entity ? [s.entity.name] : []));
  const theirs = baseline.sessions.flatMap((s) => splitAnchor(s.anchor));
  const reused = theirs.filter((n) => seeds.has(normName(n)));
  return {
    ours: {
      anchored: ourEntities.length,
      discovered: ourEntities.filter((n) => !seeds.has(normName(n))).length,
      evidence: program.evidenceIds.length,
      sessions: program.sessions.length,
    },
    baseline: {
      named: theirs.length,
      reusedSeeds: reused.length,
      unverified: theirs.length - reused.length,
      sessions: baseline.sessions.length,
    },
  };
}
