import { describe, expect, it } from "vitest";
import { normalizeInsights, normalizeSearch, normalizeTags } from "@/lib/qloo/normalize";
import { fixture } from "./helpers";

describe("normalizeInsights", () => {
  const r = normalizeInsights(fixture("insights-movie"));

  it("keeps valid entities in rank order and drops ones without IDs", () => {
    expect(r.entities.map((e) => e.id)).toEqual(["FAKE-MOVIE-0001", "FAKE-MOVIE-0002"]);
    expect(r.entities.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("reads affinity, popularity, image and tags", () => {
    const [one, two] = r.entities;
    expect(one).toMatchObject({
      affinity: 0.91,
      affinityRank: 1,
      popularity: 0.62,
      imageUrl: "https://example.test/one.jpg",
      description: "A made-up film used only in tests.",
    });
    expect(one.tags[0]).toEqual({
      id: "urn:tag:genre:test:drama",
      name: "Drama",
      type: "urn:tag:genre",
    });
    expect(two.imageUrl).toBe("https://example.test/two.jpg");
    expect(two.tags[0].id).toBe("urn:tag:genre:test:comedy");
    expect(two.affinityRank).toBeNull();
  });

  it("reads per-entity and aggregate explainability", () => {
    expect(r.entities[0].explainability).toEqual({ "FAKE-SEED-A1": 0.7, "FAKE-SEED-B1": 0.3 });
    expect(r.entities[1].explainability).toBeNull();
    expect(r.aggregateExplainability).toEqual({ "FAKE-SEED-A1": 0.55, "FAKE-SEED-B1": 0.45 });
    expect(r.durationMs).toBe(120);
  });
});

describe("normalizeSearch", () => {
  it("reads the top-level results array and the types list", () => {
    const r = normalizeSearch(fixture("search"));
    expect(r[0]).toMatchObject({
      id: "FAKE-ARTIST-0001",
      type: "urn:entity:artist",
      disambiguation: "Made-up band",
      rank: 1,
    });
    expect(r[1].rank).toBe(2);
  });
});

describe("normalizeTags", () => {
  it("reads tags and their parent types in either format", () => {
    expect(normalizeTags(fixture("tags"))).toEqual([
      {
        id: "urn:tag:keyword:test:coming_of_age",
        name: "Coming of age",
        type: "urn:tag:keyword",
        parents: ["urn:entity:movie"],
      },
      {
        id: "urn:tag:genre:test:folk",
        name: "Folk",
        type: "urn:tag:genre",
        parents: ["urn:entity:artist"],
      },
    ]);
  });
});
