import { describe, expect, it } from "vitest";
import { generateBaseline } from "@/lib/agent/baseline";
import { SCENARIO } from "./fixtures";
import { scriptedLlm } from "./helpers";

describe("generateBaseline", () => {
  it("gets the same objective and seed names but no Qloo evidence", async () => {
    const { llm, requests } = scriptedLlm(
      JSON.stringify({
        title: "Film & Music Exchange",
        bridge: "A shared love of film soundtracks",
        format: "Monthly",
        sessions: [1, 2, 3].map((n) => ({
          number: n,
          title: `S${n}`,
          anchor: n === 1 ? "Some Famous Film" : null,
          activity: "Watch and discuss",
          roles: { A: "Discuss", B: "Discuss" },
        })),
        venueType: "Library",
        successMeasures: ["Attendance"],
      }),
    );
    const b = await generateBaseline(llm, SCENARIO);

    expect(b.kind).toBe("llm_only");
    expect(b.sessions[0].anchor).toBe("Some Famous Film");
    const prompt = requests[0].prompt;
    expect(prompt).toContain("A four-session campus and city program");
    expect(prompt).toContain("SA1");
    expect(prompt).not.toMatch(/evidence|ev_|percentile/i);
  });
});
