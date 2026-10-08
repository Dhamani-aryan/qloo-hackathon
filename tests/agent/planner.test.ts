import { describe, expect, it } from "vitest";
import { planDomains } from "@/lib/agent/planner";
import { scenario } from "../engine/helpers";
import { failingLlm, scriptedLlm } from "./helpers";

describe("planDomains", () => {
  it("uses the LLM plan, dropping duplicates", async () => {
    const { llm, requests } = scriptedLlm(
      JSON.stringify({
        domains: [
          { domain: "tvShow", reason: "watch club" },
          { domain: "artist", reason: "listening night" },
          { domain: "tvShow", reason: "dup" },
          { domain: "place", reason: "venue" },
        ],
      }),
    );
    const plan = await planDomains(llm, scenario());
    expect(plan.source).toBe("llm");
    expect(plan.domains.map((d) => d.domain)).toEqual(["tvShow", "artist", "place"]);
    expect(requests[0].prompt).toContain("Location: Test City");
  });

  it("falls back to the validated defaults when the LLM fails", async () => {
    const plan = await planDomains(failingLlm, scenario());
    expect(plan.source).toBe("fallback");
    expect(plan.domains.map((d) => d.domain)).toEqual([
      "tvShow",
      "artist",
      "book",
      "podcast",
      "place",
    ]);
  });

  it("never plans places without a location", async () => {
    const { llm } = scriptedLlm(
      JSON.stringify({
        domains: [
          { domain: "place", reason: "x" },
          { domain: "book", reason: "x" },
          { domain: "podcast", reason: "x" },
        ],
      }),
    );
    const plan = await planDomains(llm, scenario({ location: null }));
    // Dropping place leaves two domains, so the fallback (without place) is used.
    expect(plan.source).toBe("fallback");
    expect(plan.domains.map((d) => d.domain)).not.toContain("place");
  });
});
