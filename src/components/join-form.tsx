"use client";

import { useState } from "react";
import type { Pick } from "@/lib/intake/store";
import { resolveSeeds, postJson } from "./studio/api";
import type { Match } from "./studio/draft";
import { Button, Card, EntityTile, Eyebrow, Heading, Notice, Spinner, cx } from "./ui";

const SLOTS = 3;

interface Slot {
  query: string;
  status: "idle" | "searching" | "choosing" | "picked" | "none";
  matches: Match[];
  pick: Match | null;
}

const emptySlot = (): Slot => ({ query: "", status: "idle", matches: [], pick: null });

/** A participant names up to three favourites; each is matched to a Qloo entity they confirm. */
export function JoinForm({
  id,
  side,
  label,
  title,
}: {
  id: string;
  side: "a" | "b";
  label: string;
  title: string;
}) {
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: SLOTS }, emptySlot));
  const [state, setState] = useState<"editing" | "sending" | "sent" | "error">("editing");
  const [error, setError] = useState<string | null>(null);
  const tone = side;

  const update = (i: number, patch: Partial<Slot>) =>
    setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const search = async (i: number) => {
    const query = slots[i].query.trim();
    if (!query) return;
    update(i, { status: "searching" });
    try {
      const [r] = await resolveSeeds([{ input: query }]);
      const matches = r.matches.slice(0, 4);
      update(i, matches.length ? { status: "choosing", matches } : { status: "none", matches });
    } catch {
      update(i, { status: "none", matches: [] });
    }
  };

  const picks: Pick[] = slots.flatMap((s) =>
    s.pick
      ? [
          {
            entityId: s.pick.id,
            name: s.pick.name,
            type: s.pick.type,
            imageUrl: s.pick.imageUrl,
            popularity: s.pick.popularity,
          },
        ]
      : [],
  );

  const submit = async () => {
    setState("sending");
    try {
      await postJson(`/api/intake/${id}/${side}`, { picks });
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <Card tone={tone} className="space-y-3 text-center">
        <Heading level={2}>Thank you!</Heading>
        <p className="text-muted">
          Your picks were added to <span className="font-medium text-ink">{label}</span>. Only the
          titles are counted. Nothing identifies you.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Eyebrow tone={tone}>{title}</Eyebrow>
        <Heading level={1}>What do you love?</Heading>
        <p className="text-muted">
          You&apos;re helping <span className="font-medium text-ink">{label}</span> plan a program
          with another community. Name up to three favourite artists, films, shows, books, podcasts
          or places.
        </p>
      </div>

      <ol className="space-y-3">
        {slots.map((slot, i) => (
          <li key={i}>
            <Card className="space-y-3 p-4">
              {slot.pick ? (
                <div className="flex items-center justify-between gap-3">
                  <EntityTile
                    name={slot.pick.name}
                    type={slot.pick.type}
                    imageUrl={slot.pick.imageUrl}
                    tone={tone}
                  />
                  <Button variant="ghost" onClick={() => update(i, emptySlot())}>
                    Change
                  </Button>
                </div>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void search(i);
                  }}
                >
                  <input
                    value={slot.query}
                    onChange={(e) => update(i, { query: e.target.value, status: "idle" })}
                    placeholder={
                      ["e.g. Joni Mitchell", "e.g. Lady Bird", "e.g. your favourite café"][i]
                    }
                    aria-label={`Favourite ${i + 1}`}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2"
                  />
                  <Button type="submit" variant="secondary" disabled={!slot.query.trim()}>
                    Find
                  </Button>
                </form>
              )}
              {slot.status === "searching" && <Spinner label="Looking it up…" />}
              {slot.status === "none" && (
                <p className="text-sm text-muted">No match found. Try another spelling.</p>
              )}
              {slot.status === "choosing" && !slot.pick && (
                <div className="space-y-1">
                  <p className="text-xs text-muted">Which one did you mean?</p>
                  {slot.matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => update(i, { pick: m, status: "picked" })}
                      className={cx(
                        "flex w-full items-center rounded-xl border border-line px-3 py-2 text-left hover:border-bridge",
                      )}
                    >
                      <EntityTile
                        name={m.name}
                        type={m.type}
                        imageUrl={m.imageUrl}
                        size="sm"
                        tone={tone}
                      />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ol>

      {state === "error" && <Notice tone="warn">Couldn&apos;t send your picks: {error}</Notice>}

      <Button
        onClick={submit}
        disabled={picks.length === 0 || state === "sending"}
        className="w-full py-3"
      >
        {state === "sending"
          ? "Sending…"
          : `Share ${picks.length || ""} favourite${picks.length === 1 ? "" : "s"}`}
      </Button>
      <p className="text-center text-xs text-muted">
        No account, no names. Only the titles you pick are counted, together with everyone
        else&apos;s.
      </p>
    </div>
  );
}
