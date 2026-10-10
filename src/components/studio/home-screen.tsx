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

/**
 * Resolve seeds through Qloo and write the results into the draft. All seeds of a scenario go
 * out in one request so the server can pace them (Qloo rate-limits bursts). The best match is
 * used straight away; unclear matches are flagged so the user can switch them with one tap.
 */
export function useSeedResolver(dispatch: Dispatch<DraftAction>) {
  /** `trusted`: curated examples, so don't flag unsure matches. */
  return async (batch: { side: SideKey; seeds: DraftSeed[] }[], trusted = false) => {
    const items = batch.flatMap(({ side, seeds }) => seeds.map((seed) => ({ side, seed })));
    if (items.length === 0) return;
    try {
      const results = await resolveSeeds(
        items.map(({ seed }) => ({ input: seed.input, type: seed.type })),
      );
      results.forEach((r, i) => {
        const { side, seed } = items[i];
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
                confirmed: true,
              }
            : { status: "unresolved", matches: [], reasons: r.reasons },
        });
      });
    } catch (err) {
      for (const { side, seed } of items) {
        dispatch({
          type: "updateSeed",
          side,
          key: seed.key,
          patch: { status: "error", reasons: [(err as Error).message] },
        });
      }
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
      <section className="space-y-3 text-center">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">Find common ground</h1>
        <p className="text-lg text-ink-2">
          Add a few things each group loves. We&apos;ll find what they share.
        </p>
      </section>

      <div className="mt-10 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <GroupBox side="a" profile={draft.a} dispatch={dispatch} resolve={resolve} />
        <div className="hidden items-center justify-center md:flex" aria-hidden>
          <span className="font-display text-2xl text-bridge">+</span>
        </div>
        <GroupBox side="b" profile={draft.b} dispatch={dispatch} resolve={resolve} />
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 sm:w-72">
          <span className="text-sm text-muted">City</span>
          <input
            value={draft.location}
            onChange={(e) => dispatch({ type: "set", patch: { location: e.target.value } })}
            placeholder="e.g. New York City"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <Button onClick={onRun} disabled={problems.length > 0} className="px-7 py-3.5 text-base">
          Find common ground →
        </Button>
      </div>
      <p className="mt-3 h-5 text-center text-sm text-muted" aria-live="polite">
        {problems[0] ?? ""}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
        <span>Try an example:</span>
        {PREBUILT.map((p) => (
          <ExampleLink key={p.id} active={draft.id === p.id} onClick={() => load(p.id)}>
            {p.title}
          </ExampleLink>
        ))}
        <ExampleLink active={false} onClick={() => load("custom")}>
          Clear
        </ExampleLink>
        <span aria-hidden>·</span>
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
  const full = profile.seeds.length >= MAX_SEEDS;
  const n = side === "a" ? 1 : 2;

  const add = () => {
    const name = input.trim();
    if (!name || full) return;
    const seed = newSeed(name);
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
        onChange={(e) => dispatch({ type: "profile", side, patch: { label: e.target.value } })}
        placeholder={side === "a" ? "e.g. University film club" : "e.g. Neighbourhood arts group"}
        aria-label={`Group ${n} name`}
        className="mt-2 w-full bg-transparent font-display text-2xl outline-none placeholder:text-muted/60"
      />

      <ul className="mt-4 flex flex-wrap gap-2">
        {profile.seeds.map((seed) => (
          <Chip key={seed.key} seed={seed} side={side} dispatch={dispatch} />
        ))}
      </ul>

      <form
        className="mt-auto pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={full}
          placeholder={full ? "That's plenty (8 max)" : "Type something they love and press Enter"}
          aria-label={`Add a favourite to group ${n}`}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1.5 text-xs text-muted">
          Artists, films, shows, books or places · {profile.seeds.length}/{MAX_SEEDS}
        </p>
      </form>
    </section>
  );
}

function Chip({
  seed,
  side,
  dispatch,
}: {
  seed: DraftSeed;
  side: SideKey;
  dispatch: Dispatch<DraftAction>;
}) {
  const [open, setOpen] = useState(false);
  const match = chosenMatch(seed);
  const unsure = seed.status === "resolved" && seed.reasons.length > 0;
  const failed = seed.status === "unresolved" || seed.status === "error";
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
              onClick={() => seed.matches.length > 1 && setOpen((v) => !v)}
              title={
                failed
                  ? "Not found in Qloo"
                  : match
                    ? `${match.name}${match.type ? ` · ${typeLabel(match.type)}` : ""}${seed.matches.length > 1 ? " · tap to change" : ""}`
                    : undefined
              }
              className="max-w-44 truncate text-left"
            >
              {match?.name ?? seed.input}
              {failed && " · not found"}
            </button>
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
        <ul className="absolute top-full left-0 z-20 mt-1 w-72 rounded-xl border border-line bg-paper p-1.5 shadow-lg">
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
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
