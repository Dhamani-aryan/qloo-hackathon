import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChatGptLlm, parseSse } from "@/lib/llm/chatgpt";
import {
  accountIdFromJwt,
  loadCredential,
  saveCredential,
  type ChatGptCredential,
} from "@/lib/llm/chatgpt-auth";
import { createFileStore, getValidCredentialFrom } from "@/lib/llm/credential-store";

/** A fake JWT whose payload carries a made-up ChatGPT account ID. */
function fakeJwt(accountId = "acct-test") {
  const payload = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }),
  ).toString("base64url");
  return `x.${payload}.y`;
}

function sseStream(frames: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
}

let dir: string;
let authFile: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cg-llm-"));
  authFile = join(dir, "auth.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const freshCredential = (): ChatGptCredential => ({
  access: fakeJwt(),
  refresh: "refresh-1",
  expires: Date.now() + 60 * 60_000,
  accountId: "acct-test",
});

describe("parseSse", () => {
  it("parses data frames, including ones split across chunks", async () => {
    const events = [];
    for await (const e of parseSse(
      sseStream([
        'event: a\ndata: {"type":"one"}\n\n',
        'data: {"type":"t',
        'wo"}\n\ndata: [DONE]\n\n',
      ]),
    )) {
      events.push(e.type);
    }
    expect(events).toEqual(["one", "two"]);
  });
});

describe("chatgpt-auth", () => {
  it("reads the account ID from a JWT", () => {
    expect(accountIdFromJwt(fakeJwt("abc"))).toBe("abc");
    expect(accountIdFromJwt("not-a-jwt")).toBeNull();
  });

  it("asks the user to sign in when no credential exists", async () => {
    await expect(getValidCredentialFrom(createFileStore(authFile))).rejects.toThrow(
      /npm run llm:login/,
    );
  });

  it("returns a fresh credential without refreshing", async () => {
    saveCredential(authFile, freshCredential());
    const doFetch = vi.fn();
    await getValidCredentialFrom(createFileStore(authFile), doFetch as unknown as typeof fetch);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("refreshes an expiring credential and saves the rotated token", async () => {
    saveCredential(authFile, { ...freshCredential(), expires: Date.now() + 1000 });
    const doFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: fakeJwt(), refresh_token: "refresh-2", expires_in: 3600 }),
        ),
    );
    const c = await getValidCredentialFrom(
      createFileStore(authFile),
      doFetch as unknown as typeof fetch,
    );
    expect(c.refresh).toBe("refresh-2");
    expect(loadCredential(authFile)?.refresh).toBe("refresh-2");
  });
});

describe("createChatGptLlm", () => {
  it("sends subscription headers and joins streamed text deltas", async () => {
    saveCredential(authFile, freshCredential());
    let sent: { url: string; init: RequestInit } | null = null;
    const doFetch = vi.fn(async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(
        sseStream([
          'data: {"type":"response.output_text.delta","delta":"common "}\n\n',
          'data: {"type":"response.output_text.delta","delta":"ground"}\n\n',
          'data: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":2}}}\n\n',
        ]),
      );
    });
    const llm = createChatGptLlm({
      authFile,
      model: "test-model",
      fetch: doFetch as unknown as typeof fetch,
    });
    const r = await llm.generateText({ system: "s", prompt: "p" });

    expect(r.text).toBe("common ground");
    expect(r.usage).toEqual({ inputTokens: 5, outputTokens: 2 });
    expect(sent!.url).toBe("https://chatgpt.com/backend-api/codex/responses");
    const headers = sent!.init.headers as Record<string, string>;
    expect(headers["chatgpt-account-id"]).toBe("acct-test");
    expect(headers.Authorization).toMatch(/^Bearer /);
    const body = JSON.parse(sent!.init.body as string);
    expect(body).toMatchObject({
      model: "test-model",
      store: false,
      stream: true,
      instructions: "s",
    });
  });

  it("surfaces failed generations and 401s with a sign-in hint", async () => {
    saveCredential(authFile, freshCredential());
    const failing = vi.fn(async () => new Response("bad token", { status: 401 }));
    const llm = createChatGptLlm({
      authFile,
      model: "m",
      fetch: failing as unknown as typeof fetch,
    });
    await expect(llm.generateText({ system: "s", prompt: "p" })).rejects.toThrow(/llm:login/);
  });
});
