import { QlooError, kindForStatus } from "./errors";

export type QueryValue = string | number | boolean | string[] | undefined | null;

export interface HttpOptions {
  apiKey: string;
  baseUrl: string;
  /** Per-attempt timeout. Default 8s. */
  timeoutMs?: number;
  /** Retries after the first attempt, only for retryable errors. Default 2. */
  maxRetries?: number;
  fetch?: typeof fetch;
  /** Injected for tests so backoff doesn't actually wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Called with every successful raw response (used for spike dumps). */
  onResponse?: (info: {
    path: string;
    params: Record<string, string>;
    body: unknown;
    ms: number;
  }) => void;
}

/**
 * Serialize params the way the Qloo GET API expects: arrays become comma-separated
 * values, empty values are dropped.
 */
export function toQueryParams(params: Record<string, QueryValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      out[key] = value.join(",");
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  return 500 * 2 ** attempt + Math.floor(Math.random() * 200);
}

export function createHttp(opts: HttpOptions) {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const maxRetries = opts.maxRetries ?? 2;

  async function once(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, opts.baseUrl + "/");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "GET",
        headers: { "X-Api-Key": opts.apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      throw new QlooError(
        aborted ? "timeout" : "network",
        path,
        null,
        aborted ? `no response in ${timeoutMs}ms` : (err as Error)?.message,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new QlooError(
        kindForStatus(res.status),
        path,
        res.status,
        text.slice(0, 300) || undefined,
      );
      (err as QlooError & { retryAfter?: string | null }).retryAfter =
        res.headers.get("retry-after");
      throw err;
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new QlooError("invalid_response", path, res.status, "response was not JSON");
    }
    opts.onResponse?.({ path, params, body, ms: Date.now() - started });
    return body;
  }

  return async function get(path: string, params: Record<string, QueryValue>): Promise<unknown> {
    const query = toQueryParams(params);
    for (let attempt = 0; ; attempt++) {
      try {
        return await once(path, query);
      } catch (err) {
        if (!(err instanceof QlooError) || !err.retryable || attempt >= maxRetries) throw err;
        const retryAfter = (err as QlooError & { retryAfter?: string | null }).retryAfter ?? null;
        await sleep(backoffMs(attempt, retryAfter));
      }
    }
  };
}
