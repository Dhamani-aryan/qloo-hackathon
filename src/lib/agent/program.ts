import { z } from "zod";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";
import { briefForPrompt, knownEvidenceIds, programEntities, type EvidenceBrief } from "./brief";

/**
 * Program generator (plan §10): a recurring program whose sessions are anchored to Qloo
 * entities from the evidence brief. The LLM refers to entities by brief ref (B1, R2...);
 * the guard resolves refs to real entities and strips anything that isn't in the evidence.
 */

const text = (max: number) => z.string().min(1).max(max);
const list = z.array(z.string().min(1).max(220)).max(6);

export const ProgramDraftSchema = z.object({
  title: text(90),
  objective: text(320),
  bridgeRef: z.string().regex(/^B\d+$/),
  format: text(200),
  sessions: z
    .array(
      z.object({
        number: z.number().int().min(1).max(6),
        title: text(90),
        /** Brief ref (B1, R2...) of the session's Qloo entity, or null (e.g. a co-creation finale). */
        entityRef: z.string().nullable(),
        themeRef: z.string().nullable(),
        activity: text(600),
        roles: z.object({ A: text(240), B: text(240) }),
      }),
    )
    .min(3)
    .max(6),
  venueType: text(200),
  partnerTypes: list,
  accessibility: list,
  frictionMitigations: list,
  successMeasures: list,
  limitations: list,
  evidenceIds: z.array(z.string()),
});
export type ProgramDraft = z.infer<typeof ProgramDraftSchema>;

export interface ProgramSession extends Omit<ProgramDraft["sessions"][number], "entityRef"> {
  entityRef: string | null;
  entity: { id: string; name: string; domain: string; evidenceIds: string[] } | null;
  theme: { name: string; evidenceId: string } | null;
}

export interface GuardReport {
  removedEntityRefs: string[];
  removedThemeRefs: string[];
  removedEvidenceIds: string[];
  removedTitles: string[];
  warnings: string[];
}

export interface Program extends Omit<ProgramDraft, "sessions"> {
  sessions: ProgramSession[];
  guard: GuardReport;
}

export const PROGRAM_SYSTEM =
  "You design recurring cultural programs that bring two communities together through a " +
  "shared cultural bridge. Rules:\n" +
  "1. Build sessions around entities from the evidence brief, referenced by their ref " +
  "(B1, R2...). The main bridge (bridgeRef) must anchor at least one session. Never invent or " +
  "name works, artists, or places that are not in the brief; use entityRef null for a session " +
  "without a Qloo anchor (e.g. a final co-creation session).\n" +
  "2. Both communities need active, balanced roles in every session: no one group performs " +
  "or teaches while the other watches.\n" +
  "3. Prefer repeated contact and shared creation over one-off passive attendance. No prior " +
  "expertise required; keep cost and access barriers low.\n" +
  "4. It must be attractive on its own merits, not framed as a diversity seminar.\n" +
  "5. Do not claim it will reduce prejudice or improve cohesion; success measures should be " +
  "observable (return attendance, co-created outputs, cross-group pairs).\n" +
  "6. Never infer or mention religion, ethnicity, politics or other sensitive traits.\n" +
  "7. Cite evidence IDs from the brief in evidenceIds.";

export function programPrompt(brief: EvidenceBrief, bridgeRef: string, sessions = 4): string {
  return (
    `Evidence brief:\n${briefForPrompt(brief)}\n\n` +
    `Design a ${sessions}-session program built on bridge ${bridgeRef}. ` +
    `Use other B*/R* entities for the remaining sessions where they fit; place entities can ` +
    `serve as venues or outings. Themes (T*) may name a session's angle.`
  );
}

/** Titles quoted in prose ("…", “…”, *…*), used to catch works the brief doesn't contain. */
function quotedTitles(s: string): string[] {
  return [...s.matchAll(/[“"*_]([^“”"*_]{2,60})[”"*_]/g)].map((m) => m[1].trim());
}

export function guardProgram(draft: ProgramDraft, brief: EvidenceBrief): Program {
  const allowed = programEntities(brief);
  const byRef = new Map([...allowed.values()].map((e) => [e.ref, e]));
  const themes = new Map(brief.themes.map((t) => [t.ref, t]));
  const evidence = knownEvidenceIds(brief);
  const knownNames = new Set(
    [
      ...brief.entities.map((e) => e.name),
      ...brief.scenario.a.seeds,
      ...brief.scenario.b.seeds,
      ...brief.themes.map((t) => t.name),
    ].map((n) => n.toLowerCase()),
  );
  const guard: GuardReport = {
    removedEntityRefs: [],
    removedThemeRefs: [],
    removedEvidenceIds: [],
    removedTitles: [],
    warnings: [],
  };

  const clean = (s: string) => {
    let out = s;
    for (const title of quotedTitles(s)) {
      const lower = title.toLowerCase();
      const known = [...knownNames].some(
        (n) => n === lower || n.includes(lower) || lower.includes(n),
      );
      if (!known) {
        guard.removedTitles.push(title);
        out = out.replace(title, "[title removed: not in Qloo evidence]");
      }
    }
    return out;
  };

  const sessions: ProgramSession[] = draft.sessions.map((s) => {
    let entity: ProgramSession["entity"] = null;
    if (s.entityRef) {
      const e = byRef.get(s.entityRef);
      if (e)
        entity = { id: e.entityId, name: e.name, domain: e.domain, evidenceIds: e.evidenceIds };
      else guard.removedEntityRefs.push(s.entityRef);
    }
    let theme: ProgramSession["theme"] = null;
    if (s.themeRef) {
      const t = themes.get(s.themeRef);
      if (t) theme = { name: t.name, evidenceId: t.evidenceId };
      else guard.removedThemeRefs.push(s.themeRef);
    }
    return {
      ...s,
      entityRef: entity ? s.entityRef : null,
      entity,
      theme,
      title: clean(s.title),
      activity: clean(s.activity),
      roles: { A: clean(s.roles.A), B: clean(s.roles.B) },
    };
  });

  const evidenceIds = draft.evidenceIds.filter((id) => {
    if (evidence.has(id)) return true;
    guard.removedEvidenceIds.push(id);
    return false;
  });
  for (const s of sessions) {
    for (const id of [...(s.entity?.evidenceIds ?? []), ...(s.theme ? [s.theme.evidenceId] : [])]) {
      if (!evidenceIds.includes(id)) evidenceIds.push(id);
    }
  }

  const anchored = sessions.filter((s) => s.entity).length;
  if (anchored < 2) guard.warnings.push(`Only ${anchored} session(s) anchored to a Qloo entity`);
  if (!byRef.has(draft.bridgeRef)) guard.warnings.push(`Unknown main bridge ${draft.bridgeRef}`);
  else if (!sessions.some((s) => s.entityRef === draft.bridgeRef)) {
    guard.warnings.push(`Main bridge ${draft.bridgeRef} does not anchor any session`);
  }

  return {
    ...draft,
    title: clean(draft.title),
    objective: clean(draft.objective),
    format: clean(draft.format),
    sessions,
    evidenceIds,
    guard,
  };
}

export async function generateProgram(
  llm: LlmClient,
  brief: EvidenceBrief,
  bridgeRef = "B1",
): Promise<Program> {
  const { data } = await generateStructured(llm, {
    label: "program",
    schema: ProgramDraftSchema,
    system: PROGRAM_SYSTEM,
    prompt: programPrompt(brief, bridgeRef),
  });
  return guardProgram(data, brief);
}
