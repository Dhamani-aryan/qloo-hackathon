import { z } from "zod";
import { LlmError, type LlmClient, type LlmUsage } from "./types";

/**
 * Structured output on top of any `LlmClient`: the JSON Schema of a Zod schema is placed in
 * the prompt, the reply is parsed and validated, and one repair attempt is made with the
 * validation errors. Provider-agnostic on purpose (the ChatGPT backend has no documented
 * structured-output mode).
 */

export interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  /** Short label for logs, e.g. "program". */
  label: string;
}

export interface StructuredResult<T> {
  data: T;
  attempts: number;
  ms: number;
  usage: LlmUsage | null;
}

/** Pull the first JSON object or array out of a reply (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in reply");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error("unterminated JSON in reply");
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export async function generateStructured<S extends z.ZodType>(
  llm: LlmClient,
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const started = Date.now();
  const jsonSchema = JSON.stringify(z.toJSONSchema(req.schema, { io: "input" }));
  const system =
    `${req.system}\n\nReply with ONE JSON value that validates against this JSON Schema, ` +
    `and nothing else (no prose, no code fences):\n${jsonSchema}`;

  let prompt = req.prompt;
  let usage: LlmUsage | null = null;
  let lastProblem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await llm.generateText({ system, prompt });
    usage = reply.usage;
    let parsed: unknown;
    try {
      parsed = extractJson(reply.text);
    } catch (e) {
      lastProblem = `The reply was not valid JSON (${(e as Error).message}).`;
      prompt = `${req.prompt}\n\nYour previous reply was rejected: ${lastProblem} Reply with JSON only.`;
      continue;
    }
    const result = req.schema.safeParse(parsed);
    if (result.success) {
      return { data: result.data, attempts: attempt, ms: Date.now() - started, usage };
    }
    lastProblem = formatIssues(result.error);
    prompt =
      `${req.prompt}\n\nYour previous reply failed validation:\n${lastProblem}\n` +
      `Previous reply:\n${JSON.stringify(parsed).slice(0, 4000)}\n\nReturn the corrected JSON only.`;
  }
  throw new LlmError(`${req.label}: model output failed validation twice.\n${lastProblem}`);
}
