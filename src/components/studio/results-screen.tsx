"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/lib/engine/types";
import { Button, Dot, More, Note, Spinner, Title, cx, typeLabel } from "../ui";
import { CommonGround } from "./bridges-screen";
import { Comparison } from "./comparison";
import { PlanSection, type ProgramVersion } from "./program-screen";
import {
  CALLS_PER_DOMAIN,
  STAGES,
  activity,
  artifacts,
  domainProgress,
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

/** One page: progress, then the common ground, the plan, and why Qloo matters. */
export function ResultsScreen({
  run,
  scenario,
  version,
  onRegenerated,
  onEdit,
  onRetry,
  onRunLive,
  onStop,
}: {
  run: RunState;
  scenario: Scenario;
  version: ProgramVersion | null;
  onRegenerated: (v: ProgramVersion) => void;
  onEdit: () => void;
  onRetry: () => void;
  onRunLive: () => void;
  onStop: () => void;
}) {
  const view = artifacts(run);
  const running = run.status === "running";
  const result = run.result;
  const engineOk = view.engine?.status === "ok";
  const programFailed = !running && engineOk && !view.program;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <Dot tone="a" />
          <span>{scenario.a.label}</span>
          <span className="text-bridge">+</span>
          <Dot tone="b" />
          <span>{scenario.b.label}</span>
          {scenario.location && <span className="text-muted">· {scenario.location}</span>}
          <Button variant="link" onClick={onEdit} className="ml-2">
            Edit
          </Button>
        </p>
        <Title>
          {running && !engineOk
            ? "Finding common ground…"
            : engineOk
              ? "Their common ground"
              : "No result"}
        </Title>
      </header>

      <div className="mt-6">
        <Progress run={run} onStop={onStop} />
      </div>

      {run.replay && !running && (
        <p className="mt-3 text-xs text-muted">
          Shown instantly from a saved run.{" "}
          <Button variant="link" onClick={onRunLive} className="text-xs">
            Run it live
          </Button>
        </p>
      )}

      <div className="mt-6 space-y-4">
        {run.status === "error" && (
          <Note tone="warn">
            <p className="font-medium text-ink">Something went wrong.</p>
            <p>{run.error}</p>
            <p className="mt-2">
              <Button variant="link" onClick={onRetry}>
                Try again
              </Button>
            </p>
          </Note>
        )}
        {run.status === "stopped" && (
          <Note>
            Stopped.{" "}
            <Button variant="link" onClick={onRetry}>
              Run again
            </Button>
          </Note>
        )}
        {result?.failure && !result.engine && (
          <Note tone="warn">
            <p className="font-medium text-ink">The search stopped early.</p>
            <p>{result.failure}</p>
            <p className="mt-2">
              <Button variant="link" onClick={onRetry}>
                Try again
              </Button>
            </p>
          </Note>
        )}
        {view.engine?.status === "insufficient_evidence" && (
          <Note tone="warn">
            <p className="font-medium text-ink">No strong common ground this time.</p>
            <p>
              Try adding more varied favourites (different kinds, fewer blockbusters).{" "}
              <Button variant="link" onClick={onEdit}>
                Edit the groups
              </Button>
            </p>
          </Note>
        )}
      </div>

      {engineOk && view.engine && (
        <div className="mt-12">
          <CommonGround scenario={scenario} engine={view.engine} notes={view.notes} />
        </div>
      )}

      {engineOk && (
        <div className="mt-20 border-t-2 border-ink pt-10">
          {version ? (
            <PlanSection
              version={version}
              engine={view.engine!}
              brief={view.brief}
              labels={[scenario.a.label, scenario.b.label]}
              onRegenerated={onRegenerated}
            />
          ) : programFailed ? (
            <Note tone="warn">
              The plan couldn&apos;t be written this time; the bridges above are complete.{" "}
              <Button variant="link" onClick={onRetry}>
                Try again
              </Button>
            </Note>
          ) : (
            <Spinner label="Writing a 4-session plan around the top bridge…" />
          )}
        </div>
      )}

      {version && (
        <div className="mt-24">
          <Comparison
            program={version.program}
            baseline={view.baseline}
            scenario={scenario}
            pending={running}
          />
        </div>
      )}
    </div>
  );
}

/** One line while it runs (or a summary when done), with the full trace folded away. */
function Progress({ run, onStop }: { run: RunState; onStop: () => void }) {
  const elapsed = useElapsed(run);
  const stages = stageStatuses(run);
  const done = STAGES.filter((s) => stages[s.state] === "done").length;
  const active = STAGES.find((s) => stages[s.state] === "active");
  const domains = domainProgress(run);
  const feed = activity(run, 12);
  const running = run.status === "running";
  const calls = run.events.filter(
    (e) => e.type === "engine" && e.event.type === "qloo_query_done",
  ).length;
  const engine = artifacts(run).engine;

  return (
    <div className="space-y-3">
      {running ? (
        <>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-ink-2">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-bridge" />
              {active?.label ?? "Starting"}…
              <span className="figures text-muted">{Math.floor(elapsed)}s</span>
            </span>
            <Button variant="link" onClick={onStop}>
              Stop
            </Button>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-bridge transition-all duration-500"
              style={{ width: `${Math.max(4, (done / STAGES.length) * 100)}%` }}
            />
          </div>
        </>
      ) : (
        run.startedAt && (
          <p className="text-sm text-muted">
            Done in <span className="figures">{Math.round(elapsed)}</span>s ·{" "}
            <span className="figures">{calls}</span> Qloo searches
            {engine ? (
              <>
                {" "}
                · <span className="figures">{engine.stats.poolSize}</span> ideas checked
              </>
            ) : null}
          </p>
        )
      )}

      <More label="How it got here">
        <div className="grid gap-10 md:grid-cols-2">
          <ol className="space-y-2 text-sm">
            {STAGES.map(({ state, label }) => {
              const s = stages[state];
              return (
                <li
                  key={state}
                  className={cx(
                    "flex items-center gap-2",
                    s === "done" ? "text-ink-2" : s === "active" ? "text-ink" : "text-muted",
                  )}
                >
                  <span className="w-4 text-center">
                    {s === "done" ? "✓" : s === "active" ? "•" : "·"}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          <div className="min-w-0 space-y-4">
            <table className="w-full text-sm">
              <tbody>
                {domains.map((d) => (
                  <tr key={d.domain} className="border-t border-line" title={d.reason ?? undefined}>
                    <td className="py-2 pr-3">{typeLabel(d.domain)}</td>
                    <td className="py-2 pr-3">
                      <span className="flex gap-1">
                        {Array.from({ length: CALLS_PER_DOMAIN }, (_, i) => (
                          <span
                            key={i}
                            className={cx("h-1.5 w-4", i < d.queries ? "bg-bridge" : "bg-line")}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="figures py-2 text-right text-muted">{d.found || "—"} ideas</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-1 font-mono text-xs text-muted">
              {feed.map((item) => (
                <li key={item.key} className="truncate" title={item.text}>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </More>
    </div>
  );
}
