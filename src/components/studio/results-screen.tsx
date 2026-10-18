"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/lib/engine/types";
import { Button, Dot, More, Note, Spinner, Title, cx, typeLabel } from "../ui";
import { CommonGround } from "./bridges-screen";
import { Comparison } from "./comparison";
import { Invitations } from "./invitations";
import type { Invitations as InvitationsData } from "@/lib/agent/invites";
import { PlanSection, type ProgramVersion } from "./program-screen";
import { DeliveryChecklist } from "./delivery-checklist";
import { ACTIVITY_LABELS, DEFAULT_SETTINGS } from "@/lib/planning";
import { postJson } from "./api";
import type { Program } from "@/lib/agent/program";
import {
  CALLS_PER_DOMAIN,
  STAGES,
  activity,
  artifacts,
  decisions,
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
  return Math.max(0, ((run.finishedAt ?? now) - run.startedAt) / 1000);
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
  const [section, setSection] = useState<"bridges" | "plan" | "prepare">("bridges");
  const settings = scenario.settings ?? DEFAULT_SETTINGS;
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  // Invitations written for a program the organizer rebuilt on another bridge.
  const [versionInvites, setVersionInvites] = useState<{
    program: Program;
    invitations: InvitationsData | null;
    error: string | null;
  } | null>(null);
  const writeVersionInvites = async (program: Program) => {
    if (!result?.briefId) return;
    setVersionInvites({ program, invitations: null, error: null });
    try {
      const r = await postJson<{ invitations: InvitationsData }>("/api/invitations", {
        briefId: result.briefId,
        program,
      });
      setVersionInvites({ program, invitations: r.invitations, error: null });
    } catch (error) {
      setVersionInvites({ program, invitations: null, error: (error as Error).message });
    }
  };
  const [confirmation, setConfirmation] = useState<{ program: Program | null; ids: string[] }>({
    program: null,
    ids: [],
  });
  const chooseBridge = async (bridgeRef: string) => {
    if (version?.program.bridgeRef === bridgeRef) {
      setSection("plan");
      return;
    }
    if (!result?.briefId || rebuilding) return;
    setRebuilding(bridgeRef);
    setRebuildError(null);
    try {
      const next = await postJson<ProgramVersion>("/api/program", {
        briefId: result.briefId,
        bridgeRef,
      });
      onRegenerated(next);
      setSection("plan");
    } catch (error) {
      setRebuildError((error as Error).message);
    } finally {
      setRebuilding(null);
    }
  };

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
        <p className="text-sm text-muted">
          {ACTIVITY_LABELS[settings.activity]} · {settings.novelty} discovery
          {settings.budget === "free" ? " · free to participants" : ""}
          {settings.groupSize ? ` · ${settings.groupSize} people` : ""}
        </p>
      </header>

      <div className="mt-6">
        <Progress run={run} onStop={onStop} />
      </div>
      <More className="mt-4" label="What the agent decided">
        <AgentLog run={run} />
      </More>

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
        {!running && view.engine?.warnings.some((w) => w.includes("failed")) && (
          <Note tone="warn">
            Qloo was busy for part of this search, so some kinds of ideas were skipped.{" "}
            <Button variant="link" onClick={onRunLive}>
              Run it again
            </Button>
          </Note>
        )}
        {engineOk && view.engine?.overlap === "weak" && (
          <Note tone="warn">
            <p className="font-medium text-ink">These groups share little in Qloo&apos;s data.</p>
            <p>
              Qloo found no common themes between them, so only options both groups rank clearly
              highly are shown. Treat them as experiments and check with both groups first.
            </p>
          </Note>
        )}
        {view.engine?.status === "insufficient_evidence" && (
          <Note tone="warn">
            <p className="font-medium text-ink">No strong common ground this time.</p>
            <p>
              Add more varied favorites or try Familiar discovery. We haven’t lowered the evidence
              threshold to fill the list.{" "}
              <Button variant="link" onClick={onEdit}>
                Edit the groups
              </Button>
            </p>
          </Note>
        )}
      </div>

      {engineOk && (
        <nav
          aria-label="Your program workspace"
          className="mt-10 grid grid-cols-3 border-y border-line print:hidden"
        >
          {(
            [
              ["bridges", "01", "Choose a bridge"],
              ["plan", "02", "Shape the program"],
              ["prepare", "03", "Prepare to run it"],
            ] as const
          ).map(([id, number, label]) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "step" : undefined}
              onClick={() => setSection(id)}
              className={cx(
                "border-b-2 px-2 py-4 text-left text-sm sm:px-4",
                section === id
                  ? "border-bridge text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <span className="mb-1 block text-[10px] tracking-widest text-bridge">{number}</span>
              {label}
              {id !== "bridges" && !version && (
                <span className="block text-[10px]">
                  {running ? "Being written…" : "Not available"}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {engineOk && view.engine && section === "bridges" && (
        <div className="mt-10">
          <CommonGround
            scenario={scenario}
            engine={view.engine}
            notes={view.notes}
            onChoose={(ref) => void chooseBridge(ref)}
            canChoose={Boolean(result?.briefId) && !rebuilding}
            busyBridge={rebuilding}
          />
          {rebuildError && (
            <div className="mt-4">
              <Note tone="warn">{rebuildError}</Note>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button onClick={() => setSection("plan")}>Shape the program →</Button>
            <p className="text-xs text-muted">
              {version
                ? "Your draft is ready. Choose any bridge above to build a different version."
                : "A draft is being built around the first bridge. You can change the anchor when it’s ready."}
            </p>
          </div>
        </div>
      )}

      {engineOk && section === "plan" && (
        <div className="mt-10">
          {version ? (
            <PlanSection
              version={version}
              engine={view.engine!}
              brief={view.brief}
              briefId={result?.briefId}
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

      {engineOk && section === "plan" && version && (
        <div className="mt-10 print:hidden">
          <Button onClick={() => setSection("prepare")}>Review delivery & invitations →</Button>
        </div>
      )}

      {engineOk &&
        section === "prepare" &&
        (version ? (
          <div className="mt-10">
            <DeliveryChecklist
              program={version.program}
              brief={view.brief}
              confirmed={confirmation.program === version.program ? confirmation.ids : []}
              onConfirmedChange={(ids) => setConfirmation({ program: version.program, ids })}
            />
          </div>
        ) : (
          <div className="mt-10">
            <Spinner
              label={
                running
                  ? "The program will appear here when it’s ready."
                  : "Write a program before reviewing delivery."
              }
            />
          </div>
        ))}

      {/* Invitations belong to the agent's own plan, not a plan rebuilt on another bridge. */}
      {section === "prepare" && view.invitations && version?.program === view.program && (
        <div className="mt-12">
          <Invitations
            invitations={view.invitations}
            labels={[scenario.a.label, scenario.b.label]}
          />
        </div>
      )}

      {section === "prepare" && version && version.program !== view.program && (
        <div className="mt-12">
          {versionInvites?.program === version.program && versionInvites.invitations ? (
            <Invitations
              invitations={versionInvites.invitations}
              labels={[scenario.a.label, scenario.b.label]}
            />
          ) : (
            <Note>
              <p className="font-medium text-ink">Invitations for this version</p>
              <p>
                The first invitations were written for the original plan, so they&apos;re hidden
                here rather than shown with the wrong bridge.
              </p>
              {versionInvites?.program === version.program && versionInvites.error && (
                <p className="mt-2 text-warn">{versionInvites.error}</p>
              )}
              <p className="mt-3">
                {versionInvites?.program === version.program && !versionInvites.error ? (
                  <Spinner label="Writing invitations for this version…" />
                ) : (
                  <Button
                    variant="link"
                    disabled={!result?.briefId}
                    onClick={() => void writeVersionInvites(version.program)}
                  >
                    Write invitations for this version
                  </Button>
                )}
              </p>
            </Note>
          )}
        </div>
      )}

      {section === "prepare" && version && (
        <More className="mt-12" label="Compare with a model-only proposal">
          <Comparison
            program={version.program}
            baseline={view.baseline}
            scenario={scenario}
            pending={running}
          />
        </More>
      )}
    </div>
  );
}

const STEP_MARK: Record<string, string> = {
  instructions: "✎",
  plan: "→",
  review: "◎",
  tool: "⌕",
  outcome: "✓",
};

/** The agent's own decisions, in plain words, as they happen. Always visible, never long. */
function AgentLog({ run }: { run: RunState }) {
  const items = decisions(run);
  if (items.length === 0) return null;
  return (
    <section aria-label="What the agent did" className="mt-5 border-l-2 border-bridge/60 pl-4">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">
        What the agent did
      </p>
      <ol className="mt-2 space-y-1.5 text-sm text-ink-2">
        {items.slice(0, 12).map((d, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden className="w-4 shrink-0 text-center text-bridge">
              {STEP_MARK[d.step] ?? "·"}
            </span>
            <span>{d.text}</span>
          </li>
        ))}
      </ol>
    </section>
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
            {run.status === "done"
              ? run.replay
                ? "Replayed in"
                : "Completed in"
              : run.status === "stopped"
                ? "Stopped after"
                : "Connection ended after"}{" "}
            <span className="figures">{Math.round(elapsed)}</span>s ·{" "}
            <span className="figures">{calls}</span> Qloo query steps
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
