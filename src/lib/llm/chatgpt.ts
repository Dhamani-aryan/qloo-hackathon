import { getValidCredential } from "./chatgpt-auth";
import { LlmError, type LlmClient, type LlmResponse } from "./types";

/**
 * LLM client that uses a ChatGPT subscription through the Codex backend
 * (`https://chatgpt.com/backend-api/codex/responses`, an OpenAI Responses-style SSE API).
 * Request shape adapted from https://github.com/earendil-works/pi
 * (packages/ai/src/api/openai-codex-responses.ts).
 */

const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

export interface ChatGptLlmOptions {
  authFile: string;
  model: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  timeoutMs?: number;
  fetch?: typeof fetch;
}

interface SseEvent {
  type?: string;
  delta?: string;
  message?: string;
  response?: {
    error?: { message?: string } | null;
    usage?: { input_tokens?: number; output_tokens?: number } | null;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
}

/** Parse a `text/event-stream` body into JSON `data:` payloads. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = function* (block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    try {
      yield JSON.parse(data) as SseEvent;
    } catch {
      // Ignore keep-alive or malformed frames.
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      yield* flush(block);
    }
  }
  if (buffer.trim()) yield* flush(buffer);
}

function textFromOutput(output: NonNullable<SseEvent["response"]>["output"]): string {
  return (output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

export function createChatGptLlm(opts: ChatGptLlmOptions): LlmClient {
  const doFetch = opts.fetch ?? fetch;

  return {
    provider: "chatgpt",
    model: opts.model,

    async generateText({ system, prompt }): Promise<LlmResponse> {
      const credential = await getValidCredential(opts.authFile, doFetch);
      const started = Date.now();

      const body = {
        model: opts.model,
        store: false,
        stream: true,
        instructions: system,
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { verbosity: "low" },
        ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
      };

      let res: Response;
      try {
        res = await doFetch(CODEX_RESPONSES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credential.access}`,
            "chatgpt-account-id": credential.accountId,
            "OpenAI-Beta": "responses=experimental",
            originator: "common_ground",
            accept: "text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        });
      } catch (err) {
        throw new LlmError(`ChatGPT request failed: ${(err as Error).message}`);
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        const hint =
          res.status === 401
            ? " Sign in again with: npm run llm:login"
            : res.status === 429
              ? " The ChatGPT subscription usage limit may be reached."
              : "";
        throw new LlmError(
          `ChatGPT returned ${res.status}: ${text.slice(0, 300)}${hint}`,
          res.status,
        );
      }

      let text = "";
      let usage: LlmResponse["usage"] = null;
      for await (const event of parseSse(res.body)) {
        if (event.type === "response.output_text.delta" && event.delta) {
          text += event.delta;
        } else if (event.type === "response.completed") {
          if (!text) text = textFromOutput(event.response?.output);
          const u = event.response?.usage;
          usage = u
            ? { inputTokens: u.input_tokens ?? null, outputTokens: u.output_tokens ?? null }
            : null;
        } else if (event.type === "response.failed" || event.type === "error") {
          const message = event.response?.error?.message ?? event.message ?? "unknown error";
          throw new LlmError(`ChatGPT generation failed: ${message}`);
        }
      }

      return { text, usage, model: opts.model, ms: Date.now() - started };
    },
  };
}
