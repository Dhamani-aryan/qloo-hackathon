import type { EngineResult, Scenario, ScoredCandidate } from "@/lib/engine";

/**
 * The evidence brief: the ONLY cultural material the LLM may use. Entities and themes get
 * short refs (B1, R2, O1, T3) and carry their evidence IDs, so every claim the LLM makes can
 * be checked against the ledger afterwards.
 */

export type BriefRole = "bridge" | "runner_up" | "obvious";

export interface BriefEntity {
  ref: string;
  entityId: string;
  name: string;
  domain: string;
  role: BriefRole;
  /** Percentile of support within the pool, 0–100. */
  supportA: number | null;
  supportB: number | null;
  popularity: number | null;
  bridgePotential: number;
  supportedByA: string[];
  supportedByB: string[];
  evidenceIds: string[];
}

export interface BriefTheme {
  ref: string;
  name: string;
  supportedByA: string[];
  supportedByB: string[];
  evidenceId: string;
}

export interface EvidenceBrief {
  scenario: {
    title: string;
    objective: string;
    location: string | null;
    a: { label: string; seeds: string[] };
    b: { label: string; seeds: string[] };
  };
  entities: BriefEntity[];
  themes: BriefTheme[];
}

export function buildBrief(scenario: Scenario, result: EngineResult): EvidenceBrief {
  const seedName = new Map(
    [...scenario.a.seeds, ...scenario.b.seeds].map((s) => [s.entityId, s.name]),
  );
  const names = (ids: string[]) => ids.slice(0, 4).map((id) => seedName.get(id) ?? id);
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));

  const entity = (c: ScoredCandidate, role: BriefRole, ref: string): BriefEntity => ({
    ref,
    entityId: c.entity.id,
    name: c.entity.name,
    domain: c.domain,
    role,
    supportA: pct(c.pct.A),
    supportB: pct(c.pct.B),
    popularity: c.popularity === null ? null : Math.round(c.popularity * 100) / 100,
    bridgePotential: c.bridgePotential,
    supportedByA: names(c.supportingSeeds.A),
    supportedByB: names(c.supportingSeeds.B),
    evidenceIds: c.evidenceIds,
  });

  return {
    scenario: {
      title: scenario.title,
      objective: scenario.objective,
      location: scenario.location,
      a: { label: scenario.a.label, seeds: scenario.a.seeds.map((s) => s.name) },
      b: { label: scenario.b.label, seeds: scenario.b.seeds.map((s) => s.name) },
    },
    entities: [
      ...result.bridges.map((c, i) => entity(c, "bridge", `B${i + 1}`)),
      ...result.runnersUp.map((c, i) => entity(c, "runner_up", `R${i + 1}`)),
      ...(result.obvious ? [entity(result.obvious, "obvious", "O1")] : []),
    ],
    themes: result.themes.map((t, i) => ({
      ref: `T${i + 1}`,
      name: t.name,
      supportedByA: names(t.supportingSeeds.A),
      supportedByB: names(t.supportingSeeds.B),
      evidenceId: t.evidenceId,
    })),
  };
}

export function knownEvidenceIds(brief: EvidenceBrief): Set<string> {
  return new Set([
    ...brief.entities.flatMap((e) => e.evidenceIds),
    ...brief.themes.map((t) => t.evidenceId),
  ]);
}

/** Entities the program may use: bridges and runners-up (never the obvious contrast). */
export function programEntities(brief: EvidenceBrief): Map<string, BriefEntity> {
  return new Map(brief.entities.filter((e) => e.role !== "obvious").map((e) => [e.entityId, e]));
}

/** Compact text form for prompts. */
export function briefForPrompt(brief: EvidenceBrief): string {
  return JSON.stringify(brief, null, 1);
}
