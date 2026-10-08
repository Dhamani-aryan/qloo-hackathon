"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent, AgentResult, AgentState } from "@/lib/agent/orchestrator";
import type { StreamEvent } from "@/lib/agent/replay";
import type { DomainKey, Scenario } from "@/lib/engine/types";
import { streamEvents } from "./api";

/** Client-side state of one agent run, built from the streamed events. */

export interface RunState {
  status: "idle" | "running" | "done" | "error" | "stopped";
  events: AgentEvent[];
  result: AgentResult | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** Set when the server replayed a cached earlier run. */
  replay: { recordedAt: number; originalMs: number } | null;
}

const IDLE: RunState = {
  status: "idle",
  events: [],
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  replay: null,
};

export function useAgentRun() {
  const [run, setRun] = useState<RunState>(IDLE);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async (scenario: Scenario, { fresh = false } = {}) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setRun({ ...IDLE, status: "running", startedAt: Date.now() });
    try {
      for await (const event of streamEvents<StreamEvent>(
        "/api/analysis",
        { scenario, fresh },
        controller.signal,
      )) {
        if (event.type === "replay") {
          setRun((r) => ({
            ...r,
            replay: { recordedAt: event.recordedAt, originalMs: event.originalMs },
          }));
          continue;
        }
        setRun((r) => ({
          ...r,
          events: [...r.events, event],
          ...(event.type === "done"
            ? { status: "done" as const, result: event.result, finishedAt: Date.now() }
            : {}),
        }));
      }
      setRun((r) =>
        r.status === "running"
          ? { ...r, status: "error", error: "The connection closed before the agent finished." }
          : r,
      );
    } catch (err) {
      if (controller.signal.aborted) {
        setRun((r) => ({ ...r, status: "stopped", finishedAt: Date.now() }));
      } else {
        setRun((r) => ({ ...r, status: "error", error: (err as Error).message }));
      }
    }
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    setRun(IDLE);
  }, []);

  return { run, start, stop, reset };
}

// ---------- derived views ----------

export const STAGES: { state: AgentState; label: string }[] = [
  { state: "UNDERSTAND", label: "Read the brief and confirmed profiles" },
  { state: "PLAN_DOMAINS", label: "Plan which cultural domains to explore" },
  { state: "QUERY_QLOO", label: "Query Qloo and validate against both communities" },
  { state: "DESIGN", label: "Design the program around the strongest bridge" },
  { state: "CRITIQUE", label: "Critique and revise the program" },
  { state: "EXPLAIN", label: "Wrap up and compare with the LLM-only version" },
];

export type StageStatus = "pending" | "active" | "done" | "skipped";

export function stageStatuses(run: RunState): Record<AgentState, StageStatus> {
  const seen = run.events.flatMap((e) => (e.type === "state" ? [e.state] : []));
  const last = seen.at(-1);
  const finished = run.status !== "running";
  const out = {} as Record<AgentState, StageStatus>;
  for (const { state } of STAGES) {
    out[state] = !seen.includes(state)
      ? finished && run.status === "done"
        ? "skipped"
        : "pending"
      : state === last && !finished
        ? "active"
        : "done";
  }
  return out;
}

export interface DomainProgress {
  domain: DomainKey;
  reason: string | null;
  queries: number;
  found: number;
  rejected: number;
  done: boolean;
}

/** Expected Qloo calls per domain: combined-top, popularity-capped, shortlist A, shortlist B. */
export const CALLS_PER_DOMAIN = 4;

export function domainProgress(run: RunState): DomainProgress[] {
  const plan = run.events.find((e) => e.type === "plan");
  if (!plan || plan.type !== "plan") return [];
  const engineDone = run.events.some((e) => e.type === "engine_result");
  return plan.plan.domains.map(({ domain, reason }) => {
    const p: DomainProgress = {
      domain,
      reason,
      queries: 0,
      found: 0,
      rejected: 0,
      done: engineDone,
    };
    for (const e of run.events) {
      if (e.type !== "engine") continue;
      const ev = e.event;
      if (ev.type === "qloo_query_done" && ev.domain === domain) p.queries++;
      if (ev.type === "candidate_found" && ev.domain === domain) p.found++;
      if (ev.type === "candidate_rejected" && ev.domain === domain) p.rejected++;
    }
    return p;
  });
}

export interface ActivityItem {
  key: string;
  text: string;
  tone: "neutral" | "ok" | "warn" | "bridge";
}

/** Recent real actions for the activity feed (no invented "thoughts"). */
export function activity(run: RunState, limit = 10): ActivityItem[] {
  const items: ActivityItem[] = [];
  run.events.forEach((e, i) => {
    const key = String(i);
    if (e.type === "plan") {
      items.push({
        key,
        text: `Planned ${e.plan.domains.length} domains to investigate`,
        tone: "neutral",
      });
    } else if (e.type === "engine") {
      const ev = e.event;
      if (ev.type === "qloo_query_done") {
        items.push({
          key,
          text: `Qloo ${ev.purpose.replace(/-/g, " ")}${ev.domain ? ` · ${ev.domain}` : ""}: ${ev.results} results in ${(ev.ms / 1000).toFixed(1)}s`,
          tone: "neutral",
        });
      } else if (ev.type === "candidate_rejected") {
        items.push({ key, text: `Rejected ${ev.name}: ${ev.reason}`, tone: "warn" });
      } else if (ev.type === "bridge_ranked") {
        items.push({
          key,
          text: `Bridge #${ev.rank}: ${ev.name} (Bridge Potential ${ev.bridgePotential})`,
          tone: "bridge",
        });
      } else if (ev.type === "warning") {
        items.push({ key, text: ev.message, tone: "warn" });
      }
    } else if (e.type === "notes") {
      items.push({ key, text: `Wrote notes for ${e.notes.length} bridges`, tone: "ok" });
    } else if (e.type === "program_draft") {
      items.push({ key, text: `Drafted “${e.program.title}”`, tone: "ok" });
    } else if (e.type === "critique") {
      items.push({
        key,
        text: `Critic found ${e.issues.length} issue${e.issues.length === 1 ? "" : "s"} and revised the program`,
        tone: "ok",
      });
    } else if (e.type === "baseline") {
      items.push({
        key,
        text: e.baseline ? "LLM-only comparison ready" : "LLM-only comparison failed",
        tone: "neutral",
      });
    } else if (e.type === "warning") {
      items.push({ key, text: e.message, tone: "warn" });
    }
  });
  return items.slice(-limit).reverse();
}

export function hasEvent(run: RunState, type: AgentEvent["type"]): boolean {
  return run.events.some((e) => e.type === type);
}

/** The latest of each artifact, available as soon as its event arrives (before `done`). */
export function artifacts(run: RunState) {
  let engine = run.result?.engine ?? null;
  let notes = run.result?.notes ?? [];
  let program = run.result?.program ?? null;
  let critique = run.result?.critique ?? [];
  let baseline = run.result?.baseline ?? null;
  for (const e of run.events) {
    if (e.type === "engine_result") engine = e.result;
    if (e.type === "notes") notes = e.notes;
    if (e.type === "program_draft" && !program) program = e.program;
    if (e.type === "critique") {
      program = e.program;
      critique = e.issues;
    }
    if (e.type === "baseline") baseline = e.baseline;
  }
  return { engine, notes, program, critique, baseline, brief: run.result?.brief ?? null };
}
