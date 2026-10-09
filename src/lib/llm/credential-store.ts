import {
  ChatGptAuthError,
  loadCredential,
  refreshCredential,
  saveCredential,
  type ChatGptCredential,
} from "./chatgpt-auth";

/**
 * Where the ChatGPT-subscription credential lives.
 * - "file": `.secrets/chatgpt-auth.json` on this machine (local development).
 * - "redis": an Upstash Redis key, so a deployed serverless app can read it and save the
 *   rotated refresh token. A short lock makes sure only one instance refreshes at a time,
 *   because refresh tokens are single-use.
 */
export interface CredentialStore {
  readonly kind: "file" | "redis";
  load(): Promise<ChatGptCredential | null>;
  save(credential: ChatGptCredential): Promise<void>;
  /** Try to take the refresh lock; true if this caller should refresh. */
  lock(): Promise<boolean>;
  unlock(): Promise<void>;
}

export const REDIS_CREDENTIAL_KEY = "cg:secret:chatgpt-auth";
const LOCK_KEY = `${REDIS_CREDENTIAL_KEY}:lock`;
/** Refresh when the access token has less than this left. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export function createFileStore(file: string): CredentialStore {
  return {
    kind: "file",
    async load() {
      return loadCredential(file);
    },
    async save(c) {
      saveCredential(file, c);
    },
    async lock() {
      return true;
    },
    async unlock() {},
  };
}

export function createRedisCredentialStore(
  env: { url: string; token: string },
  doFetch: typeof fetch = fetch,
): CredentialStore {
  const call = async (command: (string | number)[]) => {
    const res = await doFetch(env.url.replace(/\/+$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new ChatGptAuthError(`Credential store error (${res.status})`);
    return ((await res.json()) as { result?: unknown }).result;
  };
  return {
    kind: "redis",
    async load() {
      const raw = await call(["GET", REDIS_CREDENTIAL_KEY]);
      if (typeof raw !== "string") return null;
      const c = JSON.parse(raw) as Partial<ChatGptCredential>;
      return c.access && c.refresh && typeof c.expires === "number" && c.accountId
        ? (c as ChatGptCredential)
        : null;
    },
    async save(c) {
      await call(["SET", REDIS_CREDENTIAL_KEY, JSON.stringify(c)]);
    },
    async lock() {
      return (await call(["SET", LOCK_KEY, "1", "NX", "EX", 30])) === "OK";
    },
    async unlock() {
      await call(["DEL", LOCK_KEY]);
    },
  };
}

let inflight: Promise<ChatGptCredential> | null = null;

/**
 * A non-expired credential from the store, refreshing it (once, across concurrent callers
 * and instances) when it is about to expire.
 */
export async function getValidCredentialFrom(
  store: CredentialStore,
  doFetch: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<ChatGptCredential> {
  const current = await store.load();
  if (!current) {
    throw new ChatGptAuthError(
      store.kind === "file"
        ? "Not signed in to ChatGPT. Run: npm run llm:login"
        : "No ChatGPT credential in the store. Run: npm run llm:push-credential",
    );
  }
  if (current.expires - Date.now() > REFRESH_MARGIN_MS) return current;

  inflight ??= (async () => {
    if (!(await store.lock())) {
      // Another instance is refreshing: wait for it to save the new token.
      for (let i = 0; i < 10; i++) {
        await sleep(1000);
        const c = await store.load();
        if (c && c.expires - Date.now() > REFRESH_MARGIN_MS) return c;
      }
      throw new ChatGptAuthError("Timed out waiting for another instance to refresh the token");
    }
    try {
      const fresh = await refreshCredential(current, doFetch);
      await store.save(fresh);
      return fresh;
    } finally {
      await store.unlock();
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
