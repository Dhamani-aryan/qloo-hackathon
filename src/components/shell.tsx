import type { ReactNode } from "react";
import { cx } from "./ui";

export const STEPS = [
  { key: "profiles", label: "Profiles", hint: "Who's coming together" },
  { key: "investigate", label: "Investigate", hint: "The agent queries Qloo" },
  { key: "bridges", label: "Bridges", hint: "Obvious vs discovered" },
  { key: "program", label: "Program", hint: "A recurring plan" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-display text-xl leading-none tracking-tight">COMMON GROUND</p>
            <p className="mt-1 text-xs text-muted">
              What two communities would genuinely want to do together
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">
          Cultural evidence by <span className="font-medium text-ink">Qloo</span>
        </p>
      </div>
    </header>
  );
}

/** Two overlapping circles: community A, community B, and the bridge where they meet. */
function Logo() {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--a)" strokeWidth="2.5" />
      <circle cx="24" cy="12" r="10" fill="none" stroke="var(--b)" strokeWidth="2.5" />
      <path
        d="M18 4.2a10 10 0 0 1 0 15.6a10 10 0 0 1 0-15.6z"
        fill="var(--bridge)"
        opacity="0.85"
      />
    </svg>
  );
}

export function Stepper({
  current,
  reachable,
  onSelect,
}: {
  current: StepKey;
  /** Steps the user can navigate back or forward to. */
  reachable: StepKey[];
  onSelect: (step: StepKey) => void;
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const active = s.key === current;
          const done = i < currentIndex;
          const enabled = reachable.includes(s.key) && !active;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onSelect(s.key)}
                aria-current={active ? "step" : undefined}
                className={cx(
                  "w-full border-t-2 pt-2 text-left transition",
                  active ? "border-bridge" : done ? "border-ink" : "border-line",
                  enabled && "hover:border-bridge",
                  !enabled && !active && "cursor-default",
                )}
              >
                <span
                  className={cx(
                    "block text-xs font-semibold",
                    active ? "text-bridge" : done ? "text-ink" : "text-muted",
                  )}
                >
                  {i + 1}. {s.label}
                </span>
                <span className="hidden text-xs text-muted sm:block">{s.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>;
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-xs text-muted sm:px-6">
        <p>
          Profiles are aggregate, voluntarily supplied cultural signals, not descriptions of
          individuals. COMMON GROUND never infers religion, ethnicity, politics or other sensitive
          traits.
        </p>
        <p>
          Programs are draft hypotheses for co-design with both communities. They don&apos;t predict
          social impact.
        </p>
      </div>
    </footer>
  );
}
