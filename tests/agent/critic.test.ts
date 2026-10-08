import { describe, expect, it } from "vitest";
import { buildBrief } from "@/lib/agent/brief";
import { critiqueProgram } from "@/lib/agent/critic";
import { guardProgram, type ProgramDraft } from "@/lib/agent/program";
import { RESULT, SCENARIO } from "./fixtures";
import { scriptedLlm } from "./helpers";

const brief = buildBrief(SCENARIO, RESULT);

const draft: ProgramDraft = {
  title: "Shared Screen Nights",
  objective: "Four evenings of shared watching and making",
  bridgeRef: "B1",
  format: "Monthly",
  sessions: [1, 2, 3, 4].map((n) => ({
    number: n,
    title: `Session ${n}`,
    entityRef: n === 1 ? "B1" : n === 2 ? "B2" : null,
    themeRef: null,
    activity: "Watch together",
    roles: { A: "Attend", B: "Attend" },
  })),
  venueType: "Community room",
  partnerTypes: [],
  accessibility: [],
  frictionMitigations: [],
  successMeasures: ["Return attendance"],
  limitations: [],
  evidenceIds: [],
};

describe("critiqueProgram", () => {
  it("returns issues and a guarded revision", async () => {
    const revisedDraft = {
      ...draft,
      sessions: draft.sessions.map((s) => ({
        ...s,
        activity: s.number === 4 ? 'Co-create a piece inspired by "Invented Classic"' : "Co-create",
        roles: { A: "Scores the scene", B: "Writes the scene" },
      })),
    };
    const { llm, requests } = scriptedLlm(
      JSON.stringify({
        issues: [
          { check: "generic_roles", problem: "Roles are identical", fix: "Distinct roles" },
          { check: "passive_audience", problem: "Watching only", fix: "Make something" },
        ],
        revised: revisedDraft,
      }),
    );
    const c = await critiqueProgram(llm, brief, guardProgram(draft, brief));

    expect(c.issues.map((i) => i.check)).toEqual(["generic_roles", "passive_audience"]);
    expect(c.revised.sessions[0].roles).toEqual({ A: "Scores the scene", B: "Writes the scene" });
    expect(c.revised.sessions[0].entity?.name).toBe("Shared Comedy");
    // The revision is guarded too.
    expect(c.revised.guard.removedTitles).toEqual(["Invented Classic"]);
    // The critic sees refs, not resolved entities.
    expect(requests[0].prompt).toContain('"entityRef": "B1"');
    expect(requests[0].prompt).not.toContain('"entity":');
  });
});
