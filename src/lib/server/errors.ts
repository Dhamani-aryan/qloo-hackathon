import { ZodError } from "zod";
import { MissingEnvError } from "@/lib/env";
import { ChatGptAuthError } from "@/lib/llm/chatgpt-auth";
import { LlmError } from "@/lib/llm/types";
import { QlooError } from "@/lib/qloo";

export function jsonError(status: number, error: string, detail?: unknown): Response {
  return Response.json({ error, ...(detail ? { detail } : {}) }, { status });
}

/** Map known failures to safe HTTP responses. Messages never include secrets. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return jsonError(
      400,
      "invalid_request",
      err.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`),
    );
  }
  if (err instanceof SyntaxError) return jsonError(400, "invalid_json");
  if (err instanceof MissingEnvError || err instanceof ChatGptAuthError) {
    return jsonError(503, "not_configured", err.message);
  }
  if (err instanceof QlooError) {
    return jsonError(err.kind === "rate_limited" ? 429 : 502, "qloo_error", err.message);
  }
  if (err instanceof LlmError) return jsonError(502, "llm_error", err.message);
  console.error(err);
  return jsonError(500, "internal_error");
}
