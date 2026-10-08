"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { PREBUILT } from "@/scenarios";
import { Main, Stepper, type StepKey } from "../shell";
import { Card, Eyebrow, Heading } from "../ui";
import { draftFromPrebuilt, draftReducer, toScenario } from "./draft";
import { InvestigateScreen } from "./investigate-screen";
import { ProfilesScreen, useSeedResolver } from "./profiles-screen";
import { artifacts, useAgentRun } from "./run";

/** The four-step COMMON GROUND workflow. */
export function Studio() {
  const [step, setStep] = useState<StepKey>("profiles");
  const [draft, dispatch] = useReducer(draftReducer, PREBUILT[0], draftFromPrebuilt);
  const resolve = useSeedResolver(dispatch);
  const { run, start, stop } = useAgentRun();
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
    go("investigate");
    void start(toScenario(draft));
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
        {step === "bridges" && (
          <Card>
            <Eyebrow tone="bridge">Coming next</Eyebrow>
            <Heading level={2}>Obvious vs discovered</Heading>
          </Card>
        )}
      </Main>
    </>
  );
}
