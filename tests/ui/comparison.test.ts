import { describe, expect, it } from "vitest";
import type { BaselineProgram } from "@/lib/agent/baseline";
import { guardProgram, type ProgramDraft } from "@/lib/agent/program";
import { buildBrief } from "@/lib/agent/brief";
import { compareStats, splitAnchor } from "@/components/studio/comparison";
import { programMarkdown } from "@/components/studio/program-screen";
import { RESULT, SCENARIO } from "../agent/fixtures";

const brief = buildBrief(SCENARIO, RESULT);
const draft: ProgramDraft = {
  title: "Shared Nights",
  objective: "Recurring making",
  bridgeRef: "B1",
  format: "Monthly",
  sessions: [
    {
      number: 1,
      title: "One",
      entityRef: "B1",
      themeRef: "T1",
      activity: "Co-create",
      roles: { A: "Scores", B: "Writes" },
    },
    {
      number: 2,
      title: "Two",
      entityRef: "B2",
      themeRef: null,
      activity: "Walk",
      roles: { A: "Films", B: "Narrates" },
    },
    {
      number: 3,
      title: "Three",
      entityRef: null,
      themeRef: null,
      activity: "Showcase",
      roles: { A: "Edits", B: "Hosts" },
    },
  ],
  venueType: "Community room",
  partnerTypes: ["Library"],
  accessibility: ["Free"],
  frictionMitigations: [],
  successMeasures: ["Return attendance"],
  limitations: [],
  evidenceIds: [],
};
const program = guardProgram(draft, brief);

const baseline: BaselineProgram = {
  kind: "llm_only",
  title: "Generic",
  bridge: "Film",
  format: "Monthly",
  sessions: [
    {
      number: 1,
      title: "A",
      anchor: "SA1, SB1 and Made Up Film",
      anchors: ["SA1", "SB1", "Made Up Film"],
      activity: "x",
      roles: { A: "x", B: "x" },
    },
    { number: 2, title: "B", anchor: null, activity: "x", roles: { A: "x", B: "x" } },
  ],
  venueType: "Library",
  successMeasures: [],
};

describe("splitAnchor", () => {
  it("uses semicolons for legacy lists and preserves punctuation inside titles", () => {
    expect(splitAnchor("Lady Bird; Cinema Paradiso; Just Kids")).toEqual([
      "Lady Bird",
      "Cinema Paradiso",
      "Just Kids",
    ]);
    expect(splitAnchor("Simon & Garfunkel")).toEqual(["Simon & Garfunkel"]);
    expect(splitAnchor("Everything Everywhere All at Once")).toHaveLength(1);
    expect(splitAnchor(null)).toEqual([]);
  });
});

describe("compareStats", () => {
  it("counts Qloo-discovered anchors vs reused seeds and unverified guesses", () => {
    const s = compareStats(program, baseline, SCENARIO);
    expect(s.ours).toMatchObject({ anchored: 2, discovered: 2, sessions: 3 });
    expect(s.ours.evidence).toBeGreaterThan(0);
    expect(s.baseline).toEqual({ named: 3, reusedSeeds: 2, unverified: 1, sessions: 2 });
  });
  it("counts unique anchors and preserves punctuation in structured baseline titles", () => {
    const repeated = { ...program, sessions: [program.sessions[0], program.sessions[0]] };
    const b = {
      ...baseline,
      sessions: [{ ...baseline.sessions[0], anchors: ["Simon & Garfunkel", "Simon & Garfunkel"] }],
    };
    const stats = compareStats(repeated, b, SCENARIO);
    expect(stats.ours.discovered).toBe(1);
    expect(stats.baseline.named).toBe(1);
  });
});

describe("programMarkdown", () => {
  it("exports sessions with anchors, roles and the co-design disclaimer", () => {
    const md = programMarkdown(
      program,
      [{ check: "generic_roles", problem: "Same roles", fix: "Split" }],
      ["Club", "Assoc"],
    );
    expect(md).toContain("# Shared Nights");
    expect(md).toContain("*Qloo anchor:* Shared Comedy (tvShow)");
    expect(md).toContain("- **Club:** Scores");
    expect(md).toContain("Same roles → Split");
    expect(md).toContain("does not predict social impact");
  });

  it("lists the delivery checks still pending, so a download isn't mistaken for a booking", () => {
    const md = programMarkdown(program, [], ["Club", "Assoc"]);
    expect(md).toContain("### Before inviting people — organizer confirmation required");
    expect(md).toMatch(/- Venue, capacity & permissions: .*not been checked/);
    expect(md).toMatch(/- Media & recording: /);
  });
});
