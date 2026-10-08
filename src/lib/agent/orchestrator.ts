import {
  runBridgeEngine,
  type DomainKey,
  type EngineEvent,
  type EngineResult,
  type Scenario,
} from "@/lib/engine";
import type { LlmClient } from "@/lib/llm/types";
import type { QlooClient } from "@/lib/qloo";
import { generateBaseline, type BaselineProgram } from "./baseline";
import { buildBrief, type EvidenceBrief } from "./brief";
import { critiqueProgram, type CritiqueIssue } from "./critic";
import { writeBridgeNotes, type BridgeNote } from "./notes";
import { planDomains, type DomainPlan } from "./planner";
import { generateProgram, type Program } from "./program";

/**
 * The single agent orchestrator (plan §9). A fixed state machine:
 *   UNDERSTAND → PLAN_DOMAINS → QUERY_QLOO → DESIGN → CRITIQUE → EXPLAIN → DONE
 * Qloo work is deterministic (bridge engine); the LLM plans, explains, designs and critiques.
 * The LLM-only baseline runs in parallel from the start. Events report real actions only.
 */

export type AgentState =
  "UNDERSTAND" | "PLAN_DOMAINS" | "QUERY_QLOO" | "DESIGN" | "CRITIQUE" | "EXPLAIN" | "DONE";

export type AgentStatus = "ok" | "insufficient_evidence" | "partial";

export interface AgentResult {
  status: AgentStatus;
  scenario: Scenario;
  plan: DomainPlan | null;
  engine: EngineResult | null;
  brief: EvidenceBrief | null;
  notes: BridgeNote[];
  draft: Program | null;
  critique: CritiqueIssue[];
  program: Program | null;
  baseline: BaselineProgram | null;
  warnings: string[];
  timings: Partial<Record<AgentState | "BASELINE", number>>;
}

export type AgentEvent =
  | { type: "state"; state: AgentState }
  | { type: "plan"; plan: DomainPlan }
  | { type: "engine"; event: EngineEvent }
  | { type: "engine_result"; result: EngineResult }
  | { type: "notes"; notes: BridgeNote[] }
  | { type: "program_draft"; program: Program }
  | { type: "critique"; issues: CritiqueIssue[]; program: Program }
  | { type: "baseline"; baseline: BaselineProgram | null }
  | { type: "warning"; message: string }
  | { type: "done"; result: AgentResult };

export interface AgentDeps {
  qloo: QlooClient;
  llm: LlmClient;
}

export interface AgentOptions {
  /** Skip LLM planning and use these domains. */
  domains?: DomainKey[];
  bridgeRef?: string;
  baseline?: boolean;
  critic?: boolean;
  maxCalls?: number;
}

/** Push-based queue exposed as an async iterator. */
function channel<T>() {
  const items: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    push(item: T) {
      items.push(item);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async *drain(): AsyncGenerator<T> {
      for (;;) {
        while (items.length) yield items.shift()!;
        if (closed) return;
        await new Promise<void>((r) => (wake = r));
        wake = null;
      }
    },
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function runAgent(
  deps: AgentDeps,
  scenario: Scenario,
  options: AgentOptions = {},
): AsyncGenerator<AgentEvent> {
  const out = channel<AgentEvent>();
  const result: AgentResult = {
    status: "ok",
    scenario,
    plan: null,
    engine: null,
    brief: null,
    notes: [],
    draft: null,
    critique: [],
    program: null,
    baseline: null,
    warnings: [],
    timings: {},
  };
  const warn = (m: string) => {
    result.warnings.push(m);
    out.push({ type: "warning", message: m });
  };
  const timed = async <T>(state: AgentState, fn: () => Promise<T>): Promise<T> => {
    out.push({ type: "state", state });
    const started = Date.now();
    try {
      return await fn();
    } finally {
      result.timings[state] = Date.now() - started;
    }
  };

  const run = async () => {
    await timed("UNDERSTAND", async () => {});

    const baselineStarted = Date.now();
    const baseline =
      options.baseline === false
        ? Promise.resolve(null)
        : generateBaseline(deps.llm, scenario)
            .catch((e) => {
              warn(`LLM-only baseline failed: ${message(e)}`);
              return null;
            })
            .then((b) => {
              result.timings.BASELINE = Date.now() - baselineStarted;
              result.baseline = b;
              out.push({ type: "baseline", baseline: b });
              return b;
            });

    result.plan = await timed("PLAN_DOMAINS", async () =>
      options.domains
        ? {
            source: "fallback" as const,
            domains: options.domains.map((domain) => ({ domain, reason: "Chosen by caller" })),
          }
        : planDomains(deps.llm, scenario),
    );
    out.push({ type: "plan", plan: result.plan });

    const engine = await timed("QUERY_QLOO", () =>
      runBridgeEngine(deps.qloo, scenario, {
        domains: result.plan!.domains.map((d) => d.domain),
        maxCalls: options.maxCalls,
        onEvent: (event) => out.push({ type: "engine", event }),
      }),
    );
    result.engine = engine;
    out.push({ type: "engine_result", result: engine });

    if (engine.status === "insufficient_evidence") {
      result.status = "insufficient_evidence";
    } else {
      const brief = buildBrief(scenario, engine);
      result.brief = brief;
      const bridgeRef = options.bridgeRef ?? "B1";

      await timed("DESIGN", async () => {
        const [notes, draft] = await Promise.allSettled([
          writeBridgeNotes(deps.llm, brief),
          generateProgram(deps.llm, brief, bridgeRef),
        ]);
        if (notes.status === "fulfilled") {
          result.notes = notes.value;
          out.push({ type: "notes", notes: notes.value });
        } else warn(`Bridge notes failed: ${message(notes.reason)}`);
        if (draft.status === "fulfilled") {
          result.draft = result.program = draft.value;
          out.push({ type: "program_draft", program: draft.value });
        } else {
          result.status = "partial";
          warn(`Program generation failed: ${message(draft.reason)}`);
        }
      });

      if (result.draft && options.critic !== false) {
        await timed("CRITIQUE", async () => {
          try {
            const c = await critiqueProgram(deps.llm, brief, result.draft!);
            result.critique = c.issues;
            result.program = c.revised;
            out.push({ type: "critique", issues: c.issues, program: c.revised });
          } catch (e) {
            warn(`Critic failed; keeping the first draft: ${message(e)}`);
          }
        });
      }
    }

    await timed("EXPLAIN", async () => {
      await baseline;
    });
    out.push({ type: "state", state: "DONE" });
    out.push({ type: "done", result });
  };

  run()
    .catch((e) => {
      result.status = "partial";
      warn(`Agent stopped: ${message(e)}`);
      out.push({ type: "done", result });
    })
    .finally(() => out.close());
  return out.drain();
}

/** Run to completion and return the final result (for scripts and tests). */
export async function runAgentToCompletion(
  deps: AgentDeps,
  scenario: Scenario,
  options: AgentOptions = {},
  onEvent?: (e: AgentEvent) => void,
): Promise<AgentResult> {
  let final: AgentResult | null = null;
  for await (const e of runAgent(deps, scenario, options)) {
    onEvent?.(e);
    if (e.type === "done") final = e.result;
  }
  if (!final) throw new Error("Agent ended without a result");
  return final;
}
