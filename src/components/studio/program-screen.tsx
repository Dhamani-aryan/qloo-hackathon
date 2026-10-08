"use client";

import { useState } from "react";
import type { EvidenceBrief } from "@/lib/agent/brief";
import type { CritiqueIssue } from "@/lib/agent/critic";
import type { Program } from "@/lib/agent/program";
import type { EngineResult } from "@/lib/engine/types";
import { Badge, Button, Card, EntityTile, Eyebrow, Heading, Notice, Spinner, cx } from "../ui";
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
  /** The with/without-Qloo view, rendered under the program (step 4.7). */
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
    const blob = new Blob([programMarkdown(program, critique, labels)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${program.title.replace(/[^\w]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <Eyebrow tone="bridge">Step 4 · Program</Eyebrow>
          <Heading level={1}>{program.title}</Heading>
          <p className="text-muted">{program.objective}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {main && (
              <Badge tone="bridge">
                Built on {main.name} · {main.supportA}th / {main.supportB}th
              </Badge>
            )}
            <span className="text-muted">{program.format}</span>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" onClick={exportMarkdown}>
            Export
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {removed === 0 ? (
        <Notice tone="ok">
          Every session anchor is a Qloo entity from the evidence; the guard found nothing invented.
        </Notice>
      ) : (
        <Notice tone="warn">
          The evidence guard removed {removed} item{removed === 1 ? "" : "s"} the model referenced
          that aren&apos;t in Qloo&apos;s evidence
          {program.guard.removedTitles.length ? `: ${program.guard.removedTitles.join(", ")}` : ""}.
        </Notice>
      )}

      <ol className="space-y-4">
        {program.sessions.map((s) => (
          <li key={s.number}>
            <Card className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <p className="font-display text-sm text-muted">Session {s.number}</p>
                <Heading level={3}>{s.title}</Heading>
                {s.entity ? (
                  <div className="space-y-2">
                    <EntityTile
                      name={s.entity.name}
                      type={s.entity.domain}
                      imageUrl={engineImage(engine, s.entity.id)}
                      tone="bridge"
                      wrap
                    />
                    <Badge tone="bridge">Qloo anchor</Badge>
                  </div>
                ) : (
                  <Badge>Co-creation · no Qloo anchor</Badge>
                )}
                {s.theme && <Badge tone="neutral">Theme: {s.theme.name}</Badge>}
              </div>
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">{s.activity}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-a-soft p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold text-a">{labels[0]}</p>
                    <p>{s.roles.A}</p>
                  </div>
                  <div className="rounded-xl bg-b-soft p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold text-b">{labels[1]}</p>
                    <p>{s.roles.B}</p>
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <ListCard title="Venue" items={[program.venueType]} />
        <ListCard title="Partners" items={program.partnerTypes} />
        <ListCard title="Accessibility" items={program.accessibility} />
        <ListCard title="Friction mitigations" items={program.frictionMitigations} />
        <ListCard title="Success measures" items={program.successMeasures} />
        <ListCard title="Limitations" items={program.limitations} />
      </div>

      {critique.length > 0 && (
        <Card className="space-y-3">
          <Heading level={3}>
            The critic&apos;s review: {critique.length} issue{critique.length === 1 ? "" : "s"}{" "}
            fixed
          </Heading>
          <ul className="space-y-3">
            {critique.map((c, i) => (
              <li key={i} className="text-sm">
                <Badge tone="warn">{CHECK_LABELS[c.check] ?? c.check}</Badge>
                <p className="mt-1 text-muted">{c.problem}</p>
                <p className="mt-0.5">
                  <span className="font-medium">Fix: </span>
                  {c.fix}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {bridges.length > 1 && (
        <Card className="space-y-3 print:hidden">
          <Heading level={3}>Build on a different bridge</Heading>
          <p className="text-sm text-muted">
            The agent redesigns and re-critiques the program around another discovered bridge (about
            a minute).
          </p>
          <div className="flex flex-wrap gap-2">
            {bridges.map((b) => (
              <Button
                key={b.ref}
                variant={b.ref === program.bridgeRef ? "primary" : "secondary"}
                disabled={Boolean(busy) || b.ref === program.bridgeRef}
                onClick={() => rebuild(b.ref)}
              >
                {busy === b.ref ? <Spinner /> : null}
                {b.name}
              </Button>
            ))}
          </div>
          {error && <Notice tone="warn">{error}</Notice>}
        </Card>
      )}

      {comparison}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <ul className={cx("space-y-1.5 text-sm", items.length > 1 && "list-disc pl-4")}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Card>
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
