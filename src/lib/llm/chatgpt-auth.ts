import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * ChatGPT subscription sign-in (the "Sign in with ChatGPT" OAuth flow used by the Codex CLI).
 * Approach adapted from https://github.com/earendil-works/pi (packages/ai/src/auth/oauth/openai-codex.ts).
 *
 * The project keeps its OWN credential file (default `.secrets/chatgpt-auth.json`, git-ignored)
 * instead of reusing `~/.codex/auth.json`: refresh tokens rotate, so sharing one with the Codex
 * CLI would log one of them out.
 */

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE_URL = "https://auth.openai.com";
const TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
const DEVICE_USER_CODE_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/token`;
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`;
export const DEVICE_VERIFICATION_URL = `${AUTH_BASE_URL}/codex/device`;
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
/** Refresh when the access token has less than this left. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export interface ChatGptCredential {
  access: string;
  refresh: string;
  /** Epoch ms when the access token expires. */
  expires: number;
  accountId: string;
}

export class ChatGptAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatGptAuthError";
  }
}

export function accountIdFromJwt(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const id = json?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

async function readToken(res: Response, op: string): Promise<ChatGptCredential> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ChatGptAuthError(`ChatGPT token ${op} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    throw new ChatGptAuthError(`ChatGPT token ${op} response is missing fields`);
  }
  const accountId = accountIdFromJwt(json.access_token);
  if (!accountId)
    throw new ChatGptAuthError("Could not read the ChatGPT account ID from the token");
  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
    accountId,
  };
}

// ---------- credential file ----------

export function loadCredential(file: string): ChatGptCredential | null {
  if (!existsSync(file)) return null;
  const c = JSON.parse(readFileSync(file, "utf8")) as Partial<ChatGptCredential>;
  if (!c.access || !c.refresh || typeof c.expires !== "number" || !c.accountId) return null;
  return c as ChatGptCredential;
}

export function saveCredential(file: string, credential: ChatGptCredential): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(credential, null, 2));
  try {
    chmodSync(file, 0o600);
  } catch {
    // Best effort; Windows ignores POSIX modes.
  }
}

// ---------- refresh ----------

export async function refreshCredential(
  credential: ChatGptCredential,
  doFetch: typeof fetch = fetch,
): Promise<ChatGptCredential> {
  const res = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refresh,
      client_id: CLIENT_ID,
    }),
  });
  return readToken(res, "refresh");
}

let inflight: Promise<ChatGptCredential> | null = null;

/** Returns a non-expired credential, refreshing and saving it when needed. */
export async function getValidCredential(
  file: string,
  doFetch: typeof fetch = fetch,
): Promise<ChatGptCredential> {
  const current = loadCredential(file);
  if (!current) {
    throw new ChatGptAuthError(
      `Not signed in to ChatGPT (no credential at ${file}). Run: npm run llm:login`,
    );
  }
  if (current.expires - Date.now() > REFRESH_MARGIN_MS) return current;

  // Share one refresh between concurrent callers so the rotating refresh token is used once.
  inflight ??= refreshCredential(current, doFetch)
    .then((fresh) => {
      saveCredential(file, fresh);
      return fresh;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// ---------- device-code login (one-time, run by the user) ----------

export interface DeviceCodePrompt {
  userCode: string;
  verificationUrl: string;
}

export async function loginWithDeviceCode(
  onPrompt: (p: DeviceCodePrompt) => void,
  { timeoutMs = 15 * 60_000, doFetch = fetch }: { timeoutMs?: number; doFetch?: typeof fetch } = {},
): Promise<ChatGptCredential> {
  const start = await doFetch(DEVICE_USER_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  if (!start.ok) {
    throw new ChatGptAuthError(`Device login could not start (${start.status})`);
  }
  const device = (await start.json()) as {
    device_auth_id?: string;
    user_code?: string;
    interval?: number | string;
  };
  if (!device.device_auth_id || !device.user_code) {
    throw new ChatGptAuthError("Device login returned an unexpected response");
  }
  onPrompt({ userCode: device.user_code, verificationUrl: DEVICE_VERIFICATION_URL });

  let intervalMs = Math.max(1, Number(device.interval) || 5) * 1000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const poll = await doFetch(DEVICE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_auth_id: device.device_auth_id, user_code: device.user_code }),
    });
    if (poll.ok) {
      const code = (await poll.json()) as { authorization_code?: string; code_verifier?: string };
      if (!code.authorization_code || !code.code_verifier) {
        throw new ChatGptAuthError("Device login returned an incomplete authorization");
      }
      const res = await doFetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          code: code.authorization_code,
          code_verifier: code.code_verifier,
          redirect_uri: DEVICE_REDIRECT_URI,
        }),
      });
      return readToken(res, "exchange");
    }
    if (poll.status === 403 || poll.status === 404) continue; // still pending
    const text = await poll.text().catch(() => "");
    if (text.includes("authorization_pending")) continue;
    if (text.includes("slow_down")) {
      intervalMs += 5000;
      continue;
    }
    throw new ChatGptAuthError(`Device login failed (${poll.status}): ${text.slice(0, 200)}`);
  }
  throw new ChatGptAuthError("Device login timed out. Run npm run llm:login again.");
}
