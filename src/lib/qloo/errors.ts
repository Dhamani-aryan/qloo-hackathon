export type QlooErrorKind =
  | "unauthorized" // 401: wrong base URL or invalid key
  | "forbidden" // 403: often an unsupported entity type
  | "not_found" // 404: wrong path or method
  | "bad_request" // 400/422: invalid params, e.g. "at least one valid signal or filter required"
  | "rate_limited" // 429
  | "server" // 5xx
  | "timeout"
  | "network"
  | "invalid_response";

const HINTS: Partial<Record<QlooErrorKind, string>> = {
  unauthorized:
    "Check QLOO_API_KEY and that QLOO_BASE_URL is https://hackathon.api.qloo.com (hackathon keys fail elsewhere).",
  forbidden: "The entity type may not be supported for this key. Check the filter.type URN.",
  not_found: "Check the endpoint path. All hackathon endpoints use GET with query parameters.",
  bad_request: "A parameter is invalid. Tag and audience IDs must come from /v2/tags.",
};

export class QlooError extends Error {
  readonly kind: QlooErrorKind;
  readonly status: number | null;
  readonly path: string;

  constructor(kind: QlooErrorKind, path: string, status: number | null, detail?: string) {
    const hint = HINTS[kind];
    super(
      `Qloo ${kind}${status ? ` (${status})` : ""} on ${path}` +
        (detail ? `: ${detail}` : "") +
        (hint ? ` (${hint})` : ""),
    );
    this.name = "QlooError";
    this.kind = kind;
    this.status = status;
    this.path = path;
  }

  get retryable(): boolean {
    return ["rate_limited", "server", "timeout", "network"].includes(this.kind);
  }
}

export function kindForStatus(status: number): QlooErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "bad_request";
}
