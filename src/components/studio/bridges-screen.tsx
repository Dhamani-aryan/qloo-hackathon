"use client";

import type { BridgeNote } from "@/lib/agent/notes";
import type { EngineResult, Evidence, Scenario, ScoredCandidate } from "@/lib/engine/types";
import {
  Badge,
  Button,
  Card,
  EntityTile,
  Eyebrow,
  Heading,
  Spinner,
  SupportBars,
  cx,
  ordinal,
  typeLabel,
} from "../ui";

type Names = (ids: string[]) => string[];

export function BridgesScreen({
  scenario,
  engine,
  notes,
  programReady,
  onContinue,
}: {
  scenario: Scenario;
  engine: EngineResult;
  notes: BridgeNote[];
  programReady: boolean;
  onContinue: () => void;
}) {
  const seedName = new Map(
    [...scenario.a.seeds, ...scenario.b.seeds].map((s) => [s.entityId, s.name]),
  );
  const names: Names = (ids) => ids.map((id) => seedName.get(id) ?? "a seed");
  const labels: [string, string] = [scenario.a.label, scenario.b.label];
  const evidence = new Map(engine.evidence.map((e) => [e.evidenceId, e]));
  const top = engine.bridges[0];

  return (
    <div className="space-y-10">
      <div className="max-w-3xl space-y-3">
        <Eyebrow tone="bridge">Step 3 · Bridges</Eyebrow>
        <Heading level={1}>Where these two communities meet</Heading>
        <p className="text-muted">
          A bridge is something <em>both</em> communities rank highly, measured separately for each
          side, that isn&apos;t just what everyone likes. Every number comes from Qloo; notes marked{" "}
          <Badge tone="neutral">interpretation</Badge> are the agent&apos;s reading of that
          evidence.
        </p>
      </div>

      {top && engine.obvious && (
        <ObviousVsDiscovered obvious={engine.obvious} discovered={top} labels={labels} />
      )}

      <section className="space-y-4">
        <Heading level={2}>Three discovered bridges</Heading>
        <div className="grid gap-5 lg:grid-cols-3">
          {engine.bridges.map((b, i) => (
            <BridgeCard
              key={b.entity.id}
              rank={i + 1}
              bridge={b}
              note={notes.find((n) => n.ref === `B${i + 1}`)}
              labels={labels}
              names={names}
              evidence={evidence}
            />
          ))}
        </div>
      </section>

      {engine.themes.length > 0 && (
        <section className="space-y-3">
          <Heading level={2}>Shared themes</Heading>
          <p className="text-sm text-muted">
            Tags Qloo&apos;s Analysis Compare finds in both profiles, with the seeds behind them.
          </p>
          <ul className="flex flex-wrap gap-2">
            {engine.themes.map((t) => (
              <li
                key={t.tagId}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              >
                <span className="font-medium text-bridge">{t.name}</span>
                <span className="text-muted">
                  {" "}
                  ·{" "}
                  <span className="text-a">
                    {names(t.supportingSeeds.A).slice(0, 2).join(", ")}
                  </span>{" "}
                  ↔{" "}
                  <span className="text-b">
                    {names(t.supportingSeeds.B).slice(0, 2).join(", ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {engine.runnersUp.length > 0 && (
          <Card className="space-y-3">
            <Heading level={3}>Also considered</Heading>
            <ul className="space-y-2">
              {engine.runnersUp.map((r) => (
                <li key={r.entity.id} className="flex items-center justify-between gap-3">
                  <EntityTile
                    name={r.entity.name}
                    type={r.domain}
                    imageUrl={r.entity.imageUrl}
                    size="sm"
                    tone="bridge"
                  />
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {pct(r.pct.A)} / {pct(r.pct.B)} · BP {r.bridgePotential}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Rejections engine={engine} />
      </div>

      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-bridge bg-bridge-soft p-5 sm:flex-row sm:items-center">
        <p className="text-sm">
          {programReady
            ? `The program is built around ${top?.entity.name ?? "the top bridge"}.`
            : "The agent is turning the top bridge into a recurring program…"}
        </p>
        {programReady ? (
          <Button onClick={onContinue}>See the program →</Button>
        ) : (
          <Spinner label="Designing" />
        )}
      </div>
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : ordinal(v));

function ObviousVsDiscovered({
  obvious,
  discovered,
  labels,
}: {
  obvious: ScoredCandidate;
  discovered: ScoredCandidate;
  labels: [string, string];
}) {
  const side = (c: ScoredCandidate, kind: "obvious" | "discovered") => (
    <div
      className={cx(
        "flex flex-col gap-4 rounded-2xl p-5",
        kind === "obvious" ? "bg-surface-2" : "bg-bridge-soft ring-2 ring-bridge",
      )}
    >
      <div className="space-y-1">
        <Eyebrow tone={kind === "obvious" ? "neutral" : "bridge"}>
          {kind === "obvious" ? "Obvious bridge" : "Discovered bridge"}
        </Eyebrow>
        <p className="text-sm text-muted">
          {kind === "obvious"
            ? "Strong with both groups, but it's what nearly everyone likes."
            : "Strong with both groups and specific to them."}
        </p>
      </div>
      <EntityTile
        name={c.entity.name}
        type={c.domain}
        imageUrl={c.entity.imageUrl}
        size="lg"
        wrap
        tone={kind === "obvious" ? "neutral" : "bridge"}
      />
      <SupportBars a={c.pct.A} b={c.pct.B} labels={labels} />
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 shrink-0 font-medium text-muted">Mainstream</span>
        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-muted"
            style={{ width: `${Math.round((c.popularity ?? 0) * 100)}%` }}
          />
        </span>
        <span className="w-10 shrink-0 text-right tabular-nums text-muted">
          {pct(c.popularity)}
        </span>
      </div>
    </div>
  );

  return (
    <section aria-label="Obvious versus discovered bridge" className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        {side(obvious, "obvious")}
        {side(discovered, "discovered")}
      </div>
      <p className="max-w-3xl text-sm text-muted">
        Both groups rank <span className="font-medium text-ink">{discovered.entity.name}</span> at
        the <span className="text-a">{pct(discovered.pct.A)}</span> and{" "}
        <span className="text-b">{pct(discovered.pct.B)}</span> percentile of the candidates, yet it
        sits at the {pct(discovered.popularity)} percentile of general popularity, against{" "}
        {pct(obvious.popularity)} for {obvious.entity.name}. Without the popularity adjustment, the
        obvious pick would win.
      </p>
    </section>
  );
}

function BridgeCard({
  rank,
  bridge,
  note,
  labels,
  names,
  evidence,
}: {
  rank: number;
  bridge: ScoredCandidate;
  note?: BridgeNote;
  labels: [string, string];
  names: Names;
  evidence: Map<string, Evidence>;
}) {
  const rows = bridge.evidenceIds.flatMap((id) => evidence.get(id) ?? []);
  return (
    <Card tone="bridge" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <EntityTile
          name={bridge.entity.name}
          type={bridge.domain}
          imageUrl={bridge.entity.imageUrl}
          tone="bridge"
          wrap
        />
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl leading-none text-bridge">{bridge.bridgePotential}</p>
          <p className="text-[11px] text-muted">Bridge Potential</p>
        </div>
      </div>
      <Badge tone="bridge">
        #{rank} · {typeLabel(bridge.domain)}
      </Badge>
      <SupportBars a={bridge.pct.A} b={bridge.pct.B} labels={labels} />
      <p className="text-xs text-muted">
        Popularity {pct(bridge.popularity)} percentile
        {bridge.localAvailability ? " · local to the scenario city" : ""}
      </p>

      <div className="space-y-1 text-xs">
        <p className="text-muted">Supported by</p>
        <p>
          <span className="font-medium text-a">
            {names(bridge.supportingSeeds.A).slice(0, 3).join(", ") || "—"}
          </span>
        </p>
        <p>
          <span className="font-medium text-b">
            {names(bridge.supportingSeeds.B).slice(0, 3).join(", ") || "—"}
          </span>
        </p>
      </div>

      {note && (
        <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <Badge tone="neutral">interpretation</Badge>
          <p>
            <span className="font-medium">Activity: </span>
            {note.activityFit}
          </p>
          <p>
            <span className="font-medium">Friction: </span>
            {note.mainFriction}
          </p>
        </div>
      )}

      <details className="mt-auto text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">
          Qloo evidence ({rows.length})
        </summary>
        <ul className="mt-2 space-y-1.5">
          {rows.map((e) => (
            <li key={e.evidenceId} className="rounded-lg border border-line px-2 py-1.5">
              <span className="font-mono text-muted">{e.evidenceId}</span>{" "}
              <span
                className={cx(
                  "font-medium",
                  e.profile === "A" ? "text-a" : e.profile === "B" ? "text-b" : "text-bridge",
                )}
              >
                {e.profile === "AB" ? "A+B" : e.profile}
              </span>{" "}
              {e.purpose.replace(/-/g, " ")} · {e.endpoint}
              {e.rawScore !== null && <> · affinity {e.rawScore.toFixed(3)}</>}
              {e.normalizedScore !== null && <> · {ordinal(e.normalizedScore)} pct</>}
              {e.rank !== null && <> · rank {e.rank}</>}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function Rejections({ engine }: { engine: EngineResult }) {
  const groups = new Map<string, string[]>();
  for (const r of engine.rejections) {
    const key = r.reason.startsWith("One-sided")
      ? "Only one community likes it"
      : r.reason.startsWith("Weak support")
        ? "Weak support from both"
        : r.reason.startsWith("Too niche")
          ? "Too niche to recruit around"
          : r.reason.startsWith("Sensitive")
            ? "Sensitive topic (responsible-use filter)"
            : r.reason.startsWith("Unsuitable venue")
              ? "Unsuitable venue"
              : r.reason.startsWith("Mainstream")
                ? "Too mainstream"
                : "Other";
    groups.set(key, [...(groups.get(key) ?? []), r.name]);
  }
  return (
    <Card className="space-y-3">
      <Heading level={3}>Rejected ({engine.rejections.length})</Heading>
      <p className="text-sm text-muted">
        The engine rejects candidates rather than inventing a bridge. {engine.stats.poolSize}{" "}
        candidates from {engine.stats.qlooCalls} Qloo calls.
      </p>
      <ul className="space-y-2 text-sm">
        {[...groups].map(([reason, items]) => (
          <li key={reason}>
            <details>
              <summary className="cursor-pointer">
                <span className="font-medium">{items.length}</span> · {reason}
              </summary>
              <p className="mt-1 text-xs text-muted">
                {items.slice(0, 12).join(", ")}
                {items.length > 12 ? "…" : ""}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}
