"use client";

import { useReducer, useState } from "react";
import type { Scenario } from "@/lib/engine/types";
import { Main, TopBar } from "../shell";
import { emptyDraft, draftReducer, toScenario } from "./draft";
import { HomeScreen } from "./home-screen";
import type { ProgramVersion } from "./program-screen";
import { ResultsScreen } from "./results-screen";
import { artifacts, useAgentRun } from "./run";

/** Two views: enter the two groups, then one results page. */
export function Studio() {
  const [view, setView] = useState<"home" | "results">("home");
  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft);
  const { run, start, stop } = useAgentRun();
  const [ranScenario, setRanScenario] = useState<Scenario | null>(null);
  const [override, setOverride] = useState<ProgramVersion | null>(null);
  const { program, critique } = artifacts(run);

  const show = (next: "home" | "results") => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const runAnalysis = (fresh = false) => {
    const scenario = toScenario(draft);
    setRanScenario(scenario);
    setOverride(null);
    show("results");
    void start(scenario, { fresh });
  };

  return (
    <>
      <TopBar
        onHome={() => show("home")}
        action={
          view === "results" ? (
            <button
              type="button"
              onClick={() => show("home")}
              className="text-sm text-ink-2 hover:text-ink"
            >
              ← New search
            </button>
          ) : ranScenario ? (
            <button
              type="button"
              onClick={() => show("results")}
              className="text-sm text-ink-2 hover:text-ink"
            >
              Last result →
            </button>
          ) : null
        }
      />
      <Main>
        {view === "home" && (
          <HomeScreen draft={draft} dispatch={dispatch} onRun={() => runAnalysis()} />
        )}
        {view === "results" && ranScenario && (
          <ResultsScreen
            key={run.startedAt}
            run={run}
            scenario={ranScenario}
            version={override ?? (program ? { program, critique } : null)}
            onRegenerated={setOverride}
            onEdit={() => show("home")}
            onRetry={() => runAnalysis()}
            onRunLive={() => runAnalysis(true)}
            onStop={stop}
          />
        )}
      </Main>
    </>
  );
}
