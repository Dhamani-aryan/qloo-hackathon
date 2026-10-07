/**
 * Qloo types and URNs. Shapes follow docs.qloo.com (Insights, Search, Tags, Analysis Compare).
 * Raw responses are normalized into these internal types in `normalize.ts`; nothing
 * outside `src/lib/qloo` should touch raw Qloo JSON.
 */

/** Insights `filter.type` values. Confirm each against the hackathon key in the spike. */
export const QLOO_TYPES = {
  artist: "urn:entity:artist",
  book: "urn:entity:book",
  brand: "urn:entity:brand",
  destination: "urn:entity:destination",
  movie: "urn:entity:movie",
  person: "urn:entity:person",
  place: "urn:entity:place",
  podcast: "urn:entity:podcast",
  tvShow: "urn:entity:tv_show",
  // Docs disagree: hackathon guide says `video_game`, API reference says `videogame`.
  // See docs/DECISIONS.md. Step 1.5 must confirm.
  videoGame: "urn:entity:videogame",
  tag: "urn:tag",
} as const;

export type QlooTypeKey = keyof typeof QLOO_TYPES;
export type QlooTypeUrn = (typeof QLOO_TYPES)[QlooTypeKey];

/** One entity as used inside COMMON GROUND. */
export interface QlooEntity {
  id: string;
  name: string;
  /** Primary type URN, e.g. `urn:entity:movie`. */
  type: string | null;
  subtype: string | null;
  description: string | null;
  imageUrl: string | null;
  /** Qloo popularity percentile (0–1) when returned. */
  popularity: number | null;
  /** Short disambiguation text, e.g. year or artist, when returned by search. */
  disambiguation: string | null;
  geocode: {
    city: string | null;
    metro: string | null;
    countryCode: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  tags: { id: string; name: string | null; type: string | null }[];
}

/** Search result: an entity plus its position in the result list. */
export interface EntityMatch extends QlooEntity {
  rank: number;
}

/** Insights recommendation: an entity plus query-relative scoring. */
export interface InsightsEntity extends QlooEntity {
  rank: number;
  /** `query.affinity` (0–1). Only comparable within one query; see plan §8 Stage 5. */
  affinity: number | null;
  /** `query.affinity_rank` when returned. */
  affinityRank: number | null;
  /** Per-input-entity contribution from `feature.explainability`, keyed by input entity ID. */
  explainability: Record<string, number> | null;
}

export interface InsightsResult {
  entities: InsightsEntity[];
  /** Aggregate influence of each input entity across all results, when explainability is on. */
  aggregateExplainability: Record<string, number> | null;
  durationMs: number | null;
}

export interface TagMatch {
  id: string;
  name: string;
  type: string | null;
  parents: string[];
}

/** A tag from Analysis Compare, merged across the seed pairs that produced it. */
export interface CompareTag {
  id: string;
  name: string;
  /** e.g. `urn:tag:genre:music`, `urn:tag:theme:qloo`. */
  subtype: string | null;
  popularity: number | null;
  /** Shared-tag strength (`query.score`), present on shared tags. */
  score: number | null;
  /** Number of a side's seeds carrying the tag (`query.count`), present on one-sided tags. */
  count: number | null;
  /** Seeds from A / B that support this tag: provenance for program themes. */
  aEntityIds: string[];
  bEntityIds: string[];
}

export interface CompareResult {
  /** Tags both groups share, strongest first. */
  sharedTags: CompareTag[];
  /** Tags characteristic of A / of B. */
  aTags: CompareTag[];
  bTags: CompareTag[];
  /** `matchEntities` (empty in every spike call so far). */
  matchEntities: QlooEntity[];
  raw: unknown;
  durationMs: number | null;
}

// ---------- inputs ----------

export interface SearchInput {
  query: string;
  /** Search type URNs. Note: these differ from Insights `filter.type` values. */
  types?: string[];
  take?: number;
}

export interface TagSearchInput {
  query: string;
  tagTypes?: string[];
  parentTypes?: string[];
  take?: number;
  typoTolerance?: boolean;
}

export interface InsightsInput {
  filterType: string;
  signalEntities?: string[];
  signalTags?: string[];
  /** Assess affinity only for these entity IDs (shortlist scoring). */
  resultEntities?: string[];
  excludeEntities?: string[];
  filterTags?: string[];
  /** Locality name, e.g. "New York City". Used as `filter.location.query`. */
  filterLocationQuery?: string;
  /** Locality name used as a signal (`signal.location.query`). */
  signalLocationQuery?: string;
  popularityMin?: number;
  popularityMax?: number;
  biasTrends?: "off" | "very_low" | "low" | "mid" | "medium" | "high" | "very_high";
  explainability?: boolean;
  take?: number;
  page?: number;
  /** Escape hatch for parameters found during the spike. Keys are raw Qloo param names. */
  extraParams?: Record<string, string | number | boolean | string[]>;
}

export interface CompareInput {
  aEntities: string[];
  bEntities: string[];
  filterTypes?: string[];
  locationQuery?: string;
  model?: "descriptive" | "predictive";
  take?: number;
}

export interface QlooClient {
  searchEntities(input: SearchInput): Promise<EntityMatch[]>;
  searchTags(input: TagSearchInput): Promise<TagMatch[]>;
  getInsights(input: InsightsInput): Promise<InsightsResult>;
  compareProfiles(input: CompareInput): Promise<CompareResult>;
}
