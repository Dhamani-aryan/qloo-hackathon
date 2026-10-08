import { describe, expect, it } from "vitest";
import { buildBrief } from "@/lib/agent/brief";
import { generateProgram, guardProgram, type ProgramDraft } from "@/lib/agent/program";
import { RESULT, SCENARIO } from "./fixtures";
import { scriptedLlm } from "./helpers";

const brief = buildBrief(SCENARIO, RESULT);

function draft(overrides: Partial<ProgramDraft> = {}): ProgramDraft {
  const session = (number: number, entityRef: string | null, activity = "Co-create a zine") => ({
    number,
    title: `Session ${number}`,
    entityRef,
    themeRef: number === 1 ? "T1" : null,
    activity,
    roles: { A: "Co-host the discussion", B: "Co-host the discussion" },
  });
  return {
    title: "Shared Screen Nights",
    objective: "Four evenings of shared watching and making",
    bridgeRef: "B1",
    format: "Monthly evening sessions",
    sessions: [session(1, "B1"), session(2, "B2"), session(3, "R1"), session(4, null)],
    venueType: "Community room",
    partnerTypes: ["Campus film club"],
    accessibility: ["Free entry"],
    frictionMitigations: ["Mixed-group seating"],
    successMeasures: ["Return attendance"],
    limitations: ["Profiles are aggregate signals"],
    evidenceIds: ["ev_E_SHOW_a"],
    ...overrides,
  };
}

describe("guardProgram", () => {
  it("resolves refs to real Qloo entities and collects their evidence", () => {
    const p = guardProgram(draft(), brief);
    expect(p.sessions.map((s) => s.entity?.name ?? null)).toEqual([
      "Shared Comedy",
      "Corner Café",
      "Quiet Novel",
      null,
    ]);
    expect(p.sessions[0].theme?.name).toBe("Personal growth");
    expect(p.evidenceIds).toEqual(
      expect.arrayContaining(["ev_E_SHOW_a", "ev_E_CAFE_ab", "ev_E_BOOK_b", "ev_theme_1"]),
    );
    expect(p.guard).toMatchObject({ removedEntityRefs: [], removedTitles: [], warnings: [] });
  });

  it("removes invented entities, the obvious pick, unknown citations and unknown titles", () => {
    const d = draft();
    d.sessions[1].entityRef = "B9";
    d.sessions[2].entityRef = "O1"; // the obvious contrast is not allowed in programs
    d.sessions[3].activity = 'Close with a screening of "Totally Invented Film" and a Q&A';
    d.evidenceIds = ["ev_E_SHOW_a", "ev_fake"];
    const p = guardProgram(d, brief);

    expect(p.guard.removedEntityRefs).toEqual(["B9", "O1"]);
    expect(p.sessions[1].entity).toBeNull();
    expect(p.guard.removedEvidenceIds).toEqual(["ev_fake"]);
    expect(p.guard.removedTitles).toEqual(["Totally Invented Film"]);
    expect(p.sessions[3].activity).toContain("[title removed: not in Qloo evidence]");
    expect(p.guard.warnings).toEqual(["Only 1 session(s) anchored to a Qloo entity"]);
  });

  it("keeps quoted titles that are in the brief", () => {
    const d = draft();
    d.sessions[0].activity = 'Watch "Shared Comedy" together, then pair up';
    expect(guardProgram(d, brief).guard.removedTitles).toEqual([]);
  });

  it("warns when the main bridge anchors no session", () => {
    const d = draft();
    d.sessions[0].entityRef = "B3";
    expect(guardProgram(d, brief).guard.warnings).toContain(
      "Main bridge B1 does not anchor any session",
    );
  });
});

describe("generateProgram", () => {
  it("asks for a program on the chosen bridge and guards the result", async () => {
    const { llm, requests } = scriptedLlm(JSON.stringify(draft({ bridgeRef: "B2" })));
    const p = await generateProgram(llm, brief, "B2");
    expect(requests[0].prompt).toContain("built on bridge B2");
    expect(requests[0].system).toMatch(/Never invent/);
    expect(p.bridgeRef).toBe("B2");
  });
});
