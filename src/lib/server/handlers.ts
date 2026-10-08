import { z } from "zod";
import type { EvidenceBrief } from "@/lib/agent/brief";
import { critiqueProgram } from "@/lib/agent/critic";
import { runAgent, type AgentDeps } from "@/lib/agent/orchestrator";
import { generateProgram } from "@/lib/agent/program";
import { DOMAIN_KEYS, ScenarioSchema, resolveSeed } from "@/lib/engine";
import { QLOO_TYPES, type QlooClient, type QlooTypeKey } from "@/lib/qloo";
import { errorResponse } from "./errors";
import { sseResponse } from "./sse";

/**
 * Request handlers, kept free of Next.js and server-only imports so they can be tested with
 * fake dependencies. Route files in src/app/api wire them to the real clients.
 */

const TYPE_KEYS = Object.keys(QLOO_TYPES).filter((k) => k !== "tag") as [
  QlooTypeKey,
  ...QlooTypeKey[],
];

// ---------- POST /api/entities/resolve ----------

export const ResolveRequestSchema = z.object({
  queries: z
    .array(
      z.object({ input: z.string().trim().min(1).max(120), type: z.enum(TYPE_KEYS).optional() }),
    )
    .min(1)
    .max(16),
});

export async function handleResolve(req: Request, qloo: () => QlooClient): Promise<Response> {
  try {
    const body = ResolveRequestSchema.parse(await req.json());
    const client = qloo();
    const results = await Promise.all(body.queries.map((q) => resolveSeed(client, q)));
    return Response.json({
      results: results.map((r) => ({
        input: r.input,
        ambiguous: r.ambiguous,
        reasons: r.reasons,
        bestId: r.best?.id ?? null,
        matches: r.matches.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          disambiguation: m.disambiguation,
          imageUrl: m.imageUrl,
          popularity: m.popularity,
          description: m.description?.slice(0, 240) ?? null,
        })),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------- POST /api/analysis (streams agent events) ----------

export const AnalysisRequestSchema = z.object({
  scenario: ScenarioSchema,
  options: z
    .object({
      domains: z.array(z.enum(DOMAIN_KEYS)).min(1).max(6).optional(),
      bridgeRef: z
        .string()
        .regex(/^B\d+$/)
        .optional(),
      baseline: z.boolean().optional(),
      critic: z.boolean().optional(),
    })
    .default({}),
});

export async function handleAnalysis(req: Request, deps: () => AgentDeps): Promise<Response> {
  let parsed;
  let resolved: AgentDeps;
  try {
    parsed = AnalysisRequestSchema.parse(await req.json());
    resolved = deps();
  } catch (err) {
    return errorResponse(err);
  }
  return sseResponse(
    runAgent(resolved, parsed.scenario, { ...parsed.options, maxCalls: 40 }),
    req.signal,
  );
}

// ---------- POST /api/program (regenerate for another bridge; stateless) ----------

export const ProgramRequestSchema = z.object({
  /** The evidence brief from a finished analysis (its `brief`). */
  brief: z.custom<EvidenceBrief>(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as EvidenceBrief).entities) &&
      Array.isArray((v as EvidenceBrief).themes),
    "brief must be an evidence brief",
  ),
  bridgeRef: z.string().regex(/^B\d+$/),
  critic: z.boolean().default(true),
});

export async function handleProgram(req: Request, deps: () => AgentDeps): Promise<Response> {
  try {
    const body = ProgramRequestSchema.parse(await req.json());
    if (!body.brief.entities.some((e) => e.ref === body.bridgeRef && e.role === "bridge")) {
      return Response.json({ error: "unknown_bridge" }, { status: 400 });
    }
    const { llm } = deps();
    const draft = await generateProgram(llm, body.brief, body.bridgeRef);
    if (!body.critic) return Response.json({ program: draft, critique: [] });
    const c = await critiqueProgram(llm, body.brief, draft).catch(() => null);
    return Response.json({ program: c?.revised ?? draft, draft, critique: c?.issues ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
