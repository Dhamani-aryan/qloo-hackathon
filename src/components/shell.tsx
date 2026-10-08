import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./ui";

export const STEPS = [
  { key: "profiles", label: "Profiles" },
  { key: "investigate", label: "Investigate" },
  { key: "bridges", label: "Bridges" },
  { key: "program", label: "Program" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

/** Two overlapping circles: community A, community B, and the bridge where they meet. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 2) / 3} viewBox="0 0 36 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--a)" strokeWidth="2" />
      <circle cx="24" cy="12" r="10" fill="none" stroke="var(--b)" strokeWidth="2" />
      <path d="M18 4a10 10 0 0 1 0 16a10 10 0 0 1 0-16z" fill="var(--bridge)" />
    </svg>
  );
}

export function TopBar({
  current,
  reachable,
  onSelect,
}: {
  current?: StepKey;
  reachable?: StepKey[];
  onSelect?: (step: StepKey) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur print:static">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[1.05rem] tracking-tight whitespace-nowrap">
            Common Ground
          </span>
        </Link>
        {current && (
          <nav aria-label="Progress" className="print:hidden">
            <ol className="flex items-center gap-1 sm:gap-5">
              {STEPS.map((s, i) => {
                const active = s.key === current;
                const enabled = reachable?.includes(s.key) && !active;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => onSelect?.(s.key)}
                      aria-current={active ? "step" : undefined}
                      className={cx(
                        "flex items-baseline gap-1.5 px-1 py-4 text-sm transition",
                        active
                          ? "border-b-2 border-ink text-ink"
                          : enabled
                            ? "text-ink-2 hover:text-ink"
                            : "text-muted/60",
                      )}
                    >
                      <span className="figures text-[11px] text-muted">0{i + 1}</span>
                      <span className={cx(!active && "hidden sm:inline")}>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-24 sm:px-8 sm:pt-16">
      {children}
    </main>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-8 text-xs leading-relaxed text-muted sm:grid-cols-2 sm:px-8">
        <p>
          Cultural evidence from Qloo. Profiles are aggregate, voluntarily supplied signals, not
          descriptions of individuals; sensitive traits are never inferred.
        </p>
        <p className="sm:text-right">
          Programs are drafts for co-design with both communities. They don&apos;t predict social
          impact.
        </p>
      </div>
    </footer>
  );
}
