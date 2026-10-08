import type { LlmClient, LlmRequest } from "@/lib/llm/types";

/** LLM double that answers each request with the next scripted reply (string or function). */
export function scriptedLlm(...replies: (string | ((req: LlmRequest) => string))[]) {
  const requests: LlmRequest[] = [];
  const llm: LlmClient = {
    provider: "test",
    model: "test-model",
    generateText: async (req) => {
      requests.push(req);
      const next = replies.shift();
      if (next === undefined) throw new Error("scriptedLlm: no more replies");
      const text = typeof next === "function" ? next(req) : next;
      return { text, usage: { inputTokens: 10, outputTokens: 10 }, model: "test-model", ms: 1 };
    },
  };
  return { llm, requests };
}

export const failingLlm: LlmClient = {
  provider: "test",
  model: "test-model",
  generateText: async () => {
    throw new Error("LLM down");
  },
};
