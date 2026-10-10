import { describe, expect, it } from "vitest";
import {
  draftFromPrebuilt,
  draftReducer,
  emptyDraft,
  newSeed,
  readiness,
  toScenario,
  type Draft,
} from "@/components/studio/draft";
import { ScenarioSchema } from "@/lib/engine/types";
import { PREBUILT } from "@/scenarios";

const match = (id: string) => ({
  id,
  name: id,
  type: "urn:entity:artist",
  disambiguation: null,
  imageUrl: null,
  popularity: 0.5,
  description: null,
});

function withSeeds(draft: Draft, side: "a" | "b", n: number, confirmed = true): Draft {
  let d = draft;
  for (let i = 0; i < n; i++) {
    const seed = {
      ...newSeed(`${side}${i}`),
      status: "resolved" as const,
      matches: [match(`${side}${i}`)],
      chosenId: `${side}${i}`,
      confirmed,
    };
    d = draftReducer(d, { type: "addSeed", side, seed });
  }
  return d;
}

describe("draft model", () => {
  it("loads prebuilt scenarios with every seed waiting for resolution", () => {
    const d = draftFromPrebuilt(PREBUILT[0]);
    expect(d.location).toBe("New York City");
    expect(d.a.seeds.every((s) => s.status === "resolving")).toBe(true);
    expect(d.a.seeds[0].type).toBe("artist");
  });

  it("blocks running until both sides have three confirmed seeds and a location", () => {
    let d = { ...emptyDraft(), location: "" };
    expect(readiness(d)).toHaveLength(3);
    d = withSeeds(withSeeds(d, "a", 3), "b", 2);
    d = draftReducer(d, { type: "set", patch: { location: "Test City" } });
    expect(readiness(d)).toEqual(["Add 1 more favourite for Group 2."]);
    d = withSeeds(d, "b", 1);
    expect(readiness(d)).toEqual([]);
  });

  it("converts to a valid engine scenario using confirmed seeds only", () => {
    let d = withSeeds(withSeeds({ ...emptyDraft(), location: "Test City" }, "a", 3), "b", 3);
    d = withSeeds(d, "a", 1, false);
    const s = toScenario(d);
    expect(ScenarioSchema.safeParse(s).success).toBe(true);
    expect(s.a.seeds).toHaveLength(3);
    expect(s.a.seeds[0]).toMatchObject({ entityId: "a0", confirmed: true, weight: 1 });
  });

  it("updates and removes seeds by key", () => {
    const d = withSeeds(emptyDraft(), "a", 2);
    const key = d.a.seeds[0].key;
    const updated = draftReducer(d, {
      type: "updateSeed",
      side: "a",
      key,
      patch: { confirmed: false },
    });
    expect(updated.a.seeds[0].confirmed).toBe(false);
    expect(draftReducer(updated, { type: "removeSeed", side: "a", key }).a.seeds).toHaveLength(1);
  });
});
