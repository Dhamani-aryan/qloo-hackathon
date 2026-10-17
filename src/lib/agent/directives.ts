import { z } from "zod";
import { DOMAIN_KEYS, type DomainKey, type Scenario } from "@/lib/engine";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";

/**
 * The organizer's free-text instructions, turned into things the agent can act on: kinds of
 * culture to skip or add, place themes to look for in Qloo, and rules the plan must follow.
 * The LLM only fills this schema; every field is applied by code, so an instruction can steer
 * the search but never inject cultural content.
 */

export const DirectivesSchema = z.object({
  /** Kinds of culture the organizer ruled out ("no podcasts"). */
  skipDomains: z.array(z.enum(DOMAIN_KEYS)).max(4),
  /** Extra kinds asked for ("they're gamers" → videoGame, "film club" → movie). */
  addDomains: z.array(z.enum(["movie", "videoGame"])).max(2),
  /** Place themes to search in the city, as short Qloo-style tag words ("jazz club", "food"). */
  placeThemes: z.array(z.string().min(2).max(40)).max(2),
  /** Who will attend, if the organizer said. */
  audience: z.enum(["all_ages", "teens", "adults", "seniors"]).nullable(),
  /** Concrete rules for the plan, rephrased as short imperatives ("Keep every session free"). */
  rules: z.array(z.string().min(3).max(140)).max(5),
});
export type Directives = z.infer<typeof DirectivesSchema>;

export const NO_DIRECTIVES: Directives = {
  skipDomains: [],
  addDomains: [],
  placeThemes: [],
  audience: null,
  rules: [],
};

const SYSTEM =
  "You turn a community organizer's instructions into settings for a cultural research agent. " +
  "Only encode what the organizer actually asked for; leave fields empty otherwise. " +
  "skipDomains/addDomains use these keys: " +
  DOMAIN_KEYS.join(", ") +
  ". placeThemes are short venue or activity words to look up as Qloo place tags (e.g. " +
  '"jazz club", "bookstore", "food", "park", "art gallery"); use them only when the organizer ' +
  "asks for a kind of place or activity. rules are short imperatives the program must follow " +
  "(budget, timing, accessibility, age, language). If anyone attending is under 18, audience " +
  'is "teens" (only young people) or "all_ages" (a mix). Never add rules about identity, ' +
  "religion, " +
  "ethnicity or politics.";

export async function interpretInstructions(
  llm: LlmClient,
  scenario: Scenario,
): Promise<Directives> {
  const text = scenario.instructions.trim();
  if (!text) return NO_DIRECTIVES;
  const { data } = await generateStructured(llm, {
    label: "directives",
    schema: DirectivesSchema,
    system: SYSTEM,
    prompt:
      `Organizer instructions: ${JSON.stringify(text)}\n` +
      `City: ${scenario.location ?? "(none)"}\n` +
      `Groups: ${scenario.a.label}; ${scenario.b.label}`,
  });
  return {
    ...data,
    // Places need a city; skip and add can't both apply to the same domain.
    placeThemes: scenario.location ? data.placeThemes : [],
    addDomains: data.addDomains.filter((d) => !data.skipDomains.includes(d)),
  };
}

/** Apply skip/add to a domain list, keeping a stable order. */
export function applyDirectives(domains: DomainKey[], d: Directives): DomainKey[] {
  const out = domains.filter((x) => !d.skipDomains.includes(x));
  for (const x of d.addDomains) if (!out.includes(x)) out.push(x);
  return DOMAIN_KEYS.filter((k) => out.includes(k));
}
