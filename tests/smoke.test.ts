import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("resolves the @ alias", async () => {
    const mod = await import("@/app/page");
    expect(typeof mod.default).toBe("function");
  });
});
