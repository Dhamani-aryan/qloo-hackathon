"use client";

import { useState } from "react";
import type { Pick } from "@/lib/intake/store";
import { resolveSeeds, postJson } from "./studio/api";
import type { Match } from "./studio/draft";
import { Mark } from "./shell";
import { Button, Dot, Kicker, Note, Spinner, Thumb, Title, typeLabel } from "./ui";

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
      <div className="space-y-4 pt-10">
        <Mark size={40} />
        <Title level={2}>Thank you.</Title>
        <p className="text-ink-2">
          Your favourites now count towards <span className="text-ink">{label}</span>. Only the
          titles are counted, alongside everyone else&apos;s. Nothing identifies you.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <Kicker tone={tone}>{title}</Kicker>
        </div>
        <Title>What do you love?</Title>
        <p className="leading-relaxed text-ink-2">
          You&apos;re helping <span className="text-ink">{label}</span> plan a program with another
          community. Name up to three favourite artists, films, shows, books, podcasts or places.
        </p>
      </div>

      <ol className="mt-10 border-t border-ink">
        {slots.map((slot, i) => (
          <li key={i} className="border-b border-line py-4">
            <div className="flex items-center gap-3">
              <span className="figures w-5 shrink-0 font-display text-lg text-muted">{i + 1}</span>
              {slot.pick ? (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumb src={slot.pick.imageUrl} name={slot.pick.name} size={40} tone={tone} />
                  <p className="min-w-0 flex-1">
                    <span className="block truncate">{slot.pick.name}</span>
                    <span className="block text-xs text-muted">
                      {slot.pick.type ? typeLabel(slot.pick.type) : ""}
                    </span>
                  </p>
                  <Button variant="link" onClick={() => update(i, emptySlot())}>
                    Change
                  </Button>
                </div>
              ) : (
                <form
                  className="flex min-w-0 flex-1 items-center gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void search(i);
                  }}
                >
                  <input
                    value={slot.query}
                    onChange={(e) => update(i, { query: e.target.value, status: "idle" })}
                    placeholder={
                      ["e.g. Joni Mitchell", "e.g. Lady Bird", "e.g. a café you love"][i]
                    }
                    aria-label={`Favourite ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent py-1 text-lg outline-none"
                  />
                  <Button type="submit" variant="link" disabled={!slot.query.trim()}>
                    Find
                  </Button>
                </form>
              )}
            </div>
            {slot.status === "searching" && (
              <div className="mt-2 pl-8">
                <Spinner label="Looking it up…" />
              </div>
            )}
            {slot.status === "none" && (
              <p className="mt-2 pl-8 text-sm text-muted">No match. Try another spelling.</p>
            )}
            {slot.status === "choosing" && !slot.pick && (
              <div className="mt-3 pl-8">
                <p className="text-xs text-muted">Which one?</p>
                <ul className="mt-1">
                  {slot.matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => update(i, { pick: m, status: "picked" })}
                        className="flex w-full items-center gap-3 py-2 text-left hover:text-ink"
                      >
                        <Thumb src={m.imageUrl} name={m.name} size={32} tone={tone} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{m.name}</span>
                          <span className="block text-xs text-muted">
                            {m.type ? typeLabel(m.type) : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      {state === "error" && (
        <div className="mt-6">
          <Note tone="warn">Couldn&apos;t send your picks: {error}</Note>
        </div>
      )}

      <Button
        onClick={submit}
        disabled={picks.length === 0 || state === "sending"}
        className="mt-8 w-full py-3"
      >
        {state === "sending"
          ? "Sending…"
          : picks.length
            ? `Share ${picks.length} favourite${picks.length === 1 ? "" : "s"}`
            : "Pick at least one"}
      </Button>
      <p className="mt-4 text-center text-xs text-muted">
        No account and no names. Only the titles you pick are counted.
      </p>
    </div>
  );
}
