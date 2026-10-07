import { z } from "zod";
import type { QlooEntity, QlooTypeKey } from "@/lib/qloo";

/**
 * Bridge-engine domain types. Inputs (scenario, profiles, seeds) are Zod schemas because
 * they cross the API boundary; engine outputs are plain interfaces.
 */

export const SIDES = ["A", "B"] as const;
export type Side = (typeof SIDES)[number];

/** Output domains the engine can investigate (validated in docs/SPIKE_FINDINGS.md). */
export const DOMAIN_KEYS = ["tvShow", "artist", "book", "podcast", "place", "movie"] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number] & QlooTypeKey;
export const DEFAULT_DOMAINS: DomainKey[] = ["tvShow", "artist", "book", "podcast", "place"];

// ---------- inputs ----------

export const SeedSchema = z.object({
  /** What the user or participant typed. */
  input: z.string().min(1),
  entityId: z.string().min(1),
  name: z.string().min(1),
  /** Qloo type URN of the resolved entity. */
  type: z.string().nullable(),
  popularity: z.number().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  /** Engine analysis uses confirmed seeds only. */
  confirmed: z.boolean(),
  /** How many intake participants named this entity (1 for organizer-supplied seeds). */
  weight: z.number().int().positive().default(1),
});
export type Seed = z.infer<typeof SeedSchema>;

export const CommunityProfileSchema = z.object({
  side: z.enum(SIDES),
  label: z.string().min(1),
  source: z.enum(["intake", "organizer"]),
  contributorCount: z.number().int().nonnegative().nullable().default(null),
  seeds: z.array(SeedSchema).min(1),
});
export type CommunityProfile = z.infer<typeof CommunityProfileSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().default(""),
  /** Locality name used for place results, e.g. "New York City". */
  location: z.string().nullable().default(null),
  a: CommunityProfileSchema,
  b: CommunityProfileSchema,
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// ---------- evidence ----------

export type EvidenceKind = "direct" | "rank-based" | "tag-based" | "location-conditioned";

export interface Evidence {
  evidenceId: string;
  source: "qloo";
  endpoint: "/v2/insights" | "/v2/analysis/compare" | "/search";
  /** Which signal produced it: one community, both combined, or neither. */
  profile: Side | "AB";
  /** Why this query ran, e.g. "combined-top", "popularity-capped", "shortlist". */
  purpose: string;
  outputType: string;
  candidateId: string;
  candidateName: string;
  supportingSeedIds: string[];
  rank: number | null;
  /** Raw Qloo affinity; only comparable within one query. */
  rawScore: number | null;
  /** Percentile within the candidate pool (0–1), set by shortlist scoring. */
  normalizedScore: number | null;
  popularityBaseline: number | null;
  locationConditioned: boolean;
  kind: EvidenceKind;
  limitations: string[];
}

// ---------- candidates and bridges ----------

export type AdmissionRule = "combined-top" | "popularity-capped";

export interface Candidate {
  entity: QlooEntity;
  domain: DomainKey;
  admittedBy: AdmissionRule[];
  /** Seeds credited by explainability on the combined query, split by side. */
  supportingSeeds: Record<Side, string[]>;
  evidenceIds: string[];
}

export interface ScoredCandidate extends Candidate {
  affinity: Record<Side, number | null>;
  /** Within-pool percentile of each side's affinity. */
  pct: Record<Side, number | null>;
  popularity: number | null;
  /** harmonic_mean(pctA, pctB). */
  bilateral: number;
  /** Rescaled (1 − popularity), 0–1 over the allowed popularity band. */
  novelty: number;
  /** bilateral × novelty. */
  bilateralLift: number;
  evidenceDiversity: number;
  localAvailability: number;
  /** 0–100 display score. Not a probability. */
  bridgePotential: number;
  verdict: "discovered" | "obvious" | "rejected";
  rejectionReason: string | null;
}

export interface Theme {
  tagId: string;
  name: string;
  subtype: string | null;
  score: number | null;
  supportingSeeds: Record<Side, string[]>;
  evidenceId: string;
}

export interface Rejection {
  candidateId: string;
  name: string;
  domain: DomainKey;
  reason: string;
}

export interface EngineStats {
  qlooCalls: number;
  ms: number;
  domains: DomainKey[];
  poolSize: number;
}

export interface EngineResult {
  scenarioId: string;
  status: "ok" | "insufficient_evidence";
  /** Up to three meaningfully different discovered bridges, best first. */
  bridges: ScoredCandidate[];
  /** The best popular, high-support pick, shown as the contrast in the UI. */
  obvious: ScoredCandidate | null;
  themes: Theme[];
  rejections: Rejection[];
  evidence: Evidence[];
  warnings: string[];
  stats: EngineStats;
}

export type EngineEvent =
  | { type: "domain_started"; domain: DomainKey }
  | {
      type: "qloo_query_done";
      purpose: string;
      domain: DomainKey | null;
      results: number;
      ms: number;
    }
  | { type: "candidate_found"; domain: DomainKey; name: string; admittedBy: AdmissionRule[] }
  | { type: "candidate_rejected"; domain: DomainKey; name: string; reason: string }
  | {
      type: "bridge_ranked";
      rank: number;
      name: string;
      domain: DomainKey;
      bridgePotential: number;
    }
  | { type: "warning"; message: string };
