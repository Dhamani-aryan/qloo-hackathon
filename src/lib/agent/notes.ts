import { z } from "zod";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmClient } from "@/lib/llm/types";
import { briefForPrompt, knownEvidenceIds, type EvidenceBrief } from "./brief";

/**
 * Interpretation notes for each selected bridge: how it becomes a shared activity, its main
 * friction, and why it beats the obvious bridge. These are labelled as interpretation in the
 * UI; they must cite evidence IDs from the brief.
 */

export const BridgeNotesSchema = z.object({
  notes: z.array(
    z.object({
      ref: z.string().regex(/^B\d+$/),
      activityFit: z.string().min(1).max(300),
      mainFriction: z.string().min(1).max(240),
      whyBeatsObvious: z.string().min(1).max(300),
      evidenceIds: z.array(z.string()).min(1),
    }),
  ),
});

export type BridgeNote = z.infer<typeof BridgeNotesSchema>["notes"][number] & {
  kind: "interpretation";
};

export const NOTES_SYSTEM =
  "You are a cultural-program designer's analyst. For each bridge (refs B1, B2, ...) in the " +
  "evidence brief, write short notes: activityFit (a concrete shared activity both communities " +
  "would co-create, not passive attendance), mainFriction (cost, access, timing, intimidation, " +
  "language, or one group leading the other), whyBeatsObvious (compare with the obvious bridge " +
  "O1 using the support and popularity numbers). Use ONLY facts in the brief; do not name any " +
  "work, artist, or place that is not in it. Cite the evidence IDs you relied on. Never infer " +
  "identity, religion, ethnicity, politics or other sensitive traits.";

export async function writeBridgeNotes(
  llm: LlmClient,
  brief: EvidenceBrief,
): Promise<BridgeNote[]> {
  const bridges = brief.entities.filter((e) => e.role === "bridge");
  if (bridges.length === 0) return [];
  const { data } = await generateStructured(llm, {
    label: "bridge-notes",
    schema: BridgeNotesSchema,
    system: NOTES_SYSTEM,
    prompt: `Evidence brief:\n${briefForPrompt(brief)}\n\nWrite one note per bridge: ${bridges
      .map((b) => b.ref)
      .join(", ")}.`,
  });

  const known = knownEvidenceIds(brief);
  const byRef = new Map(bridges.map((b) => [b.ref, b]));
  return data.notes.flatMap((n) => {
    const bridge = byRef.get(n.ref);
    if (!bridge) return [];
    const cited = n.evidenceIds.filter((id) => known.has(id));
    // A note whose citations are all invalid still concerns its bridge; cite the bridge's own evidence.
    return [
      { ...n, evidenceIds: cited.length ? cited : bridge.evidenceIds, kind: "interpretation" },
    ];
  });
}
