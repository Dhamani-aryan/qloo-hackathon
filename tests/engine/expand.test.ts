import { describe, expect, it } from "vitest";
import { CallBudget, createContext, createLimiter } from "@/lib/engine/context";
import { POPULARITY_CAP, expandDomain } from "@/lib/engine/expand";
import { entity, fakeClient, scenario } from "./helpers";

describe("expandDomain", () => {
  it("runs a combined-top and a popularity-capped query and records evidence", async () => {
    const { client, calls } = fakeClient((input) =>
      input.popularityMax
        ? [entity("C2", "Capped pick", { popularity: 0.6 })]
        : [
            entity("C1", "Top pick", {
              popularity: 0.97,
              explainability: { SA2: 0.06, SA1: 0.08, SB2: 0.09, SB1: 0.01, OTHER: 0.5 },
            }),
          ],
    );
    const ctx = createContext(client, scenario());
    const x = await expandDomain(ctx, "tvShow");

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      filterType: "urn:entity:tv_show",
      signalEntities: ["SA1", "SA2", "SB1", "SB2"],
      excludeEntities: ["SA1", "SA2", "SB1", "SB2"],
      explainability: true,
    });
    expect(calls[1].popularityMax).toBe(POPULARITY_CAP);
    expect(calls[0].filterLocationQuery).toBeUndefined();

    expect(x.results["combined-top"].map((e) => e.id)).toEqual(["C1"]);
    expect(x.results["popularity-capped"].map((e) => e.id)).toEqual(["C2"]);
    // Only known seeds above the threshold count as support, strongest first.
    expect(x.supportingSeeds.get("C1")).toEqual({ A: ["SA1", "SA2"], B: ["SB2"] });
    expect(ctx.ledger.forCandidate("C1")[0]).toMatchObject({
      profile: "AB",
      purpose: "combined-top",
    });
    expect(ctx.ledger.forCandidate("C2")[0].limitations[0]).toMatch(/popularity/);
  });

  it("scopes places to the scenario location and marks them location-conditioned", async () => {
    const { client, calls } = fakeClient(() => [entity("P1", "Cafe")]);
    const ctx = createContext(client, scenario());
    await expandDomain(ctx, "place");
    expect(calls[0].filterLocationQuery).toBe("Test City");
    expect(ctx.ledger.forCandidate("P1")[0].kind).toBe("location-conditioned");
  });

  it("skips places with a warning when there is no location", async () => {
    const { client, calls } = fakeClient(() => []);
    const ctx = createContext(client, scenario({ location: null }));
    const x = await expandDomain(ctx, "place");
    expect(calls).toHaveLength(0);
    expect(x.error).toBe("no_location");
    expect(ctx.warnings[0]).toMatch(/no location/);
  });

  it("keeps going when one query fails", async () => {
    const { client } = fakeClient((input) => {
      if (input.popularityMax) throw new Error("boom");
      return [entity("C1", "Top")];
    });
    const ctx = createContext(client, scenario());
    const x = await expandDomain(ctx, "artist");
    expect(x.results["combined-top"]).toHaveLength(1);
    expect(ctx.warnings.some((w) => w.includes("boom"))).toBe(true);
  });
});

describe("CallBudget and limiter", () => {
  it("throws once the budget is spent", () => {
    const b = new CallBudget(1);
    b.spend();
    expect(() => b.spend()).toThrow(/budget/);
  });

  it("never runs more than the concurrency limit", async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        run(async () => {
          peak = Math.max(peak, ++active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
