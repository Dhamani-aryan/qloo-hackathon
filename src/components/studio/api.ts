import type { QlooTypeKey } from "@/lib/qloo/types";
import type { Match } from "./draft";

/** Browser-side calls to the COMMON GROUND API. */

export interface Resolution {
  input: string;
  ambiguous: boolean;
  reasons: string[];
  bestId: string | null;
  matches: Match[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function readError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown };
  const detail = Array.isArray(body.detail) ? body.detail.join("; ") : (body.detail as string);
  return new ApiError(detail || body.error || res.statusText, res.status, body.error ?? "error");
}

const BATCH = 16;

export async function resolveSeeds(
  queries: { input: string; type?: QlooTypeKey }[],
): Promise<Resolution[]> {
  const out: Resolution[] = [];
  for (let i = 0; i < queries.length; i += BATCH) {
    const res = await fetch("/api/entities/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queries: queries.slice(i, i + BATCH) }),
    });
    if (!res.ok) throw await readError(res);
    out.push(...((await res.json()) as { results: Resolution[] }).results);
  }
  return out;
}

/** POST a JSON body and yield parsed server-sent events. */
export async function* streamEvents<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await readError(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (data) yield JSON.parse(data) as T;
    }
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as T;
}
