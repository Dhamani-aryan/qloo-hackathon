"use client";

import { compareStats, normName as norm, splitAnchor } from "@/lib/agent/ablation";
import type { BaselineProgram } from "@/lib/agent/baseline";
import type { Program } from "@/lib/agent/program";
import type { Scenario } from "@/lib/engine/types";
import { Kicker, More, Rule, Spinner, Title, cx } from "../ui";

/**
 * With vs without Qloo, shown in the product. The LLM-only version got the same objective and
 * the same favourites, but no Qloo evidence. Counting logic lives in @/lib/agent/ablation.
 */

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
        <Kicker>Evidence comparison</Kicker>
        <Title level={2} className="mt-4 max-w-3xl">
          Two proposals. Different evidence.
        </Title>
        <p className="mt-4 max-w-2xl text-ink-2">
          Same favourites, organizer notes, practical constraints and model. One proposal uses Qloo;
          the other uses the model’s knowledge. Source counts show provenance, not which program
          people will prefer.
        </p>
      </div>

      <dl className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <Figure
          label="Unique new anchors with Qloo support"
          ours={stats.ours.discovered}
          theirs={0}
        />
        <Figure
          label="Named titles without Qloo validation"
          ours={0}
          theirs={stats.baseline.unverified}
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
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.activity}</p>
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
                    {(s.anchors ?? splitAnchor(s.anchor)).map((n, i, all) => (
                      <span key={n}>
                        <span className={cx(seeds.has(norm(n)) ? "text-muted" : "text-warn")}>
                          {n}
                        </span>
                        {i < all.length - 1 && <span className="text-muted">, </span>}
                      </span>
                    ))}
                    {!s.anchor && !s.anchors?.length && (
                      <span className="text-muted">No anchor</span>
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.activity}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">
              Grey: a supplied favourite. <span className="text-warn">Amber</span>: a model proposal
              without Qloo validation. Unvalidated does not mean false or unsuitable; organizer
              feedback is still needed for both plans.
            </p>
          </div>
        </div>
      </More>
    </section>
  );
}

function Figure({ label, ours, theirs }: { label: string; ours: number; theirs: number }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-3 flex items-baseline gap-6">
        <span>
          <span className="figures font-display text-5xl leading-none text-bridge">{ours}</span>
          <span className="mt-1 block text-[11px] text-muted">with Qloo</span>
        </span>
        <span>
          <span className="figures font-display text-5xl leading-none text-ink-2">{theirs}</span>
          <span className="mt-1 block text-[11px] text-muted">model only</span>
        </span>
      </dd>
    </div>
  );
}

export { compareStats, splitAnchor };
