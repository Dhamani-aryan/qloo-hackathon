import { describe, expect, it } from "vitest";
import { createContext } from "@/lib/engine/context";
import { assessLift } from "@/lib/engine/lift";
import { harmonicMean, percentiles } from "@/lib/engine/normalize";
import { bilateralFailure, scoreSides } from "@/lib/engine/validate";
import type { Candidate } from "@/lib/engine/types";
import { entity, fakeClient, scenario } from "./helpers";

describe("percentiles", () => {
  it("ranks within the pool and shares ranks on ties", () => {
    const p = percentiles(
      new Map([
        ["a", 0.8],
        ["b", 0.9],
        ["c", 0.9],
        ["d", 0.95],
      ]),
    );
    expect(Object.fromEntries(p)).toEqual({ a: 0, b: 1 / 3, c: 1 / 3, d: 1 });
    expect(percentiles(new Map([["solo", 0.5]])).get("solo")).toBe(1);
    expect(percentiles(new Map()).size).toBe(0);
  });

  it("harmonic mean punishes one-sided support", () => {
    expect(harmonicMean(0.9, 0.9)).toBeCloseTo(0.9);
    expect(harmonicMean(1, 0.1)).toBeLessThan(0.2);
    expect(harmonicMean(0, 0)).toBe(0);
  });
});

describe("bilateralFailure", () => {
  it("passes two-sided candidates and explains failures", () => {
    expect(bilateralFailure(0.7, 0.5)).toBeNull();
    expect(bilateralFailure(0.9, 0.22)).toMatch(/community B.*22th percentile/);
    expect(bilateralFailure(null, 0.9)).toMatch(/community A/);
    expect(bilateralFailure(null, null)).toMatch(/either/);
  });
});

describe("assessLift", () => {
  it("does not let a popular item win as a discovered bridge", () => {
    const famous = assessLift(0.95, 0.95, 0.99);
    const niche = assessLift(0.7, 0.7, 0.6);
    expect(famous.verdict).toBe("obvious");
    expect(niche.verdict).toBe("discovered");
    expect(niche.bilateralLift).toBeGreaterThan(famous.bilateralLift);
  });

  it("rejects one-sided and too-niche candidates", () => {
    expect(assessLift(0.9, 0.1, 0.5)).toMatchObject({ verdict: "rejected" });
    expect(assessLift(0.8, 0.8, 0.1).reason).toMatch(/niche/);
  });

  it("treats unknown popularity as mid-band", () => {
    expect(assessLift(0.8, 0.8, null).verdict).toBe("discovered");
  });
});

describe("scoreSides", () => {
  it("scores the pool against each side separately and records percentile evidence", async () => {
    const { client, calls } = fakeClient((input) => {
      const high = input.signalEntities?.includes("SA1") ? "C1" : "C2";
      return (input.resultEntities ?? []).map((id) =>
        entity(id, id, { affinity: id === high ? 0.95 : 0.85 }),
      );
    });
    const ctx = createContext(client, scenario());
    const candidates: Candidate[] = ["C1", "C2"].map((id) => ({
      entity: entity(id, id),
      domain: "tvShow",
      admittedBy: ["combined-top"],
      supportingSeeds: { A: [], B: [] },
      evidenceIds: [],
    }));
    const s = await scoreSides(ctx, "tvShow", candidates);

    expect(calls.map((c) => c.signalEntities)).toEqual([
      ["SA1", "SA2"],
      ["SB1", "SB2"],
    ]);
    expect(calls[0].resultEntities).toEqual(["C1", "C2"]);
    expect(s.pct.A.get("C1")).toBe(1);
    expect(s.pct.B.get("C1")).toBe(0);
    expect(candidates[0].evidenceIds).toHaveLength(2);
    expect(ctx.ledger.get(candidates[0].evidenceIds[0])).toMatchObject({
      profile: "A",
      kind: "rank-based",
      normalizedScore: 1,
    });
  });

  it("makes no calls for an empty pool", async () => {
    const { client, calls } = fakeClient(() => []);
    await scoreSides(createContext(client, scenario()), "book", []);
    expect(calls).toHaveLength(0);
  });
});
