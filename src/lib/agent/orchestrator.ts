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
import {
  applyDirectives,
  interpretInstructions,
  NO_DIRECTIVES,
  type Directives,
} from "./directives";
import type { EngineOptions, PlaceTheme } from "@/lib/engine/context";
import { isStrongBridge } from "@/lib/engine/select";
import { betterResult, reviewEvidence } from "./review";
import { findPlaceTheme } from "./tools";
import { writeInvitations, type Invitations } from "./invites";
import { writeBridgeNotes, type BridgeNote } from "./notes";
import { planDomains, type DomainPlan } from "./planner";
import { generateProgram, type Program } from "./program";

/**
 * The single agent orchestrator (plan §9):
 *   UNDERSTAND → PLAN_DOMAINS → QUERY_QLOO → REVIEW (up to 2 rounds) → DESIGN → CRITIQUE →
 *   EXPLAIN → DONE
 * Qloo scoring is deterministic (bridge engine). The LLM reads the organizer's instructions,
 * reviews the evidence and decides whether to investigate further with tools (another kind of
 * culture, places on a theme), then designs, critiques and explains. Every decision is
 * reported as an event. The LLM-only baseline runs in parallel from the start.
 */

export type AgentState =
  | "UNDERSTAND"
  | "PLAN_DOMAINS"
  | "QUERY_QLOO"
  | "REVIEW"
  | "DESIGN"
  | "CRITIQUE"
  | "EXPLAIN"
  | "DONE";

/** One thing the agent decided or did, in plain words, for the decision log. */
export interface AgentDecision {
  step: "instructions" | "plan" | "review" | "tool" | "outcome";
  text: string;
}

/** What the final Qloo search covered, so it can be reproduced exactly. */
export interface Investigation {
  domains: DomainKey[];
  placeThemes: PlaceTheme[];
  rounds: number;
}

export type AgentStatus = "ok" | "insufficient_evidence" | "partial";

export interface AgentResult {
  status: AgentStatus;
  scenario: Scenario;
  plan: DomainPlan | null;
  directives: Directives;
  investigation: Investigation | null;
  decisions: AgentDecision[];
  engine: EngineResult | null;
  brief: EvidenceBrief | null;
  notes: BridgeNote[];
  draft: Program | null;
  critique: CritiqueIssue[];
  program: Program | null;
  baseline: BaselineProgram | null;
  /** One invitation per group, pitched in that group's own tastes. */
  invitations: Invitations | null;
  warnings: string[];
  /** Why the run stopped early (Qloo unavailable, cancelled...), or null. */
  failure: string | null;
  timings: Partial<Record<AgentState | "BASELINE", number>>;
}

export type AgentEvent =
  | { type: "state"; state: AgentState }
  | { type: "plan"; plan: DomainPlan }
  | { type: "decision"; decision: AgentDecision }
  | { type: "engine"; event: EngineEvent }
  | { type: "engine_result"; result: EngineResult }
  | { type: "notes"; notes: BridgeNote[] }
  | { type: "program_draft"; program: Program }
  | { type: "critique"; issues: CritiqueIssue[]; program: Program }
  | { type: "baseline"; baseline: BaselineProgram | null }
  | { type: "invitations"; invitations: Invitations }
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
  /** Let the agent review the evidence and investigate further (default true). */
  review?: boolean;
  maxCalls?: number;
  /** Abort the run (e.g. the browser disconnected). Stops further Qloo and LLM calls. */
  signal?: AbortSignal;
}

class CancelledError extends Error {
  constructor() {
    super("The run was cancelled");
    this.name = "CancelledError";
  }
}

/** Clients that refuse new calls once the signal fires; LLM requests are also aborted mid-flight. */
function abortable(deps: AgentDeps, signal?: AbortSignal): AgentDeps {
  if (!signal) return deps;
  const guard = <T>(fn: () => Promise<T>) => {
    if (signal.aborted) return Promise.reject(new CancelledError());
    return fn();
  };
  const { qloo, llm } = deps;
  return {
    qloo: {
      searchEntities: (i) => guard(() => qloo.searchEntities(i)),
      searchTags: (i) => guard(() => qloo.searchTags(i)),
      getInsights: (i) => guard(() => qloo.getInsights(i)),
      compareProfiles: (i) => guard(() => qloo.compareProfiles(i)),
    },
    llm: {
      provider: llm.provider,
      model: llm.model,
      generateText: (req) => guard(() => llm.generateText({ ...req, signal })),
    },
  };
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

const MAX_REVIEW_ROUNDS = 2;

const DOMAIN_NAMES: Record<DomainKey, string> = {
  tvShow: "TV shows",
  artist: "music",
  book: "books",
  podcast: "podcasts",
  place: "local places",
  movie: "films",
  videoGame: "video games",
};
const domainName = (d: DomainKey) => DOMAIN_NAMES[d];

function describeDirectives(
  d: Directives,
  decide: (step: AgentDecision["step"], text: string) => void,
) {
  const parts = [
    d.skipDomains.length ? `skip ${d.skipDomains.map(domainName).join(", ")}` : "",
    d.addDomains.length ? `add ${d.addDomains.map(domainName).join(", ")}` : "",
    d.placeThemes.length ? `look for ${d.placeThemes.join(" and ")} places` : "",
    d.audience ? `audience: ${d.audience.replace("_", " ")}` : "",
    ...d.rules.map((r) => r.trim().replace(/\.+$/, "")),
  ].filter(Boolean);
  decide(
    "instructions",
    parts.length
      ? `From your instructions: ${parts.join("; ")}.`
      : "Read your instructions; nothing in them changes the search.",
  );
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function runAgent(
  rawDeps: AgentDeps,
  scenario: Scenario,
  options: AgentOptions = {},
): AsyncGenerator<AgentEvent> {
  const deps = abortable(rawDeps, options.signal);
  const checkCancelled = () => {
    if (options.signal?.aborted) throw new CancelledError();
  };
  const out = channel<AgentEvent>();
  const result: AgentResult = {
    status: "ok",
    scenario,
    plan: null,
    directives: NO_DIRECTIVES,
    investigation: null,
    decisions: [],
    engine: null,
    brief: null,
    notes: [],
    draft: null,
    critique: [],
    program: null,
    baseline: null,
    invitations: null,
    warnings: [],
    failure: null,
    timings: {},
  };
  const warn = (m: string) => {
    result.warnings.push(m);
    out.push({ type: "warning", message: m });
  };
  const decide = (step: AgentDecision["step"], text: string) => {
    const decision = { step, text };
    result.decisions.push(decision);
    out.push({ type: "decision", decision });
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

    const [plan, directives] = await timed("PLAN_DOMAINS", () =>
      Promise.all([
        options.domains
          ? {
              source: "fallback" as const,
              domains: options.domains.map((domain) => ({ domain, reason: "Chosen by caller" })),
            }
          : planDomains(deps.llm, scenario),
        interpretInstructions(deps.llm, scenario).catch((e) => {
          warn(`Couldn't read the instructions: ${message(e)}`);
          return NO_DIRECTIVES;
        }),
      ]),
    );
    const domains = applyDirectives(
      plan.domains.map((d) => d.domain),
      directives,
    );
    // The plan as it will actually run, after the organizer's skips and additions.
    result.plan = {
      ...plan,
      domains: domains.map(
        (domain) =>
          plan.domains.find((d) => d.domain === domain) ?? {
            domain,
            reason: "Asked for in your instructions",
          },
      ),
    };
    result.directives = directives;
    out.push({ type: "plan", plan: result.plan });
    if (scenario.instructions.trim()) describeDirectives(directives, decide);
    checkCancelled();
    const placeThemes: PlaceTheme[] = [];
    const triedThemes: string[] = [];
    const addTheme = async (query: string) => {
      triedThemes.push(query.toLowerCase());
      const theme = await findPlaceTheme(deps.qloo, query).catch(() => null);
      if (theme && !placeThemes.some((t) => t.tagId === theme.tagId)) {
        placeThemes.push(theme);
        decide("tool", `Looked up the Qloo place tag “${theme.name}” for “${query}”.`);
        return;
      }
      decide("tool", `Qloo has no new place tag for “${query}”, so it was skipped.`);
    };
    for (const t of directives.placeThemes) await addTheme(t);
    decide(
      "plan",
      `Searching ${domains.map(domainName).join(", ")}${
        placeThemes.length
          ? `, plus ${placeThemes.map((t) => t.name.toLowerCase()).join(" and ")} places`
          : ""
      }.`,
    );

    const search = (forward?: (e: EngineEvent) => boolean) =>
      runBridgeEngine(deps.qloo, scenario, {
        domains: [...domains],
        placeThemes: [...placeThemes],
        familyFriendly: directives.audience === "all_ages" || directives.audience === "teens",
        adultsOnly: directives.audience === "adults",
        maxCalls: options.maxCalls,
        onEvent: (event) => {
          if (!forward || forward(event)) out.push({ type: "engine", event });
        },
      } satisfies EngineOptions);

    let engine = await timed("QUERY_QLOO", () => search());
    let rounds = 1;
    checkCancelled();

    // REVIEW: the agent decides whether the evidence is good enough or worth another search.
    const reviewable =
      options.review !== false &&
      !engine.warnings.some((w) => w.includes("failed") || w.includes("confirmed seeds"));
    const strongCount = (r: EngineResult) => r.bridges.filter(isStrongBridge).length;
    if (reviewable) {
      await timed("REVIEW", async () => {
        for (let round = 0; round < MAX_REVIEW_ROUNDS; round++) {
          if (strongCount(engine) >= 3 && !scenario.instructions.trim()) {
            decide(
              "review",
              "Three bridges with strong support from both groups. No further search needed.",
            );
            return;
          }
          let review;
          try {
            review = await reviewEvidence(
              deps.llm,
              scenario,
              engine,
              domains,
              directives,
              triedThemes,
            );
          } catch (e) {
            warn(`Review failed; keeping the current evidence: ${message(e)}`);
            return;
          }
          decide("review", review.assessment);
          if (review.actions.length === 0) {
            if (review.wanted > 0) {
              decide("outcome", "No new searches left to try, so these bridges stand.");
            }
            return;
          }

          const before = { domains: domains.length, themes: placeThemes.length };
          for (const a of review.actions) {
            if (a.tool === "explore_domain") {
              domains.push(a.domain);
              decide("tool", `Searching ${domainName(a.domain)} too: ${a.reason}`);
            } else {
              await addTheme(a.theme);
            }
          }
          if (domains.length === before.domains && placeThemes.length === before.themes) return;
          checkCancelled();

          // Only progress for the new searches; repeated queries come from the request cache.
          const newDomains = domains.slice(before.domains);
          const newThemes = placeThemes.length > before.themes;
          const next = await search((e) =>
            "domain" in e && e.domain
              ? newDomains.includes(e.domain) || (e.domain === "place" && newThemes)
              : false,
          );
          rounds++;
          const kept = betterResult(engine, next);
          const [was, now] = [strongCount(engine), strongCount(next)];
          decide(
            "outcome",
            kept !== next
              ? "The extra search didn't beat the earlier bridges, so they stay."
              : now > was
                ? `Now ${now} strong bridge${now === 1 ? "" : "s"} (was ${was}).`
                : "Found higher-scoring bridges, so the results were updated.",
          );
          if (kept !== next) {
            // Reproduce exactly what produced the kept result.
            domains.splice(before.domains);
            placeThemes.splice(before.themes);
            return;
          }
          engine = next;
        }
      });
    }
    result.investigation = { domains: [...domains], placeThemes: [...placeThemes], rounds };
    result.engine = engine;
    out.push({ type: "engine_result", result: engine });
    checkCancelled();

    if (engine.status === "insufficient_evidence") {
      result.status = "insufficient_evidence";
    } else {
      const brief = buildBrief(scenario, engine, result.directives);
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

      checkCancelled();
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
      const invite = async () => {
        if (!result.brief || !result.program) return;
        try {
          result.invitations = await writeInvitations(deps.llm, result.brief, result.program);
          out.push({ type: "invitations", invitations: result.invitations });
        } catch (e) {
          warn(`Invitations failed: ${message(e)}`);
        }
      };
      await Promise.all([invite(), baseline]);
    });
    out.push({ type: "state", state: "DONE" });
    out.push({ type: "done", result });
  };

  run()
    .catch((e) => {
      result.status = "partial";
      result.failure = message(e);
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
