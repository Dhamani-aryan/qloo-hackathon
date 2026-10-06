import { readFileSync } from "node:fs";
import { vi } from "vitest";

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`fixtures/synthetic/${name}.json`, "utf8"));
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A fetch mock that returns the given responses in order and records requested URLs. */
export function mockFetch(...responses: (Response | Error)[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: new URL(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("mockFetch: no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

export const noSleep = async () => {};
