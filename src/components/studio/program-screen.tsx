"use client";

import { useState } from "react";
import type { EvidenceBrief } from "@/lib/agent/brief";
import type { CritiqueIssue } from "@/lib/agent/critic";
import type { Program } from "@/lib/agent/program";
import type { EngineResult } from "@/lib/engine/types";
import { Button, Dot, Kicker, Lede, More, Note, Spinner, Thumb, Title, cx, typeLabel } from "../ui";
import { postJson } from "./api";

export interface ProgramVersion {
  program: Program;
  critique: CritiqueIssue[];
}

const CHECK_LABELS: Record<string, string> = {
  passive_audience: "One group watching the other",
  expertise_barrier: "Required prior expertise",
  diversity_seminar: "Felt like a diversity seminar",
  decorative_bridge: "Bridge was decorative",
  one_off: "Not genuinely recurring",
  cost_or_access: "Cost or access barrier",
  unattractive_alone: "Unappealing on its own",
  tokenism: "Tokenism",
  unsupported_claims: "Unsupported claims",
  generic_roles: "Interchangeable roles",
};

export function ProgramScreen({
  version,
  engine,
  brief,
  labels,
  onRegenerated,
  comparison,
}: {
  version: ProgramVersion;
  engine: EngineResult;
  brief: EvidenceBrief | null;
  labels: [string, string];
  onRegenerated: (v: ProgramVersion) => void;
  /** The with/without-Qloo view, rendered under the program. */
  comparison?: React.ReactNode;
}) {
  const { program, critique } = version;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bridges = brief?.entities.filter((e) => e.role === "bridge") ?? [];
  const main = brief?.entities.find((e) => e.ref === program.bridgeRef);
  const removed =
    program.guard.removedEntityRefs.length +
    program.guard.removedTitles.length +
    program.guard.removedThemeRefs.length;

  const rebuild = async (bridgeRef: string) => {
    if (!brief) return;
    setBusy(bridgeRef);
    setError(null);
    try {
      const r = await postJson<{ program: Program; critique: CritiqueIssue[] }>("/api/program", {
        brief,
        bridgeRef,
      });
      onRegenerated({ program: r.program, critique: r.critique });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const exportMarkdown = () => {
    const blob = new Blob([programMarkdown(program, critique, labels)], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${program.title.replace(/[^\w]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <section className="max-w-3xl space-y-5">
        {main && <Kicker tone="bridge">Your plan · built on {main.name}</Kicker>}
        <Title>{program.title}</Title>
        <Lede>{program.objective}</Lede>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm print:hidden">
          <Button variant="link" onClick={exportMarkdown}>
            Download
          </Button>
          <Button variant="link" onClick={() => window.print()}>
            Print
          </Button>
          <span className={cx("text-xs", removed ? "text-warn" : "text-muted")}>
            {removed === 0
              ? "✓ Every session is built on real Qloo data"
              : `${removed} unverified reference${removed === 1 ? " was" : "s were"} removed`}
          </span>
        </div>
      </section>

      <ol className="mt-14 border-t border-ink">
        {program.sessions.map((s) => (
          <Session
            key={s.number}
            session={s}
            imageUrl={s.entity ? engineImage(engine, s.entity.id) : null}
            labels={labels}
          />
        ))}
      </ol>

      <div className="mt-10 space-y-5">
        <More label="Practical details: venue, access, partners and how to measure success">
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            <Detail title="Where" items={[program.venueType]} />
            <Detail title="Partners" items={program.partnerTypes} />
            <Detail title="Access" items={program.accessibility} />
            <Detail title="Reducing friction" items={program.frictionMitigations} />
            <Detail title="How you'll know it worked" items={program.successMeasures} />
            <Detail title="Limits of this plan" items={program.limitations} />
          </div>
        </More>

        {critique.length > 0 && (
          <More
            label={`How the AI improved its first draft (${critique.length} fix${
              critique.length === 1 ? "" : "es"
            })`}
          >
            <ul className="max-w-3xl space-y-5">
              {critique.map((c, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  <p className="font-medium text-ink">{CHECK_LABELS[c.check] ?? c.check}</p>
                  <p className="text-muted">{c.problem}</p>
                  <p className="mt-1 text-ink-2">→ {c.fix}</p>
                </li>
              ))}
            </ul>
          </More>
        )}

        {bridges.length > 1 && (
          <div className="print:hidden">
            <More label="Try a plan built on a different bridge">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {bridges.map((b) =>
                  b.ref === program.bridgeRef ? (
                    <span key={b.ref} className="text-sm text-ink">
                      {b.name} (current)
                    </span>
                  ) : (
                    <Button
                      key={b.ref}
                      variant="link"
                      disabled={Boolean(busy)}
                      onClick={() => rebuild(b.ref)}
                    >
                      {busy === b.ref ? <Spinner label={b.name} /> : b.name}
                    </Button>
                  ),
                )}
              </div>
              {busy && (
                <p className="mt-3 text-xs text-muted">Rewriting the plan, about a minute.</p>
              )}
              {error && (
                <div className="mt-4">
                  <Note tone="warn">{error}</Note>
                </div>
              )}
            </More>
          </div>
        )}
      </div>

      {comparison && <div className="mt-24">{comparison}</div>}
    </div>
  );
}

function Session({
  session: s,
  imageUrl,
  labels,
}: {
  session: Program["sessions"][number];
  imageUrl: string | null;
  labels: [string, string];
}) {
  const [expanded, setExpanded] = useState(false);
  const long = s.activity.length > 220;
  return (
    <li className="grid gap-5 border-b border-line py-8 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.5fr)] md:gap-10">
      <p className="figures font-display text-4xl leading-none text-muted/70">{s.number}</p>
      <div className="space-y-3">
        <Title level={3} className="text-2xl">
          {s.title}
        </Title>
        {s.entity ? (
          <div className="flex items-center gap-3">
            <Thumb src={imageUrl} name={s.entity.name} size={40} tone="bridge" />
            <p className="text-sm leading-snug">
              <span className="text-ink">{s.entity.name}</span>
              <span className="block text-xs text-muted">{typeLabel(s.entity.domain)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Both groups make something together</p>
        )}
      </div>
      <div className="space-y-4">
        <p className={cx("leading-relaxed text-ink-2", long && !expanded && "line-clamp-3")}>
          {s.activity}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-ink underline decoration-line underline-offset-4 hover:decoration-ink print:hidden"
        >
          {expanded ? "Show less" : "Who does what"}
        </button>
        {expanded && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["A", "B"] as const).map((side, i) => (
              <div key={side} className="text-sm leading-relaxed">
                <p className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <Dot tone={side === "A" ? "a" : "b"} />
                  {labels[i]}
                </p>
                <p>{s.roles[side]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Detail({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <Kicker>{title}</Kicker>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function engineImage(engine: EngineResult, id: string): string | null {
  const all = [...engine.bridges, ...engine.runnersUp, ...(engine.obvious ? [engine.obvious] : [])];
  return all.find((c) => c.entity.id === id)?.entity.imageUrl ?? null;
}

export function programMarkdown(
  program: Program,
  critique: CritiqueIssue[],
  labels: [string, string],
): string {
  const list = (title: string, items: string[]) =>
    items.length ? `\n### ${title}\n${items.map((i) => `- ${i}`).join("\n")}\n` : "";
  return [
    `# ${program.title}`,
    "",
    program.objective,
    "",
    `**Format:** ${program.format}`,
    "",
    "## Sessions",
    ...program.sessions.map((s) =>
      [
        `\n### ${s.number}. ${s.title}`,
        s.entity ? `*Qloo anchor:* ${s.entity.name} (${s.entity.domain})` : "*Co-creation session*",
        s.theme ? `*Theme:* ${s.theme.name}` : "",
        "",
        s.activity,
        "",
        `- **${labels[0]}:** ${s.roles.A}`,
        `- **${labels[1]}:** ${s.roles.B}`,
      ]
        .filter((l) => l !== "")
        .join("\n"),
    ),
    "",
    "## Delivery",
    list("Venue", [program.venueType]),
    list("Partners", program.partnerTypes),
    list("Accessibility", program.accessibility),
    list("Friction mitigations", program.frictionMitigations),
    list("Success measures", program.successMeasures),
    list("Limitations", program.limitations),
    critique.length
      ? list(
          "Critic's fixes",
          critique.map((c) => `${c.problem} → ${c.fix}`),
        )
      : "",
    "\n---\nGenerated by COMMON GROUND from Qloo cultural evidence. A draft for co-design with both communities; it does not predict social impact.",
  ].join("\n");
}
