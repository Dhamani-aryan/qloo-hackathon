import { describe, expect, it, vi } from "vitest";
import { createQlooClient, QlooError, QLOO_TYPES } from "@/lib/qloo";
import { fixture, jsonResponse, mockFetch, noSleep } from "./helpers";

const base = { apiKey: "test-key", baseUrl: "https://hackathon.api.qloo.com", sleep: noSleep };

describe("request building", () => {
  it("sends the key in X-Api-Key and uses GET with query params", async () => {
    const m = mockFetch(jsonResponse(fixture("insights-movie")));
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    await qloo.getInsights({
      filterType: QLOO_TYPES.movie,
      signalEntities: ["A1", "B1"],
      explainability: true,
      take: 25,
    });

    const { url, init } = m.calls[0];
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(url.origin + url.pathname).toBe("https://hackathon.api.qloo.com/v2/insights");
    expect(url.searchParams.get("filter.type")).toBe("urn:entity:movie");
    expect(url.searchParams.get("signal.interests.entities")).toBe("A1,B1");
    expect(url.searchParams.get("feature.explainability")).toBe("true");
    expect(url.searchParams.get("take")).toBe("25");
    expect(url.searchParams.has("filter.tags")).toBe(false);
  });

  it("maps compare inputs to a./b. signal params", async () => {
    const m = mockFetch(jsonResponse({ success: true, results: [{ entity_id: "X", name: "X" }] }));
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    await qloo.compareProfiles({ aEntities: ["A1", "A2"], bEntities: ["B1"] });
    const { url } = m.calls[0];
    expect(url.pathname).toBe("/v2/analysis/compare");
    expect(url.searchParams.get("a.signal.interests.entities")).toBe("A1,A2");
    expect(url.searchParams.get("b.signal.interests.entities")).toBe("B1");
  });

  it("never puts the key in the URL", async () => {
    const m = mockFetch(jsonResponse(fixture("search")));
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    await qloo.searchEntities({ query: "x" });
    expect(m.calls[0].url.toString()).not.toContain("test-key");
  });
});

describe("retries and errors", () => {
  it("retries 429 and 5xx, then succeeds", async () => {
    const m = mockFetch(
      jsonResponse({}, 429, { "retry-after": "0" }),
      jsonResponse({}, 503),
      jsonResponse(fixture("search")),
    );
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    const results = await qloo.searchEntities({ query: "x" });
    expect(results).toHaveLength(2);
    expect(m.calls).toHaveLength(3);
  });

  it("gives up after maxRetries", async () => {
    const m = mockFetch(jsonResponse({}, 500), jsonResponse({}, 500), jsonResponse({}, 500));
    const qloo = createQlooClient({ ...base, fetch: m.fetch, maxRetries: 2 });
    await expect(qloo.searchEntities({ query: "x" })).rejects.toMatchObject({ kind: "server" });
    expect(m.calls).toHaveLength(3);
  });

  it("does not retry 401 and explains the hackathon base URL", async () => {
    const m = mockFetch(jsonResponse({ error: "nope" }, 401));
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    const err = await qloo.searchEntities({ query: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(QlooError);
    expect(err.kind).toBe("unauthorized");
    expect(err.message).toContain("hackathon.api.qloo.com");
    expect(m.calls).toHaveLength(1);
  });

  it("turns an abort into a timeout error", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const m = mockFetch(abort);
    const qloo = createQlooClient({ ...base, fetch: m.fetch, maxRetries: 0 });
    await expect(qloo.searchEntities({ query: "x" })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("rejects success=false bodies", async () => {
    const m = mockFetch(jsonResponse({ success: false, error: { message: "bad param" } }));
    const qloo = createQlooClient({ ...base, fetch: m.fetch });
    await expect(qloo.searchEntities({ query: "x" })).rejects.toThrow(/bad param/);
  });
});

describe("empty results", () => {
  it("warns on an empty 200 because Qloo ignores invalid params silently", async () => {
    const onEmpty = vi.fn();
    const m = mockFetch(jsonResponse({ success: true, results: { entities: [] } }));
    const qloo = createQlooClient({ ...base, fetch: m.fetch, onEmpty });
    const r = await qloo.getInsights({ filterType: QLOO_TYPES.movie, signalEntities: ["A1"] });
    expect(r.entities).toEqual([]);
    expect(onEmpty).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2/insights" }));
  });
});
