import { describe, expect, it } from "vitest";
import { buildBrief, knownEvidenceIds, programEntities } from "@/lib/agent/brief";
import { writeBridgeNotes } from "@/lib/agent/notes";
import { RESULT, SCENARIO } from "./fixtures";
import { scriptedLlm } from "./helpers";

describe("buildBrief", () => {
  const brief = buildBrief(SCENARIO, RESULT);

  it("gives bridges, runners-up, the obvious pick and themes short refs", () => {
    expect(brief.entities.map((e) => `${e.ref}:${e.name}`)).toEqual([
      "B1:Shared Comedy",
      "B2:Corner Café",
      "B3:Jazz Fusion Duo",
      "R1:Quiet Novel",
      "O1:Famous Drama",
    ]);
    expect(brief.themes[0]).toMatchObject({ ref: "T1", name: "Personal growth" });
    expect(brief.entities[0]).toMatchObject({ supportA: 80, supportB: 70, supportedByA: ["SA1"] });
  });

  it("lets programs use bridges and runners-up but not the obvious pick", () => {
    const allowed = programEntities(brief);
    expect(allowed.has("E_BOOK")).toBe(true);
    expect(allowed.has("E_FAMOUS")).toBe(false);
    expect(knownEvidenceIds(brief).has("ev_theme_1")).toBe(true);
  });
});

describe("writeBridgeNotes", () => {
  it("keeps notes for known bridges and repairs invalid citations", async () => {
    const note = (ref: string, evidenceIds: string[]) => ({
      ref,
      activityFit: "Watch-and-remix club",
      mainFriction: "Evening timing",
      whyBeatsObvious: "Both sides rank it highly while it is far less mainstream",
      evidenceIds,
    });
    const { llm, requests } = scriptedLlm(
      JSON.stringify({
        notes: [
          note("B1", ["ev_E_SHOW_a", "ev_made_up"]),
          note("B2", ["ev_made_up"]),
          note("B9", ["ev_E_SHOW_a"]),
        ],
      }),
    );
    const notes = await writeBridgeNotes(llm, buildBrief(SCENARIO, RESULT));

    expect(notes.map((n) => n.ref)).toEqual(["B1", "B2"]);
    expect(notes[0].evidenceIds).toEqual(["ev_E_SHOW_a"]);
    expect(notes[1].evidenceIds).toEqual(["ev_E_CAFE_ab", "ev_E_CAFE_a", "ev_E_CAFE_b"]);
    expect(notes.every((n) => n.kind === "interpretation")).toBe(true);
    expect(requests[0].prompt).toContain("Shared Comedy");
  });
});
