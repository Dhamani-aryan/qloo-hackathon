import { describe, expect, it, vi } from "vitest";
import type { ChatGptCredential } from "@/lib/llm/chatgpt-auth";
import {
  REDIS_CREDENTIAL_KEY,
  createRedisCredentialStore,
  getValidCredentialFrom,
} from "@/lib/llm/credential-store";

function fakeJwt(accountId = "acct-test") {
  const payload = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }),
  ).toString("base64url");
  return `x.${payload}.y`;
}

/** Minimal in-memory Upstash REST double: GET, SET (with NX), DEL. */
function fakeUpstash() {
  const data = new Map<string, string>();
  const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
    const [cmd, key, value, ...rest] = JSON.parse(init.body as string) as string[];
    let result: unknown = null;
    if (cmd === "GET") result = data.get(key) ?? null;
    if (cmd === "SET") {
      if (rest.includes("NX") && data.has(key)) result = null;
      else {
        data.set(key, value);
        result = "OK";
      }
    }
    if (cmd === "DEL") result = data.delete(key) ? 1 : 0;
    return Response.json({ result });
  });
  return { data, fetch: fetchFn as unknown as typeof fetch };
}

const credential = (expiresInMs: number, refresh = "refresh-1"): ChatGptCredential => ({
  access: fakeJwt(),
  refresh,
  expires: Date.now() + expiresInMs,
  accountId: "acct-test",
});

const tokenEndpoint = (refresh: string) =>
  vi.fn(
    async () =>
      new Response(
        JSON.stringify({ access_token: fakeJwt(), refresh_token: refresh, expires_in: 3600 }),
      ),
  ) as unknown as typeof fetch;

describe("Upstash credential store", () => {
  it("round-trips a credential", async () => {
    const up = fakeUpstash();
    const store = createRedisCredentialStore({ url: "https://r.test", token: "t" }, up.fetch);
    expect(await store.load()).toBeNull();
    await store.save(credential(3_600_000));
    expect((await store.load())?.accountId).toBe("acct-test");
    expect(up.data.has(REDIS_CREDENTIAL_KEY)).toBe(true);
  });

  it("refreshes an expiring token once, saves the rotated token and releases the lock", async () => {
    const up = fakeUpstash();
    const store = createRedisCredentialStore({ url: "https://r.test", token: "t" }, up.fetch);
    await store.save(credential(1000));
    const c = await getValidCredentialFrom(store, tokenEndpoint("refresh-2"));
    expect(c.refresh).toBe("refresh-2");
    expect((await store.load())?.refresh).toBe("refresh-2");
    expect(up.data.has(`${REDIS_CREDENTIAL_KEY}:lock`)).toBe(false);
  });

  it("waits for another instance's refresh instead of reusing the single-use token", async () => {
    const up = fakeUpstash();
    const store = createRedisCredentialStore({ url: "https://r.test", token: "t" }, up.fetch);
    await store.save(credential(1000));
    up.data.set(`${REDIS_CREDENTIAL_KEY}:lock`, "1"); // another instance holds the lock
    const refresh = tokenEndpoint("should-not-be-used");
    const sleep = vi.fn(async () => {
      // The other instance finishes its refresh while we wait.
      up.data.set(REDIS_CREDENTIAL_KEY, JSON.stringify(credential(3_600_000, "refresh-other")));
    });
    const c = await getValidCredentialFrom(store, refresh, sleep);
    expect(c.refresh).toBe("refresh-other");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("explains how to fix a missing credential", async () => {
    const up = fakeUpstash();
    const store = createRedisCredentialStore({ url: "https://r.test", token: "t" }, up.fetch);
    await expect(getValidCredentialFrom(store)).rejects.toThrow(/llm:push-credential/);
  });
});
