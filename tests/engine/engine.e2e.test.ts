import { describe, expect, it } from "vitest";
import { runBridgeEngine, type EngineResult } from "@/lib/engine";
import { QlooError, type InsightsInput } from "@/lib/qloo";
import { fakeClient } from "./helpers";
import { A, B, compare, world, worldScenario as scenario } from "./world";

function summary(r: EngineResult) {
  return {
    status: r.status,
    bridges: r.bridges.map((b) => `${b.entity.name} (${b.domain}) BP ${b.bridgePotential}`),
    obvious: r.obvious?.entity.name ?? null,
    themes: r.themes.map((t) => t.name),
    rejections: r.rejections.map((x) => `${x.name}: ${x.reason}`).sort(),
    calls: r.stats.qlooCalls,
  };
}

describe("runBridgeEngine (synthetic world)", () => {
  it("finds two-sided, non-mainstream bridges and explains every rejection", async () => {
    const { client } = fakeClient(world, compare);
    const r = await runBridgeEngine(client, scenario(), {
      domains: ["tvShow", "artist", "place"],
    });
    const s = summary(r);

    expect(s.status).toBe("ok");
    expect(s.bridges.map((b) => b.split(" (")[0])).toEqual(["Jazz Fusion Duo", "Shared Comedy"]);
    expect(["Famous Drama", "Famous Square", "Global Star"]).toContain(s.obvious);
    expect(s.themes).toEqual(["Personal growth"]);
    expect(s.rejections).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Political Anthems: Sensitive topic/),
        expect.stringMatching(/^Grand Stay: Unsuitable venue for a program \(hotel\)/),
        expect.stringMatching(/^Campus Only Show: One-sided: community B/),
        expect.stringMatching(/^Tiny Cult Show: Too niche/),
        expect.stringMatching(/^Low Show: Weak support from both/),
      ]),
    );
    // 3 domains × (2 discovery + 2 shortlist) + 1 compare
    expect(s.calls).toBe(13);
    expect(s).toMatchSnapshot();
  });

  it("adds agent-chosen theme places to the place pool, first, with their own query", async () => {
    const { client, calls } = fakeClient(world, compare);
    const r = await runBridgeEngine(client, scenario(), {
      domains: ["place"],
      placeThemes: [{ tagId: "urn:tag:genre:place:jazz_club", name: "Jazz club" }],
    });
    const themed = calls.filter((c) => c.filterTags?.includes("urn:tag:genre:place:jazz_club"));
    expect(themed).toHaveLength(1);
    expect(themed[0]).toMatchObject({ explainability: true, filterLocationQuery: "Test City" });
    // 3 discovery (top, capped, theme) + 2 shortlist + 1 compare
    expect(r.stats.qlooCalls).toBe(6);
  });

  describe("when Qloo is busy while scoring one side", () => {
    const busyTvScoringForA = (failures: number) => {
      let left = failures;
      return (input: InsightsInput) => {
        const scoringA =
          input.resultEntities?.length &&
          input.filterType === "urn:entity:tv_show" &&
          input.signalEntities?.join() === A.join();
        if (scoringA && left-- > 0) throw new QlooError("rate_limited", "/v2/insights", 429);
        return world(input);
      };
    };
    const opts = { domains: ["tvShow", "artist", "place"] as const, retryDelaysMs: [0, 0] };

    it("asks again and gets the same bridges as an undisturbed run", async () => {
      const r = await runBridgeEngine(
        fakeClient(busyTvScoringForA(2), compare).client,
        scenario(),
        {
          ...opts,
          domains: [...opts.domains],
        },
      );
      expect(r.bridges.map((b) => b.entity.name)).toEqual(["Jazz Fusion Duo", "Shared Comedy"]);
      expect(r.warnings).toEqual([]);
    });

    it("leaves the domain out instead of calling it unsupported when retries run out", async () => {
      const r = await runBridgeEngine(
        fakeClient(busyTvScoringForA(9), compare).client,
        scenario(),
        {
          ...opts,
          domains: [...opts.domains],
        },
      );
      expect(r.bridges.map((b) => b.entity.name)).not.toContain("Shared Comedy");
      const tv = r.rejections.filter(
        (x) => x.domain === "tvShow" && x.reason.startsWith("Not scored"),
      );
      expect(tv.length).toBeGreaterThan(0);
      expect(r.rejections.some((x) => /No support measured/.test(x.reason))).toBe(false);
      expect(r.warnings[0]).toMatch(/tvShow scoring against A failed/);
    });
  });

  it("traces every bridge and theme to the evidence ledger", async () => {
    const { client } = fakeClient(world, compare);
    const r = await runBridgeEngine(client, scenario(), { domains: ["tvShow", "artist", "place"] });
    const ids = new Set(r.evidence.map((e) => e.evidenceId));
    for (const b of r.bridges) {
      expect(b.evidenceIds.length).toBeGreaterThanOrEqual(3);
      for (const id of b.evidenceIds) expect(ids.has(id)).toBe(true);
      const profiles = r.evidence
        .filter((e) => b.evidenceIds.includes(e.evidenceId))
        .map((e) => e.profile);
      expect(profiles).toEqual(expect.arrayContaining(["AB", "A", "B"]));
    }
    for (const t of r.themes) expect(ids.has(t.evidenceId)).toBe(true);
  });

  it("is deterministic for fixed inputs", async () => {
    const run = async () =>
      summary(
        await runBridgeEngine(fakeClient(world, compare).client, scenario(), {
          domains: ["tvShow", "artist", "place"],
        }),
      );
    expect(await run()).toEqual(await run());
  });

  it("returns insufficient evidence when no candidate is two-sided", async () => {
    const oneSided = (input: InsightsInput) =>
      world(input).map((e) =>
        input.resultEntities && input.signalEntities?.[0]?.startsWith("SB")
          ? { ...e, affinity: e.id === "T_LOW" ? 0.99 : 0.5 }
          : e,
      );
    const r = await runBridgeEngine(fakeClient(oneSided).client, scenario(), {
      domains: ["tvShow"],
    });
    expect(r.status).toBe("insufficient_evidence");
    expect(r.warnings.at(-1)).toMatch(/No candidate/);
  });

  it("refuses to run with too few confirmed seeds", async () => {
    const { client, calls } = fakeClient(world);
    const r = await runBridgeEngine(client, scenario(["SA1"], B));
    expect(r.status).toBe("insufficient_evidence");
    expect(r.warnings[0]).toMatch(/Community A has 1 confirmed seeds/);
    expect(calls).toHaveLength(0);
  });
});
