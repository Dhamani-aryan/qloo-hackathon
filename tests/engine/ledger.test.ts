import { describe, expect, it } from "vitest";
import { EvidenceLedger } from "@/lib/engine/ledger";
import { ScenarioSchema } from "@/lib/engine/types";

const base = {
  endpoint: "/v2/insights" as const,
  profile: "A" as const,
  purpose: "shortlist",
  outputType: "urn:entity:movie",
  candidateName: "Example",
  supportingSeedIds: [],
  rank: 1,
  rawScore: 0.9,
  normalizedScore: null,
  popularityBaseline: 0.5,
  locationConditioned: false,
  kind: "rank-based" as const,
  limitations: [],
};

describe("EvidenceLedger", () => {
  it("issues sequential IDs and indexes evidence by candidate", () => {
    const ledger = new EvidenceLedger();
    const one = ledger.add({ ...base, candidateId: "C1" });
    const two = ledger.add({ ...base, candidateId: "C1", profile: "B" });
    ledger.add({ ...base, candidateId: "C2" });

    expect([one, two]).toEqual(["ev_0001", "ev_0002"]);
    expect(ledger.forCandidate("C1").map((e) => e.profile)).toEqual(["A", "B"]);
    expect(ledger.get(one)?.source).toBe("qloo");
    expect(ledger.size).toBe(3);
    expect(ledger.forCandidate("missing")).toEqual([]);
  });

  it("updates stored evidence and rejects unknown IDs", () => {
    const ledger = new EvidenceLedger();
    const id = ledger.add({ ...base, candidateId: "C1" });
    ledger.update(id, { normalizedScore: 0.75 });
    expect(ledger.get(id)?.normalizedScore).toBe(0.75);
    expect(() => ledger.update("ev_9999", {})).toThrow(/Unknown evidence/);
  });
});

describe("ScenarioSchema", () => {
  const seed = { input: "x", entityId: "E1", name: "X", type: "urn:entity:movie", confirmed: true };
  const profile = (side: "A" | "B") => ({ side, label: side, source: "organizer", seeds: [seed] });

  it("fills defaults", () => {
    const s = ScenarioSchema.parse({ id: "s", title: "S", a: profile("A"), b: profile("B") });
    expect(s.location).toBeNull();
    expect(s.a.seeds[0]).toMatchObject({ weight: 1, popularity: null, imageUrl: null });
  });

  it("rejects a profile without seeds", () => {
    const bad = { id: "s", title: "S", a: { ...profile("A"), seeds: [] }, b: profile("B") };
    expect(ScenarioSchema.safeParse(bad).success).toBe(false);
  });
});
