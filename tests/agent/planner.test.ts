import { describe, expect, it } from "vitest";
import { planDomains } from "@/lib/agent/planner";
import { scenario } from "../engine/helpers";
import { failingLlm, scriptedLlm } from "./helpers";

const CORE = ["tvShow", "artist", "book", "podcast", "place"];

const plan = (...domains: string[]) =>
  JSON.stringify({ domains: domains.map((domain) => ({ domain, reason: `why ${domain}` })) });

describe("planDomains", () => {
  it("always runs every core domain, in a stable order, keeping the LLM's reasons", async () => {
    const { llm, requests } = scriptedLlm(plan("place", "tvShow", "tvShow", "artist"));
    const p = await planDomains(llm, scenario());
    expect(p.source).toBe("llm");
    expect(p.domains.map((d) => d.domain)).toEqual(CORE);
    expect(p.domains.find((d) => d.domain === "place")?.reason).toBe("why place");
    expect(p.domains.find((d) => d.domain === "book")?.reason).toMatch(/Always searched/);
    expect(requests[0].prompt).toContain("Location: Test City");
  });

  it("gives the same domains whatever subset the LLM picks", async () => {
    const one = await planDomains(scriptedLlm(plan("artist", "book", "podcast")).llm, scenario());
    const two = await planDomains(scriptedLlm(plan("place", "tvShow", "book")).llm, scenario());
    expect(one.domains.map((d) => d.domain)).toEqual(two.domains.map((d) => d.domain));
  });

  it("searches films only when one of the groups named a film", async () => {
    const withoutFilms = await planDomains(
      scriptedLlm(plan("movie", "book", "artist")).llm,
      scenario(),
    );
    expect(withoutFilms.domains.map((d) => d.domain)).not.toContain("movie");

    const s = scenario();
    s.a.seeds[0] = { ...s.a.seeds[0], type: "urn:entity:movie" };
    const withFilms = await planDomains(scriptedLlm(plan("book", "artist", "podcast")).llm, s);
    expect(withFilms.domains.map((d) => d.domain)).toEqual([...CORE, "movie"]);
  });

  it("falls back to the same domains when the LLM fails", async () => {
    const p = await planDomains(failingLlm, scenario());
    expect(p.source).toBe("fallback");
    expect(p.domains.map((d) => d.domain)).toEqual(CORE);
  });

  it("never plans places without a location", async () => {
    const p = await planDomains(
      scriptedLlm(plan("place", "book", "podcast")).llm,
      scenario({ location: null }),
    );
    expect(p.domains.map((d) => d.domain)).toEqual(["tvShow", "artist", "book", "podcast"]);
  });
});
