import { z } from "zod";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";
import { briefForPrompt, type EvidenceBrief } from "./brief";
import { titleGuard, type Program } from "./program";

/**
 * One invitation per group. The hard part of bringing two communities together is getting
 * both to show up, so each message is pitched in that group's own terms: it opens from what
 * the group already loves and names the shared bridge. Titles go through the same evidence
 * guard as the plan.
 */

const InviteSchema = z.object({
  subject: z.string().min(1).max(90),
  message: z.string().min(1).max(700),
});
export const InvitationsSchema = z.object({ A: InviteSchema, B: InviteSchema });
export type Invitation = z.infer<typeof InviteSchema>;
export type Invitations = z.infer<typeof InvitationsSchema> & { removedTitles: string[] };

const SYSTEM =
  "You write short, warm invitations for a community program, one for each of two groups. " +
  "Each invitation speaks to that group only: open from one or two of ITS OWN favourites " +
  "(from scenario.a.seeds or scenario.b.seeds) and say why the program's main bridge will " +
  "appeal to them. Mention the first session's date only as a placeholder like [date]. " +
  "Keep it under 120 words, plain and specific, no hype, no emojis, no diversity framing, " +
  "and never mention religion, ethnicity, politics or other sensitive traits. Put titles in " +
  '"double quotes". Only name works, artists and places that appear in the brief or the plan. ' +
  "Follow scenario.rules (e.g. say it is free if the rules require that).";

export async function writeInvitations(
  llm: LlmClient,
  brief: EvidenceBrief,
  program: Program,
): Promise<Invitations> {
  const plan = {
    title: program.title,
    objective: program.objective,
    format: program.format,
    venueType: program.venueType,
    sessions: program.sessions.map((s) => ({
      number: s.number,
      title: s.title,
      anchor: s.entity?.name ?? null,
      roles: s.roles,
    })),
  };
  const { data } = await generateStructured(llm, {
    label: "invitations",
    schema: InvitationsSchema,
    system: SYSTEM,
    prompt:
      `Evidence brief:\n${briefForPrompt(brief)}\n\n` +
      `Program:\n${JSON.stringify(plan, null, 1)}\n\n` +
      `Write {"A": {subject, message}, "B": {subject, message}}: A for ` +
      `${brief.scenario.a.label}, B for ${brief.scenario.b.label}.`,
  });
  const removedTitles: string[] = [];
  const clean = titleGuard(brief, removedTitles);
  const guard = (i: Invitation): Invitation => ({
    subject: clean(i.subject),
    message: clean(i.message),
  });
  return { A: guard(data.A), B: guard(data.B), removedTitles };
}
