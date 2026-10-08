import type { EngineResult, ScoredCandidate } from "@/lib/engine";
import { entity, scenario as baseScenario } from "../engine/helpers";

/** A small synthetic engine result for agent tests (made-up names and IDs). */
export function scored(
  id: string,
  name: string,
  domain: ScoredCandidate["domain"],
  verdict: ScoredCandidate["verdict"],
  bp: number,
): ScoredCandidate {
  return {
    entity: entity(id, name, { popularity: verdict === "obvious" ? 0.99 : 0.6 }),
    domain,
    admittedBy: ["combined-top"],
    supportingSeeds: { A: ["SA1"], B: ["SB1"] },
    evidenceIds: [`ev_${id}_ab`, `ev_${id}_a`, `ev_${id}_b`],
    affinity: { A: 0.9, B: 0.9 },
    pct: { A: 0.8, B: 0.7 },
    popularity: verdict === "obvious" ? 0.99 : 0.6,
    bilateral: 0.75,
    novelty: 0.8,
    bilateralLift: 0.6,
    evidenceDiversity: 0.5,
    localAvailability: domain === "place" ? 1 : 0,
    bridgePotential: bp,
    verdict,
    rejectionReason: null,
  };
}

export const SCENARIO = baseScenario({ objective: "A four-session campus and city program" });

export const RESULT: EngineResult = {
  scenarioId: "test",
  status: "ok",
  bridges: [
    scored("E_SHOW", "Shared Comedy", "tvShow", "discovered", 60),
    scored("E_CAFE", "Corner Café", "place", "discovered", 55),
    scored("E_DUO", "Jazz Fusion Duo", "artist", "discovered", 50),
  ],
  runnersUp: [scored("E_BOOK", "Quiet Novel", "book", "discovered", 40)],
  obvious: scored("E_FAMOUS", "Famous Drama", "tvShow", "obvious", 45),
  themes: [
    {
      tagId: "t:growth",
      name: "Personal growth",
      subtype: "urn:tag:theme:qloo",
      score: 0.7,
      supportingSeeds: { A: ["SA1"], B: ["SB2"] },
      evidenceId: "ev_theme_1",
    },
  ],
  rejections: [],
  evidence: [],
  warnings: [],
  stats: { qlooCalls: 13, ms: 100, domains: ["tvShow", "place", "artist"], poolSize: 10 },
};
