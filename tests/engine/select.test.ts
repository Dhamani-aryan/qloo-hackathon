import { describe, expect, it } from "vitest";
import { evidenceDiversity, scoreCandidate } from "@/lib/engine/score";
import { selectBridges } from "@/lib/engine/select";
import type { Candidate, DomainKey, ScoredCandidate } from "@/lib/engine/types";
import type { SideScores } from "@/lib/engine/validate";
import { entity } from "./helpers";

function candidate(
  id: string,
  domain: DomainKey,
  popularity: number,
  extra: Partial<Candidate> = {},
) {
  return {
    entity: entity(id, id, { popularity }),
    domain,
    admittedBy: ["combined-top"],
    supportingSeeds: { A: [], B: [] },
    evidenceIds: [],
    ...extra,
  } as Candidate;
}

function scores(pcts: Record<string, [number, number]>): SideScores {
  const m = (i: 0 | 1) => new Map(Object.entries(pcts).map(([id, v]) => [id, v[i]]));
  return { affinity: { A: m(0), B: m(1) }, pct: { A: m(0), B: m(1) } };
}

describe("scoreCandidate", () => {
  it("combines lift, evidence diversity and local availability into 0–100", () => {
    const c = candidate("P1", "place", 0.65, {
      admittedBy: ["combined-top", "popularity-capped"],
      supportingSeeds: { A: ["SA1"], B: ["SB1"] },
    });
    const s = scoreCandidate(c, scores({ P1: [0.9, 0.9] }));
    expect(s.verdict).toBe("discovered");
    expect(s.localAvailability).toBe(1);
    expect(s.evidenceDiversity).toBe(0.75);
    expect(s.bridgePotential).toBeGreaterThan(50);
    expect(s.bridgePotential).toBeLessThanOrEqual(100);
  });

  it("counts a shared-theme tag as extra evidence", () => {
    const c = candidate("B1", "book", 0.6);
    c.entity.tags = [{ id: "t:growth", name: "Growth", type: null }];
    expect(evidenceDiversity(c, new Set(["t:growth"]))).toBe(0.5);
    expect(evidenceDiversity(c, new Set())).toBe(0.25);
  });
});

describe("selectBridges", () => {
  const pick = (id: string, domain: DomainKey, pop: number, pA: number, pB: number) =>
    scoreCandidate(candidate(id, domain, pop), scores({ [id]: [pA, pB] }));

  it("prefers one bridge per domain, then fills with the next best", () => {
    const all: ScoredCandidate[] = [
      pick("tv1", "tvShow", 0.5, 0.9, 0.9),
      pick("tv2", "tvShow", 0.5, 0.85, 0.85),
      pick("art1", "artist", 0.6, 0.7, 0.7),
      pick("famous", "movie", 0.99, 1, 1),
    ];
    const s = selectBridges(all);
    expect(s.status).toBe("ok");
    expect(s.bridges.map((b) => b.entity.id)).toEqual(["tv1", "tv2", "art1"]);
    expect(s.obvious?.entity.id).toBe("famous");
    expect(s.runnersUp).toEqual([]);
  });

  it("returns insufficient evidence when nothing is discovered", () => {
    const s = selectBridges([pick("one-sided", "book", 0.5, 0.9, 0.1)]);
    expect(s.status).toBe("insufficient_evidence");
    expect(s.bridges).toEqual([]);
    expect(s.obvious).toBeNull();
  });
});
