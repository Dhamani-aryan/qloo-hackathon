export interface LlmRequest {
  /** System instructions. */
  system: string;
  /** The user message. */
  prompt: string;
}

export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmResponse {
  text: string;
  usage: LlmUsage | null;
  model: string;
  ms: number;
}

/** Provider-agnostic text generation. Structured output is layered on top in `structured.ts`. */
export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  generateText(request: LlmRequest): Promise<LlmResponse>;
}

export class LlmError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}
