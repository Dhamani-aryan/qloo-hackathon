"use client";

import { useEffect, useState } from "react";
import { Button, Kicker, Note, Rule, Spinner, Title, cx, typeLabel } from "../ui";
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
    const t = setInterval(() => setNow(Date.now()), 250);
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
  onRunLive,
}: {
  run: RunState;
  onStop: () => void;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
  /** Re-run without the cache. */
  onRunLive: () => void;
}) {
  const elapsed = useElapsed(run);
  const stages = stageStatuses(run);
  const domains = domainProgress(run);
  const feed = activity(run, 9);
  const engineDone = hasEvent(run, "engine_result");
  const baselineDone = hasEvent(run, "baseline");
  const result = run.result;
  const calls = run.events.filter(
    (e) => e.type === "engine" && e.event.type === "qloo_query_done",
  ).length;
  const done = run.status === "done";
  const ready = (engineDone || done) && result?.status !== "insufficient_evidence";

  return (
    <div>
      <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-2xl space-y-4">
          <Title>{done ? "The investigation is done." : "Investigating."}</Title>
          <p className="text-lg leading-relaxed text-ink-2">
            The agent plans which cultural domains to explore, queries Qloo, tests every candidate
            against each community separately, then designs and critiques a program. Nothing here is
            simulated.
          </p>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <p className="figures font-display text-6xl leading-none">{Math.floor(elapsed)}s</p>
            <p className="mt-2 text-xs text-muted">
              <span className="figures">{calls}</span> Qloo calls
            </p>
          </div>
          {run.status === "running" && (
            <Button variant="link" onClick={onStop} className="mb-1">
              Stop
            </Button>
          )}
        </div>
      </div>

      {run.replay && (
        <p className="mt-8 text-sm text-muted">
          Replaying a live run from {new Date(run.replay.recordedAt).toLocaleString()}, which took{" "}
          {Math.round(run.replay.originalMs / 1000)}s. Cached on the server so demos are instant.{" "}
          <Button variant="link" onClick={onRunLive} disabled={run.status === "running"}>
            Run it live instead
          </Button>
        </p>
      )}

      <div className="mt-8 space-y-4">
        {run.status === "error" && (
          <Note tone="warn">
            <p className="font-medium text-ink">The run didn&apos;t finish.</p>
            <p>{run.error}</p>
            <p className="mt-2 space-x-4">
              <Button variant="link" onClick={onRetry}>
                Try again
              </Button>
              <Button variant="link" onClick={onBack}>
                Edit the profiles
              </Button>
            </p>
          </Note>
        )}
        {run.status === "stopped" && (
          <Note>
            Stopped.{" "}
            <Button variant="link" onClick={onRetry}>
              Run again
            </Button>{" "}
            or{" "}
            <Button variant="link" onClick={onBack}>
              edit the profiles
            </Button>
            .
          </Note>
        )}
        {result?.failure && !result.engine && (
          <Note tone="warn">
            <p className="font-medium text-ink">The run stopped early.</p>
            <p>{result.failure}</p>
            <p className="mt-2">
              <Button variant="link" onClick={onRetry}>
                Try again
              </Button>
            </p>
          </Note>
        )}
        {result?.status === "insufficient_evidence" && (
          <Note tone="warn">
            <p className="font-medium text-ink">No bridge this time.</p>
            <p>
              Nothing had strong, non-mainstream support from both communities. Try more varied
              favourites (different domains, fewer blockbusters), or check each one matched the
              right title.
            </p>
            <p className="mt-2">
              <Button variant="link" onClick={onBack}>
                Edit the profiles
              </Button>
            </p>
          </Note>
        )}
      </div>

      <Rule className="mt-10" />

      <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section>
          <Kicker>What the agent is doing</Kicker>
          <ol className="mt-5 space-y-4">
            {STAGES.map(({ state, label }, i) => {
              const s = stages[state];
              const ms = result?.timings[state];
              return (
                <li key={state} className="grid grid-cols-[1.75rem_1fr_auto] items-baseline gap-2">
                  <span
                    className={cx(
                      "figures text-sm",
                      s === "done" ? "text-ink" : s === "active" ? "text-bridge" : "text-muted/60",
                    )}
                  >
                    {s === "done" ? "✓" : `0${i + 1}`}
                  </span>
                  <span
                    className={cx(
                      "text-[15px]",
                      s === "active" ? "text-ink" : s === "done" ? "text-ink-2" : "text-muted",
                    )}
                  >
                    {label}
                    {s === "active" && (
                      <span className="pulse-dot ml-2 inline-block h-1.5 w-1.5 rounded-full bg-bridge align-middle" />
                    )}
                    {s === "skipped" && <span className="text-muted"> · skipped</span>}
                  </span>
                  <span className="figures text-xs text-muted">
                    {s === "done" && ms ? `${(ms / 1000).toFixed(1)}s` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 text-sm leading-relaxed text-muted">
            Meanwhile, the same brief goes to the same model <em>without</em> Qloo, for an honest
            comparison at the end.{" "}
            {baselineDone ? (
              <span className="text-ink-2">Ready.</span>
            ) : run.status === "running" ? (
              <Spinner />
            ) : null}
          </p>
        </section>

        <section className="min-w-0">
          <Kicker>Domains</Kicker>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-normal">Domain</th>
                <th className="pb-2 font-normal">Qloo queries</th>
                <th className="pb-2 text-right font-normal">Candidates</th>
                <th className="pb-2 text-right font-normal">Filtered</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={4} className="py-3 text-muted">
                    {run.status === "running" ? "Planning…" : "—"}
                  </td>
                </tr>
              )}
              {domains.map((d) => (
                <tr key={d.domain} className="border-t border-line" title={d.reason ?? undefined}>
                  <td className="py-3 pr-3">{typeLabel(d.domain)}</td>
                  <td className="py-3 pr-3">
                    <span className="flex gap-1" aria-label={`${d.queries} of ${CALLS_PER_DOMAIN}`}>
                      {Array.from({ length: CALLS_PER_DOMAIN }, (_, i) => (
                        <span
                          key={i}
                          className={cx("h-1.5 w-5", i < d.queries ? "bg-bridge" : "bg-line")}
                        />
                      ))}
                    </span>
                  </td>
                  <td className="figures py-3 text-right">{d.found || "—"}</td>
                  <td className="figures py-3 text-right text-muted">{d.rejected || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10">
            <Kicker>Log</Kicker>
          </div>
          <ul className="mt-3 space-y-1 font-mono text-xs" aria-live="polite">
            {feed.length === 0 && <li className="text-muted">starting…</li>}
            {feed.map((item, i) => (
              <li
                key={item.key}
                title={item.text}
                className={cx(
                  "truncate",
                  item.tone === "bridge"
                    ? "text-bridge"
                    : item.tone === "warn"
                      ? "text-warn"
                      : i === 0
                        ? "text-ink-2"
                        : "text-muted",
                )}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {result && result.warnings.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">
            {result.warnings.length} warning{result.warnings.length === 1 ? "" : "s"} during the run
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {ready && (
        <div className="mt-8 flex flex-col gap-4 border-t border-ink pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-2">
            {done
              ? "The bridges and the program are ready."
              : "The bridges are ready. The program is still being designed."}
          </p>
          <Button onClick={onContinue}>See the bridges</Button>
        </div>
      )}
    </div>
  );
}
