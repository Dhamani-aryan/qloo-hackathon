import type { EntityMatch, QlooClient } from "@/lib/qloo";
import { QLOO_TYPES, type QlooTypeKey } from "@/lib/qloo";
import type { Seed } from "./types";

/**
 * Turn typed names into Qloo entity candidates. Nothing here is confirmed: the user (or
 * participant) must confirm each match before it becomes a `Seed` the engine will use.
 */

export interface SeedQuery {
  input: string;
  /** Restrict search to one type. Omit to search across the common media types. */
  type?: QlooTypeKey;
}

export type AmbiguityReason =
  "no_results" | "no_exact_name_match" | "duplicate_exact_names" | "type_mismatch";

export interface SeedResolution {
  input: string;
  matches: EntityMatch[];
  /** Suggested pick; still needs confirmation. */
  best: EntityMatch | null;
  ambiguous: boolean;
  reasons: AmbiguityReason[];
}

const SEARCH_TYPES: QlooTypeKey[] = ["artist", "movie", "tvShow", "book", "podcast", "place"];

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Popularity gap below which two exact-name matches are treated as genuinely ambiguous. */
export const DUPLICATE_MARGIN = 0.05;

export function assessMatches(query: SeedQuery, matches: EntityMatch[]): SeedResolution {
  if (matches.length === 0) {
    return { input: query.input, matches, best: null, ambiguous: true, reasons: ["no_results"] };
  }
  const reasons: AmbiguityReason[] = [];
  const target = normalizeName(query.input);
  const exact = matches.filter((m) => normalizeName(m.name) === target);

  // Several entities share the exact name (e.g. a show and its remake): pick the most popular, flag it.
  let best: EntityMatch;
  if (exact.length === 0) {
    reasons.push("no_exact_name_match");
    best = matches[0];
  } else {
    const ranked = [...exact].sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0));
    best = ranked[0];
    // Several things share the name. Only ask the user when the runner-up is nearly as
    // popular; otherwise the clearly more popular one (e.g. Skins the TV show at 0.98 vs a
    // namesake at 0.59) is almost always what people mean.
    const runnerUp = ranked[1];
    if (runnerUp && (best.popularity ?? 0) - (runnerUp.popularity ?? 0) < DUPLICATE_MARGIN) {
      reasons.push("duplicate_exact_names");
    }
  }

  if (query.type && best.type && best.type !== QLOO_TYPES[query.type]) {
    reasons.push("type_mismatch");
  }
  return { input: query.input, matches, best, ambiguous: reasons.length > 0, reasons };
}

export async function resolveSeed(
  client: QlooClient,
  query: SeedQuery,
  take = 5,
): Promise<SeedResolution> {
  const types = (query.type ? [query.type] : SEARCH_TYPES).map((t) => QLOO_TYPES[t]);
  const matches = await client.searchEntities({ query: query.input, types, take });
  return assessMatches(query, matches);
}

/** Build a confirmed seed from a match the user accepted. */
export function toSeed(input: string, match: EntityMatch, weight = 1): Seed {
  return {
    input,
    entityId: match.id,
    name: match.name,
    type: match.type,
    popularity: match.popularity,
    imageUrl: match.imageUrl,
    confirmed: true,
    weight,
  };
}
