"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { PREBUILT } from "@/scenarios";
import { Main, Stepper, type StepKey } from "../shell";
import { draftFromPrebuilt, draftReducer, toScenario } from "./draft";
import type { Scenario } from "@/lib/engine/types";
import { BridgesScreen } from "./bridges-screen";
import { Comparison } from "./comparison";
import { InvestigateScreen } from "./investigate-screen";
import { ProfilesScreen, useSeedResolver } from "./profiles-screen";
import { ProgramScreen, type ProgramVersion } from "./program-screen";
import { artifacts, useAgentRun } from "./run";

/** The four-step COMMON GROUND workflow. */
export function Studio() {
  const [step, setStep] = useState<StepKey>("profiles");
  const [draft, dispatch] = useReducer(draftReducer, PREBUILT[0], draftFromPrebuilt);
  const resolve = useSeedResolver(dispatch);
  const { run, start, stop } = useAgentRun();
  const [ranScenario, setRanScenario] = useState<Scenario | null>(null);
  const [override, setOverride] = useState<ProgramVersion | null>(null);
  const loaded = useRef(false);
  const view = artifacts(run);

  // Resolve the default scenario once so a judge lands on a ready-to-run example.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void resolve(
      [
        { side: "a", seeds: draft.a.seeds },
        { side: "b", seeds: draft.b.seeds },
      ],
      true,
    );
  }, [draft, resolve]);

  const go = (next: StepKey) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const runAnalysis = () => {
    const scenario = toScenario(draft);
    setRanScenario(scenario);
    setOverride(null);
    go("investigate");
    void start(scenario);
  };

  const reachable: StepKey[] = ["profiles"];
  if (run.status !== "idle") reachable.push("investigate");
  if (view.engine?.status === "ok") reachable.push("bridges");
  if (view.program) reachable.push("program");

  return (
    <>
      <Stepper current={step} reachable={reachable} onSelect={go} />
      <Main>
        {step === "profiles" && (
          <ProfilesScreen draft={draft} dispatch={dispatch} onRun={runAnalysis} />
        )}
        {step === "investigate" && (
          <InvestigateScreen
            run={run}
            onStop={stop}
            onRetry={runAnalysis}
            onBack={() => go("profiles")}
            onContinue={() => go("bridges")}
          />
        )}
        {step === "bridges" && view.engine && ranScenario && (
          <BridgesScreen
            scenario={ranScenario}
            engine={view.engine}
            notes={view.notes}
            programReady={Boolean(view.program)}
            onContinue={() => go("program")}
          />
        )}
        {step === "program" && view.program && view.engine && ranScenario && (
          <ProgramScreen
            version={override ?? { program: view.program, critique: view.critique }}
            engine={view.engine}
            brief={view.brief}
            labels={[ranScenario.a.label, ranScenario.b.label]}
            onRegenerated={setOverride}
            comparison={
              <Comparison
                program={(override ?? { program: view.program }).program}
                baseline={view.baseline}
                scenario={ranScenario}
                pending={run.status === "running"}
              />
            }
          />
        )}
      </Main>
    </>
  );
}
