import { describe, expect, it } from "vitest";
import { buildPool, MAX_POOL } from "@/lib/engine/candidates";
import { createContext } from "@/lib/engine/context";
import type { DomainExpansion } from "@/lib/engine/expand";
import { rejectionReason, sensitiveReason, venueReason } from "@/lib/engine/filters";
import { findThemes } from "@/lib/engine/themes";
import type { CompareTag } from "@/lib/qloo";
import { entity, fakeClient, scenario } from "./helpers";

function expansion(
  top: ReturnType<typeof entity>[],
  capped: ReturnType<typeof entity>[] = [],
): DomainExpansion {
  return {
    domain: "book",
    results: { "combined-top": top, "popularity-capped": capped },
    evidenceIds: new Map([["X1", ["ev_0001"]]]),
    supportingSeeds: new Map([["X1", { A: ["SA1"], B: [] }]]),
    locationConditioned: false,
    error: null,
  };
}

describe("filters", () => {
  it("rejects religious and political titles or tags", () => {
    expect(sensitiveReason(entity("1", "Why I Am a Believer of Religion"))).toMatch(/Sensitive/);
    expect(
      sensitiveReason(
        entity("2", "Neutral title", {
          tags: [{ id: "urn:tag:genre:media:politics", name: null, type: null }],
        }),
      ),
    ).toMatch(/polit/);
    expect(sensitiveReason(entity("3", "M Train"))).toBeNull();
  });

  it("rejects hotels and banquet halls only for places", () => {
    const hotel = entity("4", "Grand Palace Banquets");
    expect(venueReason(hotel)).toMatch(/banquet/);
    expect(rejectionReason(hotel, "place")).toMatch(/Unsuitable/);
    expect(rejectionReason(hotel, "book")).toBeNull();
    expect(venueReason(entity("5", "Community Arts Café"))).toBeNull();
  });

  it("uses category tags but ignores incidental amenity and theme tags", () => {
    const concertHall = entity("6", "Jazz Venue", {
      tags: [
        { id: "urn:tag:category:place:concert_hall", name: "Concert hall", type: null },
        {
          id: "urn:tag:accessibility:place:wheelchair_accessible_parking_lot",
          name: "Wheelchair accessible parking lot",
          type: null,
        },
        { id: "urn:tag:nearby_attraction:qloo:grand_hotel", name: "Grand hotel", type: null },
      ],
    });
    const singer = entity("7", "A Singer", {
      tags: [{ id: "urn:tag:theme:qloo:spirituality", name: "Spirituality", type: null }],
    });
    const hotel = entity("8", "Palace Stay", {
      tags: [{ id: "urn:tag:category:place:hotel", name: "Hotel", type: null }],
    });
    expect(rejectionReason(concertHall, "place")).toBeNull();
    expect(rejectionReason(singer, "artist")).toBeNull();
    expect(rejectionReason(hotel, "place")).toMatch(/hotel/);
    expect(rejectionReason(entity("9", "The Church of St. Example"), "place")).toMatch(/church/);
  });
});

describe("filters added after the evaluation", () => {
  it("rejects alcohol-centred venues and government buildings", () => {
    expect(
      rejectionReason(entity("w1", "IZUMI Brewery (Ontario Spring Water Sake Company)"), "place"),
    ).toMatch(/brewery/);
    expect(rejectionReason(entity("w2", "Palace of Westminster"), "place")).toMatch(/Unsuitable/);
    expect(
      rejectionReason(
        entity("w3", "Night Owl", {
          tags: [{ id: "urn:tag:category:place:night_club", name: "Night club", type: null }],
        }),
        "place",
      ),
    ).toMatch(/night club/);
    expect(rejectionReason(entity("w4", "Barbican Centre"), "place")).toBeNull();
  });

  it("rejects bundles but keeps single works", () => {
    expect(
      rejectionReason(
        entity("b1", "Alice Oseman Collection 6 Books Set (Solitaire, Loveless)"),
        "book",
      ),
    ).toMatch(/bundle/);
    expect(rejectionReason(entity("b2", "The Lord of the Rings Box Set"), "book")).toMatch(
      /bundle/,
    );
    expect(rejectionReason(entity("b3", "Heartstopper"), "book")).toBeNull();
  });

  it("rejects places that share the city's name", () => {
    expect(rejectionReason(entity("c1", "Chicago"), "place", "Chicago")).toMatch(/city/);
    expect(rejectionReason(entity("c2", "New York"), "place", "New York City")).toMatch(/city/);
    expect(rejectionReason(entity("c3", "Chicago Diner"), "place", "Chicago")).toBeNull();
    expect(rejectionReason(entity("c4", "Chicago"), "movie", "Chicago")).toBeNull();
  });
});

describe("buildPool", () => {
  it("dedupes across rules, keeps provenance and rejects filtered items", () => {
    const { client } = fakeClient(() => []);
    const ctx = createContext(client, scenario());
    const { candidates, rejections } = buildPool(
      ctx,
      expansion(
        [entity("X1", "Shared Pick"), entity("X2", "Politics Today")],
        [entity("X1", "Shared Pick"), entity("X3", "Quiet Pick")],
      ),
    );
    expect(candidates.map((c) => c.entity.id)).toEqual(["X1", "X3"]);
    expect(candidates[0].admittedBy).toEqual(["combined-top", "popularity-capped"]);
    expect(candidates[0].supportingSeeds).toEqual({ A: ["SA1"], B: [] });
    expect(candidates[0].evidenceIds).toEqual(["ev_0001"]);
    expect(rejections).toEqual([
      expect.objectContaining({ candidateId: "X2", reason: expect.stringMatching(/Sensitive/) }),
    ]);
  });

  it("caps the pool at the shortlist limit", () => {
    const { client } = fakeClient(() => []);
    const many = Array.from({ length: MAX_POOL + 10 }, (_, i) => entity(`E${i}`, `Pick ${i}`));
    const { candidates } = buildPool(createContext(client, scenario()), expansion(many));
    expect(candidates).toHaveLength(MAX_POOL);
  });
});

describe("findThemes", () => {
  const tag = (
    id: string,
    name: string,
    subtype: string,
    a: string[],
    b: string[],
  ): CompareTag => ({
    id,
    name,
    subtype,
    popularity: 0.9,
    score: 0.7,
    count: null,
    aEntityIds: a,
    bEntityIds: b,
  });

  it("keeps two-sided theme tags, drops genres, duplicates and sensitive tags", async () => {
    const { client } = fakeClient(() => [], {
      sharedTags: [
        tag("t:soul", "Soul", "urn:tag:genre:music", ["SA1"], ["SB1"]),
        tag("t:growth", "Personal growth", "urn:tag:theme:qloo", ["SA1"], ["SB2"]),
        tag("t:growth-kw", "Personal Growth", "urn:tag:keyword:qloo", ["SA2"], ["SB2"]),
        tag("t:faith", "Religion", "urn:tag:theme:qloo", ["SA1"], ["SB1"]),
        tag("t:solo", "Solitude", "urn:tag:theme:qloo", ["SA1"], []),
      ],
    });
    const ctx = createContext(client, scenario());
    const themes = await findThemes(ctx);
    expect(themes.map((t) => t.name)).toEqual(["Personal growth"]);
    expect(themes[0].supportingSeeds).toEqual({ A: ["SA1"], B: ["SB2"] });
    expect(ctx.ledger.get(themes[0].evidenceId)?.kind).toBe("tag-based");
  });
});
