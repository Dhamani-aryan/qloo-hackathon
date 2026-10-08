"use client";

import { useState, type Dispatch } from "react";
import type { IntakeSideSummary } from "@/lib/intake/store";
import { Button, Dot } from "../ui";
import { postJson } from "./api";
import {
  MAX_SEEDS,
  seedKey,
  type Draft,
  type DraftAction,
  type DraftSeed,
  type SideKey,
} from "./draft";

interface Session {
  id: string;
  storage: "redis" | "memory";
  links: Record<SideKey, string>;
}

/**
 * Lets the organizer collect favourites from real participants instead of guessing:
 * create two share links, then import the aggregated picks as each community's profile.
 */
export function IntakePanel({
  draft,
  dispatch,
  onClose,
}: {
  draft: Draft;
  dispatch: Dispatch<DraftAction>;
  onClose?: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<SideKey | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setSession(
        await postJson<Session>("/api/intake", {
          title: draft.title,
          labels: { a: draft.a.label, b: draft.b.label },
        }),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importResponses = async () => {
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/intake/${session.id}`);
      if (!res.ok) throw new Error("Couldn't load responses");
      const { sides } = (await res.json()) as { sides: Record<SideKey, IntakeSideSummary> };
      const empty: string[] = [];
      for (const side of ["a", "b"] as const) {
        const s = sides[side];
        if (s.participants === 0) {
          empty.push(draft[side].label);
          continue;
        }
        const seeds: DraftSeed[] = s.entities.slice(0, MAX_SEEDS).map((e) => ({
          key: seedKey(),
          input: e.name,
          status: "resolved",
          matches: [
            {
              id: e.entityId,
              name: e.name,
              type: e.type,
              imageUrl: e.imageUrl,
              popularity: e.popularity,
              disambiguation: null,
              description: null,
            },
          ],
          chosenId: e.entityId,
          confirmed: true,
          reasons: [],
          weight: e.count,
        }));
        dispatch({
          type: "profile",
          side,
          patch: { source: "intake", contributorCount: s.participants },
        });
        // Replace the seeds: remove existing ones, then add the imported picks.
        for (const old of draft[side].seeds) dispatch({ type: "removeSeed", side, key: old.key });
        for (const seed of seeds) dispatch({ type: "addSeed", side, seed });
      }
      setMessage(
        empty.length
          ? `No responses yet from: ${empty.join(", ")}. Their seeds were kept.`
          : "Imported. Both profiles now come from participants' own picks.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (side: SideKey) => {
    if (!session) return;
    await navigator.clipboard.writeText(origin + session.links[side]).catch(() => {});
    setCopied(side);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="border-y border-line py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Each community gets its own link. Participants name up to three favourites on their phone
          (no account, no names) and you import the totals as the profiles.
        </p>
        {onClose && (
          <Button variant="link" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {!session ? (
        <Button variant="quiet" onClick={create} disabled={busy} className="mt-4">
          Create the two links
        </Button>
      ) : (
        <div className="mt-5 space-y-3">
          {(["a", "b"] as const).map((side) => (
            <div key={side} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex w-56 items-center gap-2 text-sm">
                <Dot tone={side} />
                <span className="truncate">{draft[side].label}</span>
              </span>
              <a
                href={session.links[side]}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2 hover:text-ink"
              >
                {origin + session.links[side]}
              </a>
              <Button variant="link" onClick={() => copy(side)}>
                {copied === side ? "Copied" : "Copy"}
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button variant="quiet" onClick={importResponses} disabled={busy}>
              Import responses
            </Button>
            {session.storage === "memory" && (
              <span className="text-xs text-warn">
                Development storage: responses reset when the server restarts.
              </span>
            )}
          </div>
        </div>
      )}
      {message && <p className="mt-4 text-sm text-ink-2">{message}</p>}
    </section>
  );
}
