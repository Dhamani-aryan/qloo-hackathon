import { describe, expect, it, vi } from "vitest";
import type { EntityMatch, QlooClient } from "@/lib/qloo";
import { assessMatches, normalizeName, resolveSeed, toSeed } from "@/lib/engine/resolve";

function match(id: string, name: string, extra: Partial<EntityMatch> = {}): EntityMatch {
  return {
    id,
    name,
    type: "urn:entity:tv_show",
    subtype: null,
    description: null,
    imageUrl: null,
    popularity: 0.5,
    disambiguation: null,
    geocode: null,
    tags: [],
    rank: 1,
    ...extra,
  };
}

describe("normalizeName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeName("Mughal-e-Azam")).toBe(normalizeName("Mughal-E-Azam"));
    expect(normalizeName("Amélie!")).toBe("amelie");
  });
});

describe("assessMatches", () => {
  it("accepts a single exact match", () => {
    const r = assessMatches({ input: "Atlanta", type: "tvShow" }, [
      match("1", "Atlanta"),
      match("2", "Atlanta Medical"),
    ]);
    expect(r).toMatchObject({ ambiguous: false, reasons: [] });
    expect(r.best?.id).toBe("1");
  });

  it("flags when nothing matches the name exactly", () => {
    const r = assessMatches({ input: "Hades" }, [match("1", "Hades II")]);
    expect(r.reasons).toEqual(["no_exact_name_match"]);
    expect(r.best?.id).toBe("1");
  });

  it("picks the most popular of duplicate exact names and flags it", () => {
    const r = assessMatches({ input: "Shogun" }, [
      match("old", "Shogun", { popularity: 0.4 }),
      match("new", "Shogun", { popularity: 0.95 }),
    ]);
    expect(r.best?.id).toBe("new");
    expect(r.reasons).toContain("duplicate_exact_names");
  });

  it("flags a type mismatch and an empty result", () => {
    const wrong = assessMatches({ input: "Atlanta", type: "movie" }, [match("1", "Atlanta")]);
    expect(wrong.reasons).toContain("type_mismatch");
    expect(assessMatches({ input: "zzz" }, [])).toMatchObject({
      best: null,
      ambiguous: true,
      reasons: ["no_results"],
    });
  });
});

describe("resolveSeed", () => {
  it("searches the requested type, or common media types by default", async () => {
    const searchEntities = vi.fn(async () => [match("1", "Atlanta")]);
    const client = { searchEntities } as unknown as QlooClient;
    await resolveSeed(client, { input: "Atlanta", type: "tvShow" });
    await resolveSeed(client, { input: "Atlanta" });
    expect(searchEntities.mock.calls[0]).toEqual([
      { query: "Atlanta", types: ["urn:entity:tv_show"], take: 5 },
    ]);
    expect((searchEntities.mock.calls[1] as unknown as [{ types: string[] }])[0].types.length).toBe(
      6,
    );
  });
});

describe("toSeed", () => {
  it("creates a confirmed seed with a weight", () => {
    expect(toSeed("atlanta", match("1", "Atlanta"), 3)).toMatchObject({
      input: "atlanta",
      entityId: "1",
      confirmed: true,
      weight: 3,
    });
  });
});
