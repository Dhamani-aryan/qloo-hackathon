"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Eyebrow, Heading, Notice, Spinner, cx, typeLabel } from "../ui";
import {
  CALLS_PER_DOMAIN,
  STAGES,
  activity,
  domainProgress,
  hasEvent,
  stageStatuses,
  type RunState,
} from "./run";

function useElapsed(run: RunState): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [run.status]);
  if (!run.startedAt) return 0;
  return ((run.finishedAt ?? now) - run.startedAt) / 1000;
}

export function InvestigateScreen({
  run,
  onStop,
  onRetry,
  onBack,
  onContinue,
}: {
  run: RunState;
  onStop: () => void;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const elapsed = useElapsed(run);
  const stages = stageStatuses(run);
  const domains = domainProgress(run);
  const feed = activity(run);
  const engineDone = hasEvent(run, "engine_result");
  const baselineDone = hasEvent(run, "baseline");
  const result = run.result;
  const calls = run.events.filter(
    (e) => e.type === "engine" && e.event.type === "qloo_query_done",
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <Eyebrow tone="bridge">Step 2 · Investigate</Eyebrow>
          <Heading level={1}>
            {run.status === "done" ? "Investigation complete" : "The agent is investigating"}
          </Heading>
          <p className="text-muted">
            Every step below is a real action: Qloo queries, candidates admitted or rejected, and
            the program the agent designs from that evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm tabular-nums text-muted">
            {elapsed.toFixed(0)}s · {calls} Qloo calls
          </span>
          {run.status === "running" && (
            <Button variant="secondary" onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      </div>

      {run.status === "error" && (
        <Notice tone="warn">
          <p className="font-medium">The run didn&apos;t finish.</p>
          <p className="mt-1">{run.error}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="secondary" onClick={onBack}>
              Edit profiles
            </Button>
          </div>
        </Notice>
      )}
      {run.status === "stopped" && (
        <Notice tone="neutral">
          Stopped.{" "}
          <button className="underline" onClick={onRetry}>
            Run again
          </button>{" "}
          or{" "}
          <button className="underline" onClick={onBack}>
            edit the profiles
          </button>
          .
        </Notice>
      )}
      {result?.status === "insufficient_evidence" && (
        <Notice tone="warn">
          <p className="font-medium">Not enough evidence for a bridge.</p>
          <p className="mt-1">
            No candidate had strong, non-mainstream support from both communities. Try adding more
            varied seeds (different domains, less mainstream favourites), or check that each seed
            matched the right entity.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={onBack}>
              Edit profiles
            </Button>
          </div>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="space-y-1">
          <Heading level={3}>Agent steps</Heading>
          <ol className="mt-3 space-y-3">
            {STAGES.map(({ state, label }, i) => {
              const s = stages[state];
              const ms = result?.timings[state];
              return (
                <li key={state} className="flex items-start gap-3">
                  <span
                    className={cx(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s === "done" && "bg-ink text-paper",
                      s === "active" && "bg-bridge text-paper",
                      (s === "pending" || s === "skipped") && "border border-line text-muted",
                    )}
                  >
                    {s === "done" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cx(
                        "text-sm",
                        s === "pending" || s === "skipped" ? "text-muted" : "text-ink",
                      )}
                    >
                      {label}
                    </p>
                    {s === "active" && <Spinner label="Working…" />}
                    {s === "skipped" && <p className="text-xs text-muted">Skipped</p>}
                    {s === "done" && ms !== undefined && ms > 0 && (
                      <p className="text-xs text-muted">{(ms / 1000).toFixed(1)}s</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            <span className="font-medium text-ink">In parallel:</span> the same brief goes to an LLM
            with no Qloo data, for comparison.{" "}
            {baselineDone ? (
              <Badge tone="ok">Ready</Badge>
            ) : run.status === "running" ? (
              <Spinner />
            ) : null}
          </div>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {domains.length === 0 &&
              run.status === "running" &&
              Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-line bg-surface"
                />
              ))}
            {domains.map((d) => (
              <Card key={d.domain} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">{typeLabel(d.domain)}</p>
                  {d.done ? (
                    <Badge tone="ok">✓ Done</Badge>
                  ) : d.queries > 0 ? (
                    <Spinner />
                  ) : (
                    <Badge>Queued</Badge>
                  )}
                </div>
                {d.reason && <p className="line-clamp-2 text-xs text-muted">{d.reason}</p>}
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-bridge transition-all"
                    style={{ width: `${Math.min(100, (d.queries / CALLS_PER_DOMAIN) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {d.queries}/{CALLS_PER_DOMAIN} queries · {d.found} candidates · {d.rejected}{" "}
                  filtered
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <Heading level={3}>Activity</Heading>
            <ul className="mt-3 space-y-1.5 text-sm" aria-live="polite">
              {feed.length === 0 && <li className="text-muted">Starting…</li>}
              {feed.map((item) => (
                <li
                  key={item.key}
                  className={cx(
                    "truncate",
                    item.tone === "warn" && "text-warn",
                    item.tone === "ok" && "text-ok",
                    item.tone === "bridge" && "font-medium text-bridge",
                    item.tone === "neutral" && "text-muted",
                  )}
                  title={item.text}
                >
                  {item.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {result && result.warnings.length > 0 && (
        <details className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <summary className="cursor-pointer font-medium">
            {result.warnings.length} warning{result.warnings.length === 1 ? "" : "s"} during the run
          </summary>
          <ul className="mt-2 space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </details>
      )}

      {(engineDone || run.status === "done") && result?.status !== "insufficient_evidence" && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-bridge bg-bridge-soft p-5 sm:flex-row sm:items-center">
          <p className="text-sm">
            {run.status === "done"
              ? "The bridges and the program are ready."
              : "Bridges are ready. The agent is still designing the program."}
          </p>
          <Button onClick={onContinue}>See the bridges →</Button>
        </div>
      )}
    </div>
  );
}
