"use client";

import { useState } from "react";
import type { Invitations as InvitationsData } from "@/lib/agent/invites";
import { Button, Dot, Kicker, Title } from "../ui";

/** Draft invitations for organizer review, each pitched in that group's own tastes. */
export function Invitations({
  invitations,
  labels,
}: {
  invitations: InvitationsData;
  labels: [string, string];
}) {
  const [copied, setCopied] = useState<"A" | "B" | null>(null);
  const copy = async (side: "A" | "B") => {
    const i = invitations[side];
    try {
      await navigator.clipboard.writeText(`${i.subject}\n\n${i.message}`);
      setCopied(side);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the text stays selectable.
    }
  };

  return (
    <section aria-label="Invitations">
      <Kicker tone="bridge">Get both groups through the door</Kicker>
      <Title level={2}>Invite each group</Title>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Draft messages. Replace the date and confirm venue, costs and access before sending. These
        messages have not been sent to anyone.
      </p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {(["A", "B"] as const).map((side, i) => (
          <article
            key={side}
            className="flex flex-col rounded-2xl border border-line bg-paper-2/40 p-5"
          >
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
              <Dot tone={side === "A" ? "a" : "b"} />
              For {labels[i]}
            </p>
            <p className="mt-3 font-medium">{invitations[side].subject}</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-2">
              {invitations[side].message}
            </p>
            <div className="mt-auto pt-4">
              <Button variant="link" onClick={() => copy(side)}>
                {copied === side ? "Copied" : "Copy"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
