import { z } from "zod";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";
import { briefForPrompt, type EvidenceBrief } from "./brief";
import { guardProgram, PROGRAM_SYSTEM, ProgramDraftSchema, type Program } from "./program";

/**
 * One critic pass (plan §10): check the program against the checklist, return the issues it
 * found and a revised program. The revision goes through the same evidence guard.
 */

export const CRITIC_CHECKS = [
  "passive_audience", // one community watches while the other performs or teaches
  "expertise_barrier", // participation requires prior skill
  "diversity_seminar", // feels like compulsory dialogue rather than something people want to do
  "decorative_bridge", // the cultural bridge is not actually used in the activity
  "one_off", // not genuinely recurring or cumulative
  "cost_or_access", // cost, venue, timing or language excludes people
  "unattractive_alone", // would not appeal without the cohesion framing
  "tokenism", // a tradition or group is flattened, tokenized or appropriated
  "unsupported_claims", // claims outcomes or facts not supported by the evidence
  "generic_roles", // the two communities' roles are interchangeable boilerplate
] as const;

export const CritiqueSchema = z.object({
  issues: z
    .array(
      z.object({
        check: z.enum(CRITIC_CHECKS),
        problem: z.string().min(1).max(300),
        fix: z.string().min(1).max(300),
      }),
    )
    .max(8),
  revised: ProgramDraftSchema,
});
export type CritiqueIssue = z.infer<typeof CritiqueSchema>["issues"][number];

export interface Critique {
  issues: CritiqueIssue[];
  revised: Program;
}

const CRITIC_SYSTEM =
  "You are a demanding reviewer of community cultural programs. Review the draft program " +
  `against these checks: ${CRITIC_CHECKS.join(", ")}. "generic_roles" means the two ` +
  "communities' roles are copy-pasted: give each community a distinct contribution that draws " +
  "on what its own seeds suggest it enjoys, while neither leads or teaches the other. List only " +
  "real issues (an empty list is fine), then return the full revised program. Keep everything " +
  "that already works. The revised program must follow the same rules as the original:\n" +
  PROGRAM_SYSTEM;

export async function critiqueProgram(
  llm: LlmClient,
  brief: EvidenceBrief,
  program: Program,
): Promise<Critique> {
  // Send the draft in its LLM-facing shape (refs, not resolved entities).
  const draft = {
    ...program,
    sessions: program.sessions.map((s) => ({
      number: s.number,
      title: s.title,
      entityRef: s.entityRef,
      themeRef: s.themeRef,
      activity: s.activity,
      roles: s.roles,
    })),
    guard: undefined,
  };
  const { data } = await generateStructured(llm, {
    label: "critic",
    schema: CritiqueSchema,
    system: CRITIC_SYSTEM,
    prompt:
      `Evidence brief:\n${briefForPrompt(brief)}\n\n` +
      `Draft program:\n${JSON.stringify(draft, null, 1)}\n\n` +
      `Review it and return {"issues": [...], "revised": {...full program...}}.`,
  });
  return { issues: data.issues, revised: guardProgram(data.revised, brief) };
}
