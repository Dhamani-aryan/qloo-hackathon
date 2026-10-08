"use client";

import { useState, type Dispatch } from "react";
import type { QlooTypeKey } from "@/lib/qloo/types";
import { PREBUILT } from "@/scenarios";
import { Button, Dot, Kicker, Lede, Rule, Spinner, Thumb, Title, cx, typeLabel } from "../ui";
import {
  MAX_SEEDS,
  chosenMatch,
  confirmedCount,
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

const SEED_TYPES: { key: QlooTypeKey | ""; label: string }[] = [
  { key: "", label: "Any type" },
  { key: "artist", label: "Artist" },
  { key: "movie", label: "Film" },
  { key: "tvShow", label: "TV show" },
  { key: "book", label: "Book" },
  { key: "podcast", label: "Podcast" },
  { key: "place", label: "Place" },
];

const REASON_TEXT: Record<string, string> = {
  no_exact_name_match: "No exact match. Is this the one you meant?",
  duplicate_exact_names: "Several titles share this name. Check it's the right one.",
  type_mismatch: "Qloo found a different type than you asked for.",
  no_results: "Qloo found nothing for this name.",
};

/**
 * Resolve seeds through Qloo and write the results into the draft. All seeds of a scenario
 * go out in one request so the server can pace them (Qloo rate-limits bursts).
 */
export function useSeedResolver(dispatch: Dispatch<DraftAction>) {
  return async (batch: { side: SideKey; seeds: DraftSeed[] }[], autoConfirm: boolean) => {
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
                reasons: r.reasons,
                confirmed: autoConfirm || !r.ambiguous,
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

export function ProfilesScreen({
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
    // Prebuilt seeds are curated, so they count as confirmed once Qloo resolves them.
    void resolve(
      [
        { side: "a", seeds: next.a.seeds },
        { side: "b", seeds: next.b.seeds },
      ],
      Boolean(preset),
    );
  };

  return (
    <div>
      <section className="max-w-3xl space-y-6">
        <Title>Find what two communities would genuinely want to do together.</Title>
        <Lede>
          Give each community&apos;s favourite artists, films, shows and books. Common Ground uses
          Qloo&apos;s cultural intelligence to find what both groups love that isn&apos;t just what
          everyone loves, then designs a recurring program around it.
        </Lede>
      </section>

      <section className="mt-14 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <span className="text-muted">Start from</span>
        {PREBUILT.map((p) => (
          <ScenarioTab key={p.id} active={draft.id === p.id} onClick={() => load(p.id)}>
            {p.title}
          </ScenarioTab>
        ))}
        <ScenarioTab active={draft.id.startsWith("custom")} onClick={() => load("custom")}>
          Your own
        </ScenarioTab>
      </section>

      <Rule className="mt-4" />

      <section className="grid gap-8 py-10 md:grid-cols-[1fr_16rem]">
        <label className="block">
          <Kicker>The brief</Kicker>
          <textarea
            value={draft.objective}
            onChange={(e) => dispatch({ type: "set", patch: { objective: e.target.value } })}
            rows={2}
            placeholder="What should the program achieve? e.g. four sessions both groups keep coming back to"
            className="mt-2 field-sizing-content w-full resize-none overflow-hidden bg-transparent font-display text-xl leading-snug outline-none"
          />
        </label>
        <label className="block">
          <Kicker>City</Kicker>
          <input
            value={draft.location}
            onChange={(e) => dispatch({ type: "set", patch: { location: e.target.value } })}
            placeholder="e.g. New York City"
            className="mt-2 w-full border-b border-line bg-transparent pb-1 font-display text-xl outline-none focus:border-ink"
          />
          <span className="mt-2 block text-xs text-muted">For local venue suggestions.</span>
        </label>
      </section>

      <Rule />

      <section className="grid gap-x-16 gap-y-12 py-10 md:grid-cols-2">
        <CommunityEditor side="a" profile={draft.a} dispatch={dispatch} resolve={resolve} />
        <CommunityEditor side="b" profile={draft.b} dispatch={dispatch} resolve={resolve} />
      </section>

      <div className="text-sm">
        {intakeOpen ? (
          <IntakePanel draft={draft} dispatch={dispatch} onClose={() => setIntakeOpen(false)} />
        ) : (
          <p className="text-muted">
            Rather ask the communities themselves?{" "}
            <Button variant="link" onClick={() => setIntakeOpen(true)}>
              Send each one a link
            </Button>
          </p>
        )}
      </div>

      <div className="mt-12 flex flex-col gap-4 border-t border-ink pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {problems.length ? (
            <ul className="space-y-0.5 text-muted">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">
              {confirmedCount(draft.a) + confirmedCount(draft.b)} confirmed favourites. The agent
              takes about a minute, or a few seconds for a run it has seen before.
            </p>
          )}
        </div>
        <Button onClick={onRun} disabled={problems.length > 0} className="shrink-0">
          Find common ground
        </Button>
      </div>
    </div>
  );
}

function ScenarioTab({
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
      aria-pressed={active}
      className={cx(
        "font-medium transition",
        active ? "text-ink underline decoration-2 underline-offset-8" : "text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function CommunityEditor({
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
  const [type, setType] = useState<QlooTypeKey | "">("");
  const full = profile.seeds.length >= MAX_SEEDS;
  const failed = profile.seeds.filter((s) => s.status === "error");
  const confirmed = confirmedCount(profile);

  const add = () => {
    const name = input.trim();
    if (!name || full) return;
    const seed = newSeed(name, type || undefined);
    dispatch({ type: "addSeed", side, seed });
    void resolve([{ side, seeds: [seed] }], false);
    setInput("");
  };

  const retryFailed = () => {
    for (const seed of failed) {
      dispatch({
        type: "updateSeed",
        side,
        key: seed.key,
        patch: { status: "resolving", reasons: [] },
      });
    }
    void resolve([{ side, seeds: failed }], false);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Dot tone={side} />
        <Kicker tone={side}>Community {side.toUpperCase()}</Kicker>
      </div>
      <input
        value={profile.label}
        onChange={(e) => dispatch({ type: "profile", side, patch: { label: e.target.value } })}
        aria-label={`Community ${side.toUpperCase()} name`}
        className="mt-2 w-full bg-transparent font-display text-2xl outline-none"
      />
      <p className="mt-1 text-xs text-muted">
        {confirmed} of {MAX_SEEDS} favourites ·{" "}
        {profile.source === "intake"
          ? `from ${profile.contributorCount ?? 0} participant${profile.contributorCount === 1 ? "" : "s"}`
          : "supplied by the organizer"}
      </p>

      <ul className="mt-5 border-t border-line">
        {profile.seeds.map((seed) => (
          <SeedRow key={seed.key} seed={seed} side={side} dispatch={dispatch} />
        ))}
        {profile.seeds.length === 0 && (
          <li className="border-b border-line py-6 text-sm text-muted">
            Add three to eight favourites this community actually named.
          </li>
        )}
      </ul>

      {failed.length > 0 && (
        <p className="mt-3 text-sm text-warn">
          {failed.length} couldn&apos;t reach Qloo.{" "}
          <Button variant="link" onClick={retryFailed} className="text-warn">
            Retry
          </Button>
        </p>
      )}

      {!full && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a favourite…"
            aria-label={`Add a favourite to community ${side.toUpperCase()}`}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1.5 text-sm outline-none focus:border-line"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QlooTypeKey | "")}
            aria-label="Type"
            className="bg-transparent text-xs text-muted outline-none"
          >
            {SEED_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="link" disabled={!input.trim()}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

function SeedRow({
  seed,
  side,
  dispatch,
}: {
  seed: DraftSeed;
  side: SideKey;
  dispatch: Dispatch<DraftAction>;
}) {
  const [choosing, setChoosing] = useState(false);
  const match = chosenMatch(seed);
  const update = (patch: Partial<DraftSeed>) =>
    dispatch({ type: "updateSeed", side, key: seed.key, patch });
  const remove = () => dispatch({ type: "removeSeed", side, key: seed.key });
  const needsCheck = seed.status === "resolved" && !seed.confirmed;

  return (
    <li className="group border-b border-line py-2.5">
      <div className="flex items-center gap-3">
        {match ? (
          <Thumb src={match.imageUrl} name={match.name} size={36} tone={side} />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-[3px] bg-paper-2" />
        )}
        <div className="min-w-0 flex-1">
          {seed.status === "resolving" && <Spinner label={seed.input} />}
          {(seed.status === "unresolved" || seed.status === "error") && (
            <p className="text-sm">
              {seed.input}{" "}
              <span className="text-warn">
                · {seed.status === "error" ? "couldn't reach Qloo" : "no Qloo match"}
              </span>
            </p>
          )}
          {match && (
            <>
              <p className="truncate text-sm text-ink" title={match.name}>
                {match.name}
              </p>
              <p className="truncate text-xs text-muted">
                {match.type ? typeLabel(match.type) : ""}
                {match.disambiguation && match.disambiguation !== match.name
                  ? ` · ${match.disambiguation}`
                  : ""}
                {seed.weight > 1 ? ` · named by ${seed.weight}` : ""}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {needsCheck && (
            <Button
              variant="link"
              className="text-warn"
              onClick={() => update({ confirmed: true })}
            >
              Confirm
            </Button>
          )}
          {seed.matches.length > 1 && (
            <button
              type="button"
              onClick={() => setChoosing((v) => !v)}
              className="text-muted opacity-100 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              {choosing ? "Done" : "Change"}
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${seed.input}`}
            className="text-muted opacity-100 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          >
            Remove
          </button>
        </div>
      </div>
      {needsCheck && seed.reasons[0] && (
        <p className="mt-1.5 pl-12 text-xs text-warn">
          {REASON_TEXT[seed.reasons[0]] ?? seed.reasons[0]}
        </p>
      )}
      {choosing && (
        <ul className="mt-2 space-y-0.5 pl-12">
          {seed.matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  update({ chosenId: m.id, confirmed: true });
                  setChoosing(false);
                }}
                className={cx(
                  "w-full py-1 text-left text-sm hover:text-ink",
                  m.id === seed.chosenId ? "text-ink" : "text-ink-2",
                )}
              >
                {m.id === seed.chosenId ? "● " : "○ "}
                {m.name}
                <span className="text-muted">
                  {" "}
                  · {m.type ? typeLabel(m.type) : "?"}
                  {m.disambiguation && m.disambiguation !== m.name ? ` · ${m.disambiguation}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
