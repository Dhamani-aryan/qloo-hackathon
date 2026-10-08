import { z } from "zod";
import { DEFAULT_DOMAINS, DOMAIN_KEYS, type DomainKey, type Scenario } from "@/lib/engine";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";

/**
 * Step 1 of the agent: choose which Qloo domains to investigate for this scenario.
 * The LLM only picks from domains the spike validated; a deterministic fallback runs if it fails.
 */

const DOMAIN_LABELS: Record<DomainKey, string> = {
  tvShow: "TV shows (screenings, watch clubs)",
  artist: "music artists (listening nights, live sets)",
  book: "books (reading circles, zines, readings)",
  podcast: "podcasts (live tapings, story nights)",
  place: "local places (venues, cafés, landmarks for meetups)",
  movie: "films (screenings; slower and weaker in tests)",
};

/** Domains that always run when available (validated in the spike and the first agent runs). */
export const CORE_DOMAINS: DomainKey[] = ["tvShow", "place"];

export const DomainPlanSchema = z.object({
  domains: z
    .array(
      z.object({
        domain: z.enum(DOMAIN_KEYS),
        reason: z.string().min(1).max(200),
      }),
    )
    .min(3)
    .max(5),
});
export type DomainPlan = z.infer<typeof DomainPlanSchema> & { source: "llm" | "fallback" };

export function fallbackPlan(scenario: Scenario): DomainPlan {
  const domains = DEFAULT_DOMAINS.filter((d) => d !== "place" || scenario.location);
  return {
    source: "fallback",
    domains: domains.map((domain) => ({ domain, reason: "Default validated domain" })),
  };
}

export async function planDomains(llm: LlmClient, scenario: Scenario): Promise<DomainPlan> {
  const seeds = (side: "a" | "b") =>
    scenario[side].seeds.map((s) => `${s.name} (${s.type?.split(":").pop() ?? "?"})`).join(", ");
  const available = DOMAIN_KEYS.filter((d) => d !== "place" || scenario.location);

  try {
    const { data } = await generateStructured(llm, {
      label: "domain-plan",
      schema: DomainPlanSchema,
      system:
        "You plan research for a cultural-program designer. Choose the 3–5 cultural domains " +
        "most likely to yield shared activities two communities would genuinely join. Prefer " +
        "domains that translate into repeatable, collaborative sessions. Never infer identity " +
        "or sensitive traits from the seeds.",
      prompt: [
        `Objective: ${scenario.objective || "(none given)"}`,
        `Location: ${scenario.location ?? "(none; do not choose place)"}`,
        `Community A, ${scenario.a.label}: ${seeds("a")}`,
        `Community B, ${scenario.b.label}: ${seeds("b")}`,
        `Available domains:\n${available.map((d) => `- ${d}: ${DOMAIN_LABELS[d]}`).join("\n")}`,
      ].join("\n"),
    });
    const domains = data.domains.filter(
      (d, i, all) =>
        available.includes(d.domain) && all.findIndex((x) => x.domain === d.domain) === i,
    );
    if (domains.length < 3) return fallbackPlan(scenario);
    // Core domains always run: in a live NYC run the planner dropped TV, the domain with the
    // strongest bilateral evidence (docs/DECISIONS.md, 2026-10-08).
    for (const core of CORE_DOMAINS) {
      if (available.includes(core) && !domains.some((d) => d.domain === core)) {
        domains.push({
          domain: core,
          reason: "Core domain: strongest bilateral evidence in testing",
        });
      }
    }
    return { source: "llm", domains };
  } catch {
    return fallbackPlan(scenario);
  }
}
