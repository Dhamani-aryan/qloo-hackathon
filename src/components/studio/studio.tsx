"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { PREBUILT } from "@/scenarios";
import { Main, Stepper, type StepKey } from "../shell";
import { Card, Eyebrow, Heading } from "../ui";
import { draftFromPrebuilt, draftReducer } from "./draft";
import { ProfilesScreen, useSeedResolver } from "./profiles-screen";

/** The four-step COMMON GROUND workflow. */
export function Studio() {
  const [step, setStep] = useState<StepKey>("profiles");
  const [draft, dispatch] = useReducer(draftReducer, PREBUILT[0], draftFromPrebuilt);
  const resolve = useSeedResolver(dispatch);
  const loaded = useRef(false);

  // Resolve the default scenario once so a judge lands on a ready-to-run example.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void resolve("a", draft.a.seeds, true);
    void resolve("b", draft.b.seeds, true);
  }, [draft, resolve]);

  return (
    <>
      <Stepper current={step} reachable={["profiles"]} onSelect={setStep} />
      <Main>
        {step === "profiles" && (
          <ProfilesScreen draft={draft} dispatch={dispatch} onRun={() => setStep("investigate")} />
        )}
        {step === "investigate" && (
          <Card>
            <Eyebrow tone="bridge">Coming next</Eyebrow>
            <Heading level={2}>The agent investigates</Heading>
          </Card>
        )}
      </Main>
    </>
  );
}
