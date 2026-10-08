"use client";

import { useState, type Dispatch } from "react";
import type { IntakeSideSummary } from "@/lib/intake/store";
import { Badge, Button, Card, Eyebrow, Notice, cx } from "../ui";
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
}: {
  draft: Draft;
  dispatch: Dispatch<DraftAction>;
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
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <Eyebrow tone="bridge">Optional · Ask the communities</Eyebrow>
          <p className="text-sm text-muted">
            Instead of guessing what each group likes, send each community a link. Participants name
            up to three favourites (no account, no names) and you import the totals.
          </p>
        </div>
        {!session && (
          <Button variant="secondary" onClick={create} disabled={busy}>
            Create share links
          </Button>
        )}
      </div>

      {session && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <div
                key={side}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-2",
                  side === "a" ? "bg-a-soft" : "bg-b-soft",
                )}
              >
                <div className="min-w-0">
                  <p className={cx("text-xs font-semibold", side === "a" ? "text-a" : "text-b")}>
                    {draft[side].label}
                  </p>
                  <a
                    href={session.links[side]}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-xs text-ink underline-offset-2 hover:underline"
                  >
                    {origin + session.links[side]}
                  </a>
                </div>
                <Button variant="ghost" className="shrink-0 px-2 py-1" onClick={() => copy(side)}>
                  {copied === side ? "Copied" : "Copy"}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={importResponses} disabled={busy}>
              Import responses
            </Button>
            {session.storage === "memory" && (
              <Badge tone="warn">Dev storage: responses reset when the server restarts</Badge>
            )}
          </div>
        </div>
      )}
      {message && <Notice tone="neutral">{message}</Notice>}
    </Card>
  );
}
