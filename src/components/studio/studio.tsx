"use client";

import { useState } from "react";
import { Main, Stepper, type StepKey } from "../shell";
import { Card, Eyebrow, Heading } from "../ui";

/** The four-step COMMON GROUND workflow. Screens are filled in by Track 4 steps 4.2–4.7. */
export function Studio() {
  const [step, setStep] = useState<StepKey>("profiles");

  return (
    <>
      <Stepper current={step} reachable={["profiles"]} onSelect={setStep} />
      <Main>
        <Card>
          <Eyebrow tone="bridge">Coming next</Eyebrow>
          <Heading level={2}>Define two cultural profiles</Heading>
        </Card>
      </Main>
    </>
  );
}
