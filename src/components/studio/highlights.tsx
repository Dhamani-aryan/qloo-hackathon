"use client";

import { compareStats } from "@/lib/agent/ablation";
import type { BaselineProgram } from "@/lib/agent/baseline";
import type { AgentDecision } from "@/lib/agent/orchestrator";
import type { Program } from "@/lib/agent/program";
import type { EngineResult, Scenario } from "@/lib/engine/types";
import { ordinal } from "../ui";

/**
 * The three things a first-time visitor should see without clicking: why these bridges beat the
 * obvious pick, what Qloo added over the same model alone, and what the agent decided.
 */
export function Highlights({
  engine,
  scenario,
  program,
  baseline,
  decisions,
  running,
}: {
  engine: EngineResult;
  scenario: Scenario;
  program: Program | null;
  baseline: BaselineProgram | null;
  decisions: AgentDecision[];
  running: boolean;
}) {
  const top = engine.bridges[0];
  const obvious = engine.obvious;
  const stats = program && baseline ? compareStats(program, baseline, scenario) : null;
  const shown = decisions.filter((d) => d.step !== "plan").slice(-2);

  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm md:grid-cols-3">
      {top && (
        <Item term="Why these, not the obvious pick">
          {obvious ? (
            <>
              Everyone likes <b>{obvious.entity.name}</b>
              {obvious.popularity !== null && (
                <> (top {topShare(obvious.popularity)}% for popularity)</>
              )}
              .{" "}
            </>
          ) : null}
          <b>{top.entity.name}</b> ranks {ordinal(top.pct.A ?? 0)} and {ordinal(top.pct.B ?? 0)} for
          the two groups
          {top.popularity !== null &&
          obvious?.popularity != null &&
          top.popularity < obvious.popularity ? (
            <> and is less mainstream</>
          ) : null}
          .
        </Item>
      )}
      <Item term="What Qloo added">
        {stats ? (
          <>
            Without Qloo, the same AI reused <b>{stats.baseline.reusedSeeds}</b> of your favourites
            and named <b>{stats.baseline.unverified}</b> titles with no evidence. With it:{" "}
            <b>{stats.ours.discovered}</b> new titles both groups support.
          </>
        ) : running ? (
          "Comparing with the same AI working without Qloo…"
        ) : (
          "The comparison isn't available for this run."
        )}
      </Item>
      <Item term="What the agent did">
        {shown.length ? (
          <ul className="space-y-1">
            {shown.map((d, i) => (
              <li key={i}>{d.text}</li>
            ))}
          </ul>
        ) : running ? (
          "Searching Qloo…"
        ) : (
          "Searched the planned kinds of culture; no extra search was needed."
        )}
      </Item>
    </dl>
  );
}

/** Popularity percentile as "top N%" (0.92 → 8), never below 1. */
const topShare = (p: number) => Math.max(1, Math.round((1 - p) * 100));

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper p-5">
      <dt className="text-xs font-semibold tracking-wider text-bridge uppercase">{term}</dt>
      <dd className="mt-2 leading-relaxed text-ink-2 [&_b]:font-medium [&_b]:text-ink">
        {children}
      </dd>
    </div>
  );
}
