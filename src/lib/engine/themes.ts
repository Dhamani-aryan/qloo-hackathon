import { qlooCall, type EngineContext } from "./context";
import { isSensitiveTag } from "./filters";
import type { Side, Theme } from "./types";

/** Tag subtypes that read as program themes (genres like "Rock" or formats like "Paperback" don't). */
const THEME_SUBTYPE = /theme|keyword/;
const MAX_THEMES = 8;

/**
 * Shared themes from Analysis Compare. Each shared tag names the seeds on both sides
 * that produce it, so every theme carries its own provenance.
 */
export async function findThemes(ctx: EngineContext): Promise<Theme[]> {
  let result;
  try {
    result = await qlooCall(
      ctx,
      "compare",
      null,
      () => ctx.client.compareProfiles({ aEntities: ctx.seedIds.A, bEntities: ctx.seedIds.B }),
      (r) => r.sharedTags.length,
    );
  } catch (err) {
    ctx.emit({ type: "warning", message: `Theme comparison failed: ${(err as Error).message}` });
    return [];
  }

  const seen = new Set<string>();
  const themes: Theme[] = [];
  for (const tag of result.sharedTags) {
    if (themes.length >= MAX_THEMES) break;
    if (!tag.subtype || !THEME_SUBTYPE.test(tag.subtype)) continue;
    if (isSensitiveTag(tag.name, tag.id)) continue;
    // Qloo returns the same idea as both a theme and a keyword; keep one per name.
    const key = tag.name.toLowerCase();
    if (seen.has(key)) continue;
    const support: Record<Side, string[]> = {
      A: tag.aEntityIds.filter((id) => ctx.sideOf.get(id) === "A"),
      B: tag.bEntityIds.filter((id) => ctx.sideOf.get(id) === "B"),
    };
    if (!support.A.length || !support.B.length) continue;
    seen.add(key);

    const evidenceId = ctx.ledger.add({
      endpoint: "/v2/analysis/compare",
      profile: "AB",
      purpose: "shared-theme",
      outputType: "urn:tag",
      candidateId: tag.id,
      candidateName: tag.name,
      supportingSeedIds: [...support.A, ...support.B],
      rank: themes.length + 1,
      rawScore: tag.score,
      normalizedScore: null,
      popularityBaseline: tag.popularity,
      locationConditioned: false,
      kind: "tag-based",
      limitations: [],
    });
    themes.push({
      tagId: tag.id,
      name: tag.name,
      subtype: tag.subtype,
      score: tag.score,
      supportingSeeds: support,
      evidenceId,
    });
  }
  return themes;
}
