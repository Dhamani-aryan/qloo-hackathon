import { z } from "zod";
import type { Scenario } from "@/lib/engine";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";

/**
 * The LLM-only baseline (plan §14, condition 1): the same objective, community labels and
 * seed names, but NO Qloo evidence. Shown next to COMMON GROUND so the contribution of
 * cultural intelligence is visible. Its cultural picks are unverified by design.
 */

const text = (max: number) => z.string().min(1).max(max);

export const BaselineProgramSchema = z.object({
  title: text(90),
  bridge: text(200),
  format: text(200),
  sessions: z
    .array(
      z.object({
        number: z.number().int().min(1).max(6),
        title: text(90),
        /** Any work, artist or place the LLM picks; not checked against Qloo. */
        anchor: z.string().max(120).nullable(),
        activity: text(600),
        roles: z.object({ A: text(240), B: text(240) }),
      }),
    )
    .min(3)
    .max(6),
  venueType: text(200),
  successMeasures: z.array(z.string().min(1).max(220)).max(6),
});
export type BaselineProgram = z.infer<typeof BaselineProgramSchema> & { kind: "llm_only" };

const BASELINE_SYSTEM =
  "You design recurring cultural programs that bring two communities together. Choose a " +
  "shared cultural bridge yourself and build sessions around specific works, artists or " +
  "places. Both communities need active, balanced roles. Never infer religion, ethnicity, " +
  "politics or other sensitive traits.";

export async function generateBaseline(
  llm: LlmClient,
  scenario: Scenario,
  sessions = 4,
): Promise<BaselineProgram> {
  const seeds = (side: "a" | "b") => scenario[side].seeds.map((s) => s.name).join(", ");
  const { data } = await generateStructured(llm, {
    label: "baseline",
    schema: BaselineProgramSchema,
    system: BASELINE_SYSTEM,
    prompt: [
      `Objective: ${scenario.objective || "(none given)"}`,
      `Location: ${scenario.location ?? "(not specified)"}`,
      `Community A, ${scenario.a.label}, likes: ${seeds("a")}`,
      `Community B, ${scenario.b.label}, likes: ${seeds("b")}`,
      `Design a ${sessions}-session program.`,
    ].join("\n"),
  });
  return { ...data, kind: "llm_only" };
}
