import { z } from "zod";
import { DOMAIN_KEYS, type DomainKey, type EngineResult, type Scenario } from "@/lib/engine";
import { isStrongBridge } from "@/lib/engine/select";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";
import type { Directives } from "./directives";

/**
 * The agent's review step: look at what the Qloo search found and decide whether to
 * investigate further. It can only choose from two tools, and their results go through the
 * same deterministic scoring as everything else, so the agent can widen the search but never
 * pick or invent a bridge itself.
 */

export const ReviewSchema = z.object({
  /** One or two plain sentences on the evidence so far. */
  assessment: z.string().min(1).max(280),
  actions: z
    .array(
      z.discriminatedUnion("tool", [
        z.object({
          tool: z.literal("explore_domain"),
          domain: z.enum(DOMAIN_KEYS),
          reason: z.string().min(1).max(200),
        }),
        z.object({
          tool: z.literal("focus_places"),
          theme: z.string().min(2).max(40),
          reason: z.string().min(1).max(200),
        }),
      ]),
    )
    .max(2),
});
export type Review = z.infer<typeof ReviewSchema>;
export type ReviewAction = Review["actions"][number];

const SYSTEM =
  "You are the research lead of an agent that finds cultural common ground between two " +
  "communities using Qloo's taste data. You review the evidence after a search round and " +
  "decide whether one more targeted search is worth it. A strong bridge has support at or " +
  "above the 50th percentile from BOTH groups. Search further when there are fewer than three " +
  "strong bridges, or when the organizer asked for something the results don't cover. Tools:\n" +
  "- explore_domain: search a kind of culture not searched yet.\n" +
  "- focus_places: look for places in the city with a theme (a short Qloo place-tag word such " +
  'as "jazz club", "bookstore", "park", "food"), chosen from the groups\' shared themes or the ' +
  "organizer's instructions.\n" +
  "Rules about cost, timing, age or accessibility are handled when the plan is written, not " +
  "by searching, so don't search for venues just to satisfy them. Return no actions when the " +
  "evidence is already strong. Never infer sensitive traits.";

export function reviewPrompt(
  scenario: Scenario,
  engine: EngineResult,
  searched: DomainKey[],
  directives: Directives,
  triedThemes: string[],
): string {
  const pct = (v: number | null) => (v === null ? "?" : Math.round(v * 100));
  const strong = engine.bridges.filter(isStrongBridge);
  const unsearched = DOMAIN_KEYS.filter(
    (d) =>
      !searched.includes(d) &&
      !directives.skipDomains.includes(d) &&
      (d !== "place" || scenario.location),
  );
  return [
    `Groups: ${scenario.a.label} (${scenario.a.seeds.map((s) => s.name).join(", ")}) and ` +
      `${scenario.b.label} (${scenario.b.seeds.map((s) => s.name).join(", ")}).`,
    `City: ${scenario.location ?? "(none: focus_places unavailable)"}`,
    `Organizer instructions: ${scenario.instructions.trim() || "(none)"}`,
    `Searched: ${searched.join(", ")}. Not searched yet: ${unsearched.join(", ") || "(none)"}.`,
    triedThemes.length ? `Place themes already tried: ${triedThemes.join(", ")}.` : "",
    `Strong bridges: ${strong.length} of ${engine.bridges.length} shown.`,
    ...engine.bridges.map(
      (b) => `- ${b.entity.name} (${b.domain}): ${pct(b.pct.A)}th / ${pct(b.pct.B)}th percentile`,
    ),
    `Close calls: ${
      engine.runnersUp
        .slice(0, 4)
        .map((r) => `${r.entity.name} (${r.domain}, ${pct(r.pct.A)}/${pct(r.pct.B)})`)
        .join("; ") || "(none)"
    }`,
    `Shared themes: ${
      engine.themes
        .slice(0, 6)
        .map((t) => t.name)
        .join(", ") || "(none)"
    }`,
    placeRejections(engine),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Why places were ruled out (e.g. jazz clubs that are bars), so the agent can adjust. */
function placeRejections(engine: EngineResult): string {
  const reasons = new Map<string, number>();
  for (const r of engine.rejections) {
    if (r.domain !== "place") continue;
    const key = r.reason.replace(/\s*\(.*\)$/, "");
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  if (reasons.size === 0) return "";
  const top = [...reasons].sort((x, y) => y[1] - x[1]).slice(0, 4);
  return `Places ruled out: ${top.map(([reason, n]) => `${n} × ${reason}`).join("; ")}.`;
}

/** Keep only actions the agent can actually take right now. */
export function validActions(
  review: Review,
  scenario: Scenario,
  searched: DomainKey[],
  directives: Directives,
  triedThemes: string[],
): ReviewAction[] {
  const seen = new Set<string>();
  return review.actions.filter((a) => {
    const key = a.tool === "explore_domain" ? `d:${a.domain}` : `t:${a.theme.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (a.tool === "explore_domain") {
      return (
        !searched.includes(a.domain) &&
        !directives.skipDomains.includes(a.domain) &&
        (a.domain !== "place" || Boolean(scenario.location))
      );
    }
    return Boolean(scenario.location) && !triedThemes.includes(a.theme.toLowerCase());
  });
}

export async function reviewEvidence(
  llm: LlmClient,
  scenario: Scenario,
  engine: EngineResult,
  searched: DomainKey[],
  directives: Directives,
  triedThemes: string[],
): Promise<{ assessment: string; actions: ReviewAction[]; wanted: number }> {
  const { data } = await generateStructured(llm, {
    label: "review",
    schema: ReviewSchema,
    system: SYSTEM,
    prompt: reviewPrompt(scenario, engine, searched, directives, triedThemes),
  });
  return {
    assessment: data.assessment,
    actions: validActions(data, scenario, searched, directives, triedThemes),
    wanted: data.actions.length,
  };
}

/** Prefer the result with more strong bridges, then more bridges, then higher total potential. */
export function betterResult(a: EngineResult, b: EngineResult): EngineResult {
  const key = (r: EngineResult) => [
    r.status === "ok" ? 1 : 0,
    r.bridges.filter(isStrongBridge).length,
    r.bridges.length,
    r.bridges.reduce((s, x) => s + x.bridgePotential, 0),
  ];
  const [ka, kb] = [key(a), key(b)];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] > ka[i] ? b : a;
  return a;
}
