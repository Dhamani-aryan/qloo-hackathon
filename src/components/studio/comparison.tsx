"use client";

import type { BaselineProgram } from "@/lib/agent/baseline";
import type { Program } from "@/lib/agent/program";
import type { Scenario } from "@/lib/engine/types";
import { Kicker, More, Rule, Spinner, Title, cx } from "../ui";

/**
 * With vs without Qloo (plan §14 ablation, shown in the product). The LLM-only version got
 * the same objective and the same favourites, but no Qloo evidence.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split an anchor like "Lady Bird, Cinema Paradiso, and Just Kids" into names. */
export function splitAnchor(anchor: string | null): string[] {
  if (!anchor) return [];
  return anchor
    .split(/,\s*|\s+and\s+|\s*&\s*|;\s*/)
    .map((s) => s.replace(/^and\s+/i, "").trim())
    .filter(Boolean);
}

export interface ComparisonStats {
  ours: { anchored: number; discovered: number; evidence: number; sessions: number };
  baseline: { named: number; reusedSeeds: number; unverified: number; sessions: number };
}

export function compareStats(
  program: Program,
  baseline: BaselineProgram,
  scenario: Scenario,
): ComparisonStats {
  const seeds = new Set([...scenario.a.seeds, ...scenario.b.seeds].map((s) => norm(s.name)));
  const ourEntities = program.sessions.flatMap((s) => (s.entity ? [s.entity.name] : []));
  const theirs = baseline.sessions.flatMap((s) => splitAnchor(s.anchor));
  const reused = theirs.filter((n) => seeds.has(norm(n)));
  return {
    ours: {
      anchored: ourEntities.length,
      discovered: ourEntities.filter((n) => !seeds.has(norm(n))).length,
      evidence: program.evidenceIds.length,
      sessions: program.sessions.length,
    },
    baseline: {
      named: theirs.length,
      reusedSeeds: reused.length,
      unverified: theirs.length - reused.length,
      sessions: baseline.sessions.length,
    },
  };
}

function headline(stats: ComparisonStats): string {
  const { baseline } = stats;
  if (baseline.named > 0 && baseline.unverified === 0) {
    return "Without Qloo, the model could only reuse the favourites it was given.";
  }
  if (baseline.unverified > baseline.reusedSeeds) {
    return "Without Qloo, the model's new picks are guesses with no evidence behind them.";
  }
  return "Without Qloo, the program has nothing to stand on but the model's intuition.";
}

export function Comparison({
  program,
  baseline,
  scenario,
  pending,
}: {
  program: Program;
  baseline: BaselineProgram | null;
  scenario: Scenario;
  pending: boolean;
}) {
  if (!baseline) {
    return (
      <section>
        <Rule />
        <div className="pt-8">
          <Kicker>With and without Qloo</Kicker>
          <div className="mt-3">
            {pending ? (
              <Spinner label="The model-only version is still being written…" />
            ) : (
              <p className="text-sm text-muted">
                The model-only comparison isn&apos;t available for this run.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }
  const seeds = new Set([...scenario.a.seeds, ...scenario.b.seeds].map((s) => norm(s.name)));
  const stats = compareStats(program, baseline, scenario);

  return (
    <section aria-label="With versus without Qloo">
      <div className="border-t-2 border-ink pt-10">
        <Kicker>Why Qloo matters</Kicker>
        <Title level={2} className="mt-4 max-w-3xl">
          {headline(stats)}
        </Title>
        <p className="mt-4 max-w-2xl text-ink-2">
          Same favourites, same AI, with and without Qloo.
        </p>
      </div>

      <dl className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <Figure
          label="New titles backed by both groups' data"
          ours={stats.ours.discovered}
          theirs={0}
        />
        <Figure
          label="Unverified guesses (lower is better)"
          ours={0}
          theirs={stats.baseline.unverified}
          lowerIsBetter
        />
        <Figure label="Qloo evidence citations" ours={stats.ours.evidence} theirs={0} />
      </dl>

      <More className="mt-12" label="Compare the two plans session by session">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="flex items-baseline justify-between gap-3 border-b border-ink pb-3">
              <span className="font-display text-xl">With Qloo</span>
              <span className="truncate text-xs text-muted">{program.title}</span>
            </p>
            <ol>
              {program.sessions.map((s) => (
                <li key={s.number} className="border-b border-line py-3.5">
                  <p className="text-sm">
                    <span className="figures text-muted">{s.number}.</span> {s.title}
                  </p>
                  <p className="mt-1 text-xs">
                    {s.entity ? (
                      <>
                        <span className="text-bridge">{s.entity.name}</span>
                        <span className="text-muted">
                          {" "}
                          ·{" "}
                          {seeds.has(norm(s.entity.name))
                            ? "one of the favourites"
                            : "found by Qloo, supported by both groups"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Making session</span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="flex items-baseline justify-between gap-3 border-b border-ink pb-3">
              <span className="font-display text-xl text-ink-2">Model only</span>
              <span className="truncate text-xs text-muted">{baseline.title}</span>
            </p>
            <ol>
              {baseline.sessions.map((s) => (
                <li key={s.number} className="border-b border-line py-3.5">
                  <p className="text-sm text-ink-2">
                    <span className="figures text-muted">{s.number}.</span> {s.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {splitAnchor(s.anchor).map((n, i, all) => (
                      <span key={n}>
                        <span className={cx(seeds.has(norm(n)) ? "text-muted" : "text-warn")}>
                          {n}
                        </span>
                        {i < all.length - 1 && <span className="text-muted">, </span>}
                      </span>
                    ))}
                    {!s.anchor && <span className="text-muted">No anchor</span>}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">
              Grey: a favourite it was given. <span className="text-warn">Amber</span>: named with
              no evidence that both groups would want it.
            </p>
          </div>
        </div>
      </More>
    </section>
  );
}

function Figure({
  label,
  ours,
  theirs,
  lowerIsBetter = false,
}: {
  label: string;
  ours: number;
  theirs: number;
  lowerIsBetter?: boolean;
}) {
  const oursBetter = lowerIsBetter ? ours <= theirs : ours >= theirs;
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-3 flex items-baseline gap-6">
        <span>
          <span
            className={cx(
              "figures font-display text-5xl leading-none",
              oursBetter ? "text-bridge" : "text-ink-2",
            )}
          >
            {ours}
          </span>
          <span className="mt-1 block text-[11px] text-muted">with Qloo</span>
        </span>
        <span>
          <span
            className={cx(
              "figures font-display text-5xl leading-none",
              lowerIsBetter && theirs > 0 ? "text-warn" : "text-muted/70",
            )}
          >
            {theirs}
          </span>
          <span className="mt-1 block text-[11px] text-muted">model only</span>
        </span>
      </dd>
    </div>
  );
}
