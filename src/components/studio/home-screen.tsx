"use client";

import { useState, type Dispatch } from "react";
import { PREBUILT } from "@/scenarios";
import { Button, Dot, Spinner, Thumb, cx, typeLabel } from "../ui";
import {
  MAX_SEEDS,
  chosenMatch,
  draftFromPrebuilt,
  emptyDraft,
  newSeed,
  readiness,
  type Draft,
  type DraftAction,
  type DraftProfile,
  type DraftSeed,
  type SideKey,
} from "./draft";
import { resolveSeeds } from "./api";
import { IntakePanel } from "./intake-panel";
import { PlanningSettingsForm } from "./planning-settings";
import type { QlooTypeKey } from "@/lib/qloo/types";

const RETRY_DELAYS_MS = [1500, 4000];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve seeds through Qloo and write the results into the draft. All seeds of a scenario go
 * out in one request so the server can pace them (Qloo rate-limits bursts). Lookups Qloo was
 * too busy for are retried a couple of times, then shown as "couldn't check" (never as "not
 * found"). The best match is used straight away; unclear matches are flagged so the user can
 * switch them with one tap.
 */
export function useSeedResolver(dispatch: Dispatch<DraftAction>) {
  /** `trusted`: curated examples, so don't flag unsure matches. */
  return async (batch: { side: SideKey; seeds: DraftSeed[] }[], trusted = false) => {
    let pending = batch.flatMap(({ side, seeds }) => seeds.map((seed) => ({ side, seed })));
    if (pending.length === 0) return;
    for (const { side, seed } of pending) {
      dispatch({ type: "updateSeed", side, key: seed.key, patch: { status: "resolving" } });
    }
    let lastError = "Qloo is busy right now.";
    for (let attempt = 0; pending.length > 0 && attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await wait(RETRY_DELAYS_MS[attempt - 1]);
      const items = pending;
      pending = [];
      try {
        const results = await resolveSeeds(
          items.map(({ seed }) => ({ input: seed.input, type: seed.type })),
        );
        results.forEach((r, i) => {
          const { side, seed } = items[i];
          if (r.retry) {
            pending.push(items[i]);
            return;
          }
          dispatch({
            type: "updateSeed",
            side,
            key: seed.key,
            patch: r.bestId
              ? {
                  status: "resolved",
                  matches: r.matches,
                  chosenId: r.bestId,
                  reasons: r.ambiguous && !trusted ? r.reasons : [],
                  confirmed: trusted || !r.ambiguous,
                }
              : { status: "unresolved", matches: [], reasons: r.reasons },
          });
        });
      } catch (err) {
        lastError = (err as Error).message;
        pending = items;
      }
    }
    for (const { side, seed } of pending) {
      dispatch({
        type: "updateSeed",
        side,
        key: seed.key,
        patch: { status: "error", reasons: [lastError] },
      });
    }
  };
}

export function HomeScreen({
  draft,
  dispatch,
  onRun,
}: {
  draft: Draft;
  dispatch: Dispatch<DraftAction>;
  onRun: () => void;
}) {
  const resolve = useSeedResolver(dispatch);
  const problems = readiness(draft);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const load = (id: string) => {
    const preset = PREBUILT.find((p) => p.id === id);
    const isCustom = draft.id.startsWith("custom");
    if (!preset && isCustom) return; // already on their own groups
    // Don't silently throw away groups the organizer typed themselves.
    const typed =
      isCustom && [draft.a, draft.b].some((p) => p.seeds.length > 0 || p.label.trim().length > 0);
    if (typed && !window.confirm("Replace your groups with this example?")) return;
    const next = preset ? draftFromPrebuilt(preset) : emptyDraft();
    dispatch({ type: "replace", draft: next });
    void resolve(
      [
        { side: "a", seeds: next.a.seeds },
        { side: "b", seeds: next.b.seeds },
      ],
      Boolean(preset),
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <section className="max-w-3xl space-y-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-bridge uppercase">
          Different tastes. A shared starting point.
        </p>
        <h1 className="font-display text-5xl leading-[1.04] sm:text-7xl">
          Find a reason
          <br />
          to come together.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-ink-2">
          Turn what two groups love into something they can do together. Explore cultural
          connections, choose a bridge, and shape a practical four-session program.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-line py-4 text-sm">
        <span className="text-muted">Start with your groups below, or try:</span>
        {PREBUILT.map((p) => (
          <ExampleLink key={p.id} active={draft.id === p.id} onClick={() => load(p.id)}>
            {p.title} ↗
          </ExampleLink>
        ))}
        <ExampleLink active={draft.id.startsWith("custom")} onClick={() => load("custom")}>
          Use my groups
        </ExampleLink>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <GroupBox side="a" profile={draft.a} dispatch={dispatch} resolve={resolve} />
        <div className="hidden items-center justify-center md:flex" aria-hidden>
          <span className="font-display text-2xl text-bridge">+</span>
        </div>
        <GroupBox side="b" profile={draft.b} dispatch={dispatch} resolve={resolve} />
      </div>

      <PlanningSettingsForm settings={draft.settings} dispatch={dispatch} />

      <div className="mt-8 grid gap-4 sm:grid-cols-[15rem_1fr]">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 md:w-60">
          <span className="text-sm text-muted">City</span>
          <input
            value={draft.location}
            onChange={(e) => dispatch({ type: "set", patch: { location: e.target.value } })}
            placeholder="e.g. New York City"
            maxLength={160}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
          <span className="text-sm whitespace-nowrap text-muted">Notes</span>
          <input
            value={draft.instructions}
            onChange={(e) =>
              dispatch({ type: "set", patch: { instructions: e.target.value.slice(0, 400) } })
            }
            placeholder="Optional: all ages, free, about food…"
            aria-label="Notes for the agent (optional)"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-sm text-muted" aria-live="polite">
          {problems[0] ??
            "Ready to explore. Cultural fit comes from Qloo; the activity plan is a draft for your review."}
        </p>
        <Button
          onClick={onRun}
          disabled={problems.length > 0}
          className="shrink-0 px-7 py-3.5 text-base"
        >
          Find common ground →
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
        <button
          type="button"
          onClick={() => setIntakeOpen((v) => !v)}
          className="text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
        >
          Let each group add their own
        </button>
      </div>

      {intakeOpen && (
        <div className="mt-8">
          <IntakePanel draft={draft} dispatch={dispatch} onClose={() => setIntakeOpen(false)} />
        </div>
      )}
    </div>
  );
}

function ExampleLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "underline-offset-4 hover:text-ink",
        active ? "text-ink underline decoration-ink" : "text-ink-2 underline decoration-line",
      )}
    >
      {children}
    </button>
  );
}

function GroupBox({
  side,
  profile,
  dispatch,
  resolve,
}: {
  side: SideKey;
  profile: DraftProfile;
  dispatch: Dispatch<DraftAction>;
  resolve: ReturnType<typeof useSeedResolver>;
}) {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<QlooTypeKey | "">("");
  const full = profile.seeds.length >= MAX_SEEDS;
  const n = side === "a" ? 1 : 2;

  const add = () => {
    const name = input.trim();
    if (!name || full) return;
    if (profile.seeds.some((s) => s.input.toLowerCase() === name.toLowerCase())) return;
    const seed = newSeed(name, inputType || undefined);
    dispatch({ type: "addSeed", side, seed });
    void resolve([{ side, seeds: [seed] }]);
    setInput("");
  };

  return (
    <section
      aria-label={`Group ${n}`}
      className={cx(
        "flex min-h-72 flex-col rounded-2xl border border-line bg-paper-2/40 p-5",
        side === "a" ? "border-t-[3px] border-t-a" : "border-t-[3px] border-t-b",
      )}
    >
      <div className="flex items-center gap-2">
        <Dot tone={side} />
        <span
          className={cx(
            "text-xs font-semibold tracking-wider uppercase",
            side === "a" ? "text-a" : "text-b",
          )}
        >
          Group {n}
        </span>
      </div>
      <input
        value={profile.label}
        maxLength={100}
        onChange={(e) => dispatch({ type: "profile", side, patch: { label: e.target.value } })}
        placeholder={side === "a" ? "e.g. University film club" : "e.g. Neighbourhood arts group"}
        aria-label={`Group ${n} name`}
        className="mt-2 w-full bg-transparent font-display text-2xl outline-none placeholder:text-muted/60"
      />

      <ul className="mt-4 flex flex-wrap gap-2">
        {profile.seeds.map((seed) => (
          <Chip
            key={seed.key}
            seed={seed}
            side={side}
            dispatch={dispatch}
            onRetry={() => void resolve([{ side, seeds: [seed] }])}
          />
        ))}
      </ul>

      <form
        className="mt-auto pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            Search in
            <select
              aria-label={`Favourite type for group ${n}`}
              value={inputType}
              onChange={(e) => setInputType(e.target.value as QlooTypeKey | "")}
              className="rounded border border-line bg-paper px-2 py-1"
            >
              <option value="">All culture</option>
              <option value="artist">Music</option>
              <option value="movie">Films</option>
              <option value="tvShow">TV</option>
              <option value="book">Books</option>
              <option value="videoGame">Games</option>
              <option value="podcast">Podcasts</option>
              <option value="place">Places</option>
            </select>
          </label>
          <span className="text-xs text-muted">
            {profile.seeds.length}/{MAX_SEEDS}
          </span>
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={full}
          maxLength={120}
          placeholder={full ? "That's plenty (8 max)" : "Type something they love and press Enter"}
          aria-label={`Add a favourite to group ${n}`}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1.5 text-xs text-muted">
          Add at least 3 favorites. Check the type on each match.
        </p>
      </form>
    </section>
  );
}

function Chip({
  seed,
  side,
  dispatch,
  onRetry,
}: {
  seed: DraftSeed;
  side: SideKey;
  dispatch: Dispatch<DraftAction>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const match = chosenMatch(seed);
  const unsure = seed.status === "resolved" && seed.reasons.length > 0;
  const failed = seed.status === "unresolved" || seed.status === "error";
  const unchecked = seed.status === "error";
  const remove = () => dispatch({ type: "removeSeed", side, key: seed.key });

  return (
    <li className="relative">
      <span
        className={cx(
          "flex items-center gap-2 rounded-full border py-1 pr-1.5 pl-1 text-sm",
          failed ? "border-warn/60 text-warn" : unsure ? "border-warn/60" : "border-line bg-paper",
        )}
      >
        {seed.status === "resolving" ? (
          <span className="pl-2">
            <Spinner label={seed.input} />
          </span>
        ) : (
          <>
            {match ? (
              <Thumb src={match.imageUrl} name={match.name} size={24} tone={side} />
            ) : (
              <span className="pl-1.5" />
            )}
            <button
              type="button"
              onClick={() => seed.matches.length > 0 && setOpen((v) => !v)}
              title={
                unchecked
                  ? `Couldn't check with Qloo: ${seed.reasons[0] ?? "try again"}`
                  : failed
                    ? "Not found in Qloo"
                    : match
                      ? `${match.name}${match.type ? ` · ${typeLabel(match.type)}` : ""}${seed.matches.length > 1 ? " · tap to change" : ""}`
                      : undefined
              }
              className="max-w-44 truncate text-left"
            >
              {match?.name ?? seed.input}
              {failed && !unchecked && " · not found"}
            </button>
            {match?.type && <span className="text-[10px] text-muted">{typeLabel(match.type)}</span>}
            {unchecked && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs whitespace-nowrap underline underline-offset-2"
              >
                couldn&apos;t check · retry
              </button>
            )}
            {unsure && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-warn-soft text-xs text-warn"
                aria-label="Unsure match, choose the right one"
              >
                ?
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={remove}
          aria-label={`Remove ${seed.input}`}
          className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-paper-2 hover:text-ink"
        >
          ×
        </button>
      </span>

      {open && seed.matches.length > 0 && (
        <ul className="absolute top-full left-0 z-20 mt-1 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-paper p-1.5 shadow-lg">
          <li className="px-2 py-1 text-xs text-muted">Which one did you mean?</li>
          {seed.matches.slice(0, 5).map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "updateSeed",
                    side,
                    key: seed.key,
                    patch: { chosenId: m.id, confirmed: true, reasons: [] },
                  });
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2",
                  m.id === seed.chosenId && "bg-paper-2",
                )}
              >
                <Thumb src={m.imageUrl} name={m.name} size={28} tone={side} />
                <span className="min-w-0">
                  <span className="block truncate">{m.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {m.type ? typeLabel(m.type) : ""}
                    {m.disambiguation && m.disambiguation !== m.name
                      ? ` · ${m.disambiguation}`
                      : ""}
                  </span>
                  {m.description && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {m.description.slice(0, 150)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
