import { describe, expect, it } from "vitest";
import { MissingEnvError, getQlooEnv, getLlmEnv, isQlooConfigured } from "@/lib/env";

describe("getQlooEnv", () => {
  it("throws a clear error naming the missing key", () => {
    expect(() => getQlooEnv({})).toThrow(MissingEnvError);
    expect(() => getQlooEnv({})).toThrow(/QLOO_API_KEY is missing/);
    expect(() => getQlooEnv({})).toThrow(/\.env\.local/);
  });

  it("treats an empty key as missing", () => {
    expect(() => getQlooEnv({ QLOO_API_KEY: "" })).toThrow(/QLOO_API_KEY/);
  });

  it("defaults to the hackathon base URL", () => {
    expect(getQlooEnv({ QLOO_API_KEY: "k" })).toEqual({
      apiKey: "k",
      baseUrl: "https://hackathon.api.qloo.com",
    });
  });

  it("strips trailing slashes from a custom base URL", () => {
    expect(getQlooEnv({ QLOO_API_KEY: "k", QLOO_BASE_URL: "https://x.test/" }).baseUrl).toBe(
      "https://x.test",
    );
  });

  it("never includes the key value in the error message", () => {
    try {
      getQlooEnv({ QLOO_API_KEY: "secret-123", QLOO_BASE_URL: "not a url" });
    } catch (e) {
      expect(String(e)).not.toContain("secret-123");
    }
  });
});

describe("other areas", () => {
  it("LLM env defaults the model", () => {
    expect(getLlmEnv({ ANTHROPIC_API_KEY: "a" }).model).toBe("claude-sonnet-5");
  });

  it("isQlooConfigured reflects key presence", () => {
    expect(isQlooConfigured({})).toBe(false);
    expect(isQlooConfigured({ QLOO_API_KEY: "  " })).toBe(false);
    expect(isQlooConfigured({ QLOO_API_KEY: "k" })).toBe(true);
  });
});
