import { getLlmEnv } from "@/lib/env";
import { createChatGptLlm } from "./chatgpt";
import type { LlmClient } from "./types";

export { createChatGptLlm } from "./chatgpt";
export { LlmError } from "./types";
export type * from "./types";

let client: LlmClient | null = null;

/** The configured LLM client. Provider and model come from env (see .env.example). */
export function getLlm(env: Record<string, string | undefined> = process.env): LlmClient {
  if (client) return client;
  const e = getLlmEnv(env);
  client = createChatGptLlm({
    authFile: e.chatgptAuthFile,
    model: e.model,
    reasoningEffort: e.reasoningEffort,
  });
  return client;
}
