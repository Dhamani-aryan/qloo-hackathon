"use client";

import { useState } from "react";
import type { BridgeNote } from "@/lib/agent/notes";
import type { EngineResult, Evidence, Scenario, ScoredCandidate } from "@/lib/engine/types";
import {
  Button,
  Dot,
  Kicker,
  Lede,
  Note,
  Rule,
  Spinner,
  SupportBars,
  Thumb,
  Title,
  cx,
  ordinal,
  pct,
  typeLabel,
} from "../ui";

type Names = (ids: string[]) => string[];

export function BridgesScreen({
  scenario,
  engine,
  notes,
  programReady,
  programFailed = false,
  onContinue,
  onRetry,
}: {
  scenario: Scenario;
  engine: EngineResult;
  notes: BridgeNote[];
  programReady: boolean;
  /** The run finished without a program (LLM failure); the bridges are still valid. */
  programFailed?: boolean;
  onContinue: () => void;
  onRetry?: () => void;
}) {
  const seedName = new Map(
    [...scenario.a.seeds, ...scenario.b.seeds].map((s) => [s.entityId, s.name]),
  );
  const names: Names = (ids) => ids.map((id) => seedName.get(id) ?? "a favourite");
  const labels: [string, string] = [scenario.a.label, scenario.b.label];
  const evidence = new Map(engine.evidence.map((e) => [e.evidenceId, e]));
  const top = engine.bridges[0];

  return (
    <div>
      <section className="max-w-3xl space-y-5">
        <Title>Where they meet.</Title>
        <Lede>
          A bridge is something both communities rank highly, scored separately for each, that
          isn&apos;t simply what everyone likes. The numbers are Qloo&apos;s; the short notes are
          the agent&apos;s reading of them.
        </Lede>
      </section>

      {top && engine.obvious && (
        <Reveal obvious={engine.obvious} discovered={top} labels={labels} />
      )}

      <section className="mt-20">
        <div className="flex items-baseline justify-between gap-4">
          <Title level={2}>The bridges</Title>
          <p className="hidden text-xs text-muted sm:block">
            Ranked by Bridge Potential, a transparent score, not a probability.
          </p>
        </div>
        <ol className="mt-6 border-t border-ink">
          {engine.bridges.map((b, i) => (
            <BridgeRow
              key={b.entity.id}
              rank={i + 1}
              bridge={b}
              note={notes.find((n) => n.ref === `B${i + 1}`)}
              labels={labels}
              names={names}
              evidence={evidence}
              defaultOpen={i === 0}
            />
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-12 md:grid-cols-2">
        {engine.themes.length > 0 && (
          <div>
            <Kicker>Shared themes</Kicker>
            <p className="mt-2 text-sm text-muted">
              Found in both profiles by Qloo&apos;s Analysis Compare.
            </p>
            <ul className="mt-4">
              {engine.themes.slice(0, 6).map((t) => (
                <li key={t.tagId} className="border-t border-line py-2.5 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    <span className="text-a">{names(t.supportingSeeds.A)[0]}</span>
                    <span className="mx-1.5">↔</span>
                    <span className="text-b">{names(t.supportingSeeds.B)[0]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          {engine.runnersUp.length > 0 && (
            <>
              <Kicker>Also in the running</Kicker>
              <ul className="mt-4">
                {engine.runnersUp.slice(0, 5).map((r) => (
                  <li
                    key={r.entity.id}
                    className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 text-sm"
                  >
                    <span className="truncate">
                      {r.entity.name}{" "}
                      <span className="text-xs text-muted">· {typeLabel(r.domain)}</span>
                    </span>
                    <span className="figures shrink-0 text-xs text-muted">{r.bridgePotential}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Rejections engine={engine} />
        </div>
      </section>

      <div className="mt-16 flex flex-col gap-4 border-t border-ink pt-6 sm:flex-row sm:items-center sm:justify-between">
        {programFailed ? (
          <>
            <p className="text-warn">
              The language model failed to design a program this time. The bridges above are
              complete and come straight from Qloo.
            </p>
            {onRetry && (
              <Button variant="quiet" onClick={onRetry}>
                Run again
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-ink-2">
              {programReady
                ? `The program is built around ${top?.entity.name ?? "the top bridge"}.`
                : "The agent is turning the top bridge into a recurring program."}
            </p>
            {programReady ? (
              <Button onClick={onContinue}>See the program</Button>
            ) : (
              <Spinner label="Designing" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The centrepiece: what everyone likes vs what these two groups specifically share. */
function Reveal({
  obvious,
  discovered,
  labels,
}: {
  obvious: ScoredCandidate;
  discovered: ScoredCandidate;
  labels: [string, string];
}) {
  const column = (c: ScoredCandidate, kind: "obvious" | "discovered") => {
    const isD = kind === "discovered";
    return (
      <div className={cx("space-y-6", !isD && "opacity-80")}>
        <Kicker tone={isD ? "bridge" : "muted"}>{isD ? "Discovered" : "Obvious"}</Kicker>
        <div className="flex items-start gap-4">
          <Thumb
            src={c.entity.imageUrl}
            name={c.entity.name}
            size={72}
            tone={isD ? "bridge" : "muted"}
          />
          <div className="min-w-0">
            <p
              className={cx(
                "font-display text-3xl leading-tight sm:text-4xl",
                isD ? "text-ink" : "text-ink-2",
              )}
            >
              {c.entity.name}
            </p>
            <p className="mt-1 text-sm text-muted">{typeLabel(c.domain)}</p>
          </div>
        </div>
        <SupportBars a={c.pct.A} b={c.pct.B} popularity={c.popularity} labels={labels} />
        <p className="text-sm text-muted">
          {isD
            ? "Strong with both groups, and specific to them."
            : "Strong with both groups, because nearly everyone likes it."}
        </p>
      </div>
    );
  };

  return (
    <section aria-label="Obvious versus discovered bridge" className="mt-16">
      <Rule />
      <div className="grid gap-10 py-10 md:grid-cols-2 md:gap-0">
        <div className="md:pr-12">{column(obvious, "obvious")}</div>
        <div className="md:border-l md:border-line md:pl-12">
          {column(discovered, "discovered")}
        </div>
      </div>
      <Rule />
      <p className="mt-6 max-w-3xl font-display text-xl leading-snug text-ink-2 sm:text-2xl">
        Both groups put <span className="text-ink">{discovered.entity.name}</span> in their{" "}
        <span className="text-a">{pct(discovered.pct.A)}</span> and{" "}
        <span className="text-b">{pct(discovered.pct.B)}</span> percentiles, while it sits at the{" "}
        {pct(discovered.popularity)} percentile of general popularity. Rank by raw support alone and{" "}
        {obvious.entity.name} wins every time.
      </p>
    </section>
  );
}

function BridgeRow({
  rank,
  bridge,
  note,
  labels,
  names,
  evidence,
  defaultOpen,
}: {
  rank: number;
  bridge: ScoredCandidate;
  note?: BridgeNote;
  labels: [string, string];
  names: Names;
  evidence: Map<string, Evidence>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rows = bridge.evidenceIds.flatMap((id) => evidence.get(id) ?? []);

  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[2rem_3rem_1fr] items-center gap-4 py-5 text-left sm:grid-cols-[2.5rem_3.5rem_1fr_15rem_4rem]"
      >
        <span className="figures font-display text-2xl text-muted">{rank}</span>
        <Thumb src={bridge.entity.imageUrl} name={bridge.entity.name} size={52} tone="bridge" />
        <span className="min-w-0">
          <span className="block font-display text-xl leading-snug sm:text-2xl">
            {bridge.entity.name}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {typeLabel(bridge.domain)} · {pct(bridge.popularity)} percentile for popularity
            {bridge.localAvailability ? " · local" : ""}
          </span>
        </span>
        <SupportBars
          a={bridge.pct.A}
          b={bridge.pct.B}
          labels={labels}
          className="hidden sm:block"
        />
        <span className="hidden text-right sm:block">
          <span className="figures block font-display text-3xl text-bridge">
            {bridge.bridgePotential}
          </span>
        </span>
      </button>

      {open && (
        <div className="grid gap-8 pb-8 sm:grid-cols-[2.5rem_3.5rem_1fr] sm:gap-4">
          <div className="hidden sm:block" />
          <div className="hidden sm:block" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <SupportBars
                a={bridge.pct.A}
                b={bridge.pct.B}
                labels={labels}
                className="sm:hidden"
              />
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted">Strongest supporting favourites</p>
                <p className="flex items-baseline gap-2">
                  <Dot tone="a" />
                  <span>{names(bridge.supportingSeeds.A).slice(0, 3).join(", ") || "—"}</span>
                </p>
                <p className="flex items-baseline gap-2">
                  <Dot tone="b" />
                  <span>{names(bridge.supportingSeeds.B).slice(0, 3).join(", ") || "—"}</span>
                </p>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted hover:text-ink">
                  Qloo evidence ({rows.length})
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-2">
                  {rows.map((e) => (
                    <li key={e.evidenceId}>
                      {e.evidenceId} ·{" "}
                      <span
                        className={
                          e.profile === "A"
                            ? "text-a"
                            : e.profile === "B"
                              ? "text-b"
                              : "text-bridge"
                        }
                      >
                        {e.profile === "AB" ? "A+B" : e.profile}
                      </span>{" "}
                      {e.purpose.replace(/-/g, " ")}
                      {e.rawScore !== null && ` · affinity ${e.rawScore.toFixed(3)}`}
                      {e.normalizedScore !== null && ` · ${ordinal(e.normalizedScore)} pct`}
                      {e.rank !== null && ` · rank ${e.rank}`}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            {note ? (
              <div className="space-y-3 text-sm leading-relaxed">
                <p className="text-xs text-muted">The agent&apos;s reading</p>
                <p>{note.activityFit}</p>
                <Note tone="warn">
                  <span className="text-ink">Watch out:</span> {note.mainFriction}
                </Note>
              </div>
            ) : (
              <p className="text-sm text-muted">The agent&apos;s notes are on their way…</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Rejections({ engine }: { engine: EngineResult }) {
  const groups = new Map<string, string[]>();
  for (const r of engine.rejections) {
    const key = r.reason.startsWith("One-sided")
      ? "only one community liked it"
      : r.reason.startsWith("Weak support")
        ? "weak support from both"
        : r.reason.startsWith("Too niche")
          ? "too niche to recruit around"
          : r.reason.startsWith("Sensitive")
            ? "sensitive topic, excluded by design"
            : r.reason.startsWith("Unsuitable venue")
              ? "not a usable venue"
              : "other";
    groups.set(key, [...(groups.get(key) ?? []), r.name]);
  }
  return (
    <div className="mt-10">
      <Kicker>Rejected</Kicker>
      <p className="mt-2 text-sm text-ink-2">
        <span className="figures">{engine.rejections.length}</span> of{" "}
        <span className="figures">{engine.stats.poolSize}</span> candidates, from{" "}
        <span className="figures">{engine.stats.qlooCalls}</span> Qloo calls. The engine would
        rather reject than invent a bridge.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {[...groups].map(([reason, items]) => (
          <li key={reason}>
            <details>
              <summary className="cursor-pointer text-muted hover:text-ink">
                <span className="figures text-ink">{items.length}</span> {reason}
              </summary>
              <p className="mt-1 pl-4 text-xs text-muted">
                {items.slice(0, 14).join(", ")}
                {items.length > 14 ? "…" : ""}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
