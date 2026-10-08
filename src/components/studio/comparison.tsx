"use client";

import type { BaselineProgram } from "@/lib/agent/baseline";
import type { Program } from "@/lib/agent/program";
import type { Scenario } from "@/lib/engine/types";
import { Badge, Card, Eyebrow, Heading, Spinner, cx } from "../ui";

/**
 * With vs without Qloo (plan §14 ablation, shown in the product). The LLM-only version got
 * the same objective and the same seed names but no Qloo evidence.
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
      <Card>
        <Heading level={2}>With vs without Qloo</Heading>
        <div className="mt-3">
          {pending ? (
            <Spinner label="The LLM-only version is still being written…" />
          ) : (
            <p className="text-sm text-muted">
              The LLM-only comparison isn&apos;t available for this run.
            </p>
          )}
        </div>
      </Card>
    );
  }
  const seeds = new Set([...scenario.a.seeds, ...scenario.b.seeds].map((s) => norm(s.name)));
  const stats = compareStats(program, baseline, scenario);

  return (
    <section className="space-y-5" aria-label="With versus without Qloo">
      <div className="max-w-3xl space-y-2">
        <Eyebrow tone="bridge">Proof of dependence</Eyebrow>
        <Heading level={2}>With vs without Qloo</Heading>
        <p className="text-muted">
          The same objective and the same favourites went to the same LLM, once with Qloo&apos;s
          evidence and once without.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="New entities found beyond the seeds"
          ours={stats.ours.discovered}
          theirs={stats.baseline.unverified}
          theirsNote="unverified guesses"
        />
        <Stat
          label="Session anchors backed by both communities' Qloo data"
          ours={stats.ours.anchored}
          theirs={0}
        />
        <Stat label="Qloo evidence citations" ours={stats.ours.evidence} theirs={0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card tone="bridge" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Heading level={3}>COMMON GROUND</Heading>
            <Badge tone="bridge">Qloo evidence</Badge>
          </div>
          <p className="text-sm font-medium">{program.title}</p>
          <ol className="space-y-2">
            {program.sessions.map((s) => (
              <li key={s.number} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <p className="font-medium">
                  {s.number}. {s.title}
                </p>
                <p className="mt-0.5 text-xs">
                  {s.entity ? (
                    <>
                      <span className="font-medium text-bridge">{s.entity.name}</span>{" "}
                      <span className="text-muted">
                        ·{" "}
                        {seeds.has(norm(s.entity.name))
                          ? "a seed"
                          : "discovered by Qloo, supported by both sides"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">Co-creation session</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Heading level={3}>LLM only</Heading>
            <Badge>No Qloo</Badge>
          </div>
          <p className="text-sm font-medium">{baseline.title}</p>
          <p className="text-xs text-muted">Bridge chosen by the model: {baseline.bridge}</p>
          <ol className="space-y-2">
            {baseline.sessions.map((s) => (
              <li key={s.number} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <p className="font-medium">
                  {s.number}. {s.title}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-1 text-xs">
                  {splitAnchor(s.anchor).map((n) => (
                    <span
                      key={n}
                      className={cx(
                        "rounded px-1.5 py-0.5",
                        seeds.has(norm(n)) ? "bg-paper text-muted" : "bg-warn-soft text-warn",
                      )}
                      title={
                        seeds.has(norm(n))
                          ? "One of the seeds it was given"
                          : "Not checked against Qloo"
                      }
                    >
                      {n}
                      {seeds.has(norm(n)) ? " · seed" : " · unverified"}
                    </span>
                  ))}
                  {!s.anchor && <span className="text-muted">No anchor</span>}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <p className="text-xs text-muted">
        “Seed” means the model reused a favourite it was given; “unverified” means it named
        something without any evidence that both communities would want it.
      </p>
    </section>
  );
}

function Stat({
  label,
  ours,
  theirs,
  theirsNote,
}: {
  label: string;
  ours: number;
  theirs: number;
  theirsNote?: string;
}) {
  return (
    <Card className="space-y-2 p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-end gap-4">
        <div>
          <p className="font-display text-3xl leading-none text-bridge">{ours}</p>
          <p className="text-[11px] text-muted">with Qloo</p>
        </div>
        <div>
          <p className="font-display text-3xl leading-none text-muted">{theirs}</p>
          <p className="text-[11px] text-muted">without{theirsNote ? ` (${theirsNote})` : ""}</p>
        </div>
      </div>
    </Card>
  );
}
