"use client";

import { useState, type Dispatch } from "react";
import type { QlooTypeKey } from "@/lib/qloo/types";
import { PREBUILT } from "@/scenarios";
import { Badge, Button, Card, EntityTile, Eyebrow, Heading, Spinner, cx } from "../ui";
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
  no_exact_name_match: "No exact name match. Is this the one you meant?",
  duplicate_exact_names: "Several entities share this name. Pick the right one.",
  type_mismatch: "Qloo found a different type than requested.",
  no_results: "Qloo found nothing for this name.",
};

/** Resolve seeds through Qloo and write the results into the draft. */
export function useSeedResolver(dispatch: Dispatch<DraftAction>) {
  return async (side: SideKey, seeds: DraftSeed[], autoConfirm: boolean) => {
    if (seeds.length === 0) return;
    try {
      const results = await resolveSeeds(seeds.map((s) => ({ input: s.input, type: s.type })));
      results.forEach((r, i) => {
        const seed = seeds[i];
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
      for (const seed of seeds) {
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

  const load = (id: string) => {
    const preset = PREBUILT.find((p) => p.id === id);
    const next = preset ? draftFromPrebuilt(preset) : emptyDraft();
    dispatch({ type: "replace", draft: next });
    // Prebuilt seeds are curated, so they count as confirmed once Qloo resolves them.
    void resolve("a", next.a.seeds, Boolean(preset));
    void resolve("b", next.b.seeds, Boolean(preset));
  };

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <Eyebrow tone="bridge">Step 1 · Profiles</Eyebrow>
        <Heading level={1}>Who are you bringing together?</Heading>
        <p className="text-muted">
          Describe each community through cultural favourites its members actually named: artists,
          films, shows, books, podcasts, places. Qloo resolves each one; you confirm the match. The
          agent only ever works from confirmed entities.
        </p>
      </div>

      <section aria-label="Choose a scenario" className="grid gap-3 sm:grid-cols-3">
        {PREBUILT.map((p) => (
          <ScenarioCard
            key={p.id}
            title={p.title}
            summary={p.summary}
            active={draft.id === p.id}
            onClick={() => load(p.id)}
          />
        ))}
        <ScenarioCard
          title="Start from scratch"
          summary="Enter your own two communities and their favourites."
          active={draft.id.startsWith("custom")}
          onClick={() => load("custom")}
        />
      </section>

      <Card className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Program objective</span>
          <textarea
            value={draft.objective}
            onChange={(e) => dispatch({ type: "set", patch: { objective: e.target.value } })}
            rows={3}
            placeholder="e.g. A four-session program both groups keep coming back to"
            className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">City</span>
          <input
            value={draft.location}
            onChange={(e) => dispatch({ type: "set", patch: { location: e.target.value } })}
            placeholder="e.g. New York City"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
          <span className="block text-xs text-muted">Used for local venue suggestions.</span>
        </label>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <CommunityEditor side="a" profile={draft.a} dispatch={dispatch} resolve={resolve} />
        <CommunityEditor side="b" profile={draft.b} dispatch={dispatch} resolve={resolve} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        {problems.length ? (
          <ul className="space-y-1 text-sm text-muted">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">
            <span className="font-medium text-ok">Ready.</span>{" "}
            <span className="text-muted">
              {confirmedCount(draft.a) + confirmedCount(draft.b)} confirmed seeds. A full run takes
              about a minute.
            </span>
          </p>
        )}
        <Button onClick={onRun} disabled={problems.length > 0} className="shrink-0">
          Find common ground →
        </Button>
      </div>
    </div>
  );
}

function ScenarioCard({
  title,
  summary,
  active,
  onClick,
}: {
  title: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-2xl border p-4 text-left transition",
        active ? "border-bridge bg-bridge-soft" : "border-line bg-surface hover:border-bridge",
      )}
    >
      <p className="font-display text-lg">{title}</p>
      <p className="mt-1 text-sm text-muted">{summary}</p>
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
  const tone = side === "a" ? "a" : "b";
  const full = profile.seeds.length >= MAX_SEEDS;

  const add = () => {
    const name = input.trim();
    if (!name || full) return;
    const seed = newSeed(name, type || undefined);
    dispatch({ type: "addSeed", side, seed });
    void resolve(side, [seed], false);
    setInput("");
  };

  return (
    <Card tone={tone} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Eyebrow tone={tone}>Community {side.toUpperCase()}</Eyebrow>
          <input
            value={profile.label}
            onChange={(e) => dispatch({ type: "profile", side, patch: { label: e.target.value } })}
            aria-label={`Community ${side.toUpperCase()} name`}
            className="w-full rounded-lg border border-transparent bg-transparent font-display text-xl hover:border-line focus:border-line"
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={tone}>
            {confirmedCount(profile)}/{MAX_SEEDS} confirmed
          </Badge>
          <span className="text-xs text-muted">
            {profile.source === "intake"
              ? `From ${profile.contributorCount ?? 0} participants`
              : "Organizer-supplied"}
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {profile.seeds.map((seed) => (
          <SeedRow key={seed.key} seed={seed} side={side} dispatch={dispatch} />
        ))}
        {profile.seeds.length === 0 && (
          <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Add 3–8 favourites this community actually named.
          </li>
        )}
      </ul>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={full}
          placeholder={full ? "Maximum of 8 seeds" : "Add an artist, film, show, book…"}
          aria-label={`Add a seed to community ${side.toUpperCase()}`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as QlooTypeKey | "")}
          aria-label="Seed type"
          className="rounded-xl border border-line bg-paper px-3 py-2 text-sm"
        >
          {SEED_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" disabled={full || !input.trim()}>
          Add
        </Button>
      </form>
    </Card>
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
    <li
      className={cx(
        "rounded-xl border px-3 py-2",
        needsCheck ? "border-warn bg-warn-soft" : "border-line bg-paper",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {seed.status === "resolving" && <Spinner label={`Resolving “${seed.input}”…`} />}
          {(seed.status === "unresolved" || seed.status === "error") && (
            <p className="text-sm">
              <span className="font-medium">{seed.input}</span>{" "}
              <span className="text-danger">
                {seed.status === "error" ? "couldn't be resolved" : "has no Qloo match"}
              </span>
            </p>
          )}
          {match && (
            <EntityTile
              name={match.name}
              type={match.type}
              imageUrl={match.imageUrl}
              size="sm"
              tone={side}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {seed.confirmed && match && (
            <span className="px-1 text-sm text-ok" title="Confirmed Qloo match">
              ✓<span className="sr-only">Confirmed</span>
            </span>
          )}
          {needsCheck && (
            <Button
              variant="secondary"
              className="px-3 py-1"
              onClick={() => update({ confirmed: true })}
            >
              Confirm
            </Button>
          )}
          {seed.matches.length > 1 && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => setChoosing((v) => !v)}>
              {choosing ? "Done" : "Change"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="px-2 py-1"
            onClick={remove}
            aria-label={`Remove ${seed.input}`}
          >
            ✕
          </Button>
        </div>
      </div>
      {needsCheck && seed.reasons[0] && (
        <p className="mt-1 text-xs text-warn">{REASON_TEXT[seed.reasons[0]] ?? seed.reasons[0]}</p>
      )}
      {choosing && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2">
          {seed.matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  update({ chosenId: m.id, confirmed: true });
                  setChoosing(false);
                }}
                className={cx(
                  "w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-2",
                  m.id === seed.chosenId && "bg-surface-2",
                )}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-muted">
                  {" "}
                  · {m.type?.split(":").pop()}
                  {m.disambiguation ? ` · ${m.disambiguation}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
