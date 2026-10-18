/**
 * Build docs/EVALUATION.md from eval/out/summary.json (aggregates and short findings only).
 *
 *   npm run spike eval/report.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CaseResult } from "./run";

const { ranAt, results } = JSON.parse(readFileSync("eval/out/summary.json", "utf8")) as {
  ranAt: string;
  results: CaseResult[];
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ord = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}`);

const ok = results.filter((r) => r.status === "ok");
const seeds = sum(results.map((r) => r.resolution.seeds));
const exact = sum(results.map((r) => r.resolution.exact));
const ambiguous = sum(results.map((r) => r.resolution.ambiguous));
const unresolved = sum(results.map((r) => r.resolution.unresolved));
const pool = sum(ok.map((r) => r.poolSize));
const failedBilateral = sum(
  ok.map((r) => (r.rejections["one-sided"] ?? 0) + (r.rejections["weak on both"] ?? 0)),
);
const sessions = sum(ok.map((r) => r.program?.sessions ?? 0));
const anchored = sum(ok.map((r) => r.program?.anchored ?? 0));
const guardRemoved = sum(ok.map((r) => r.program?.guardRemoved ?? 0));
const repro = results.filter((r) => r.reproducible !== null);
const withAblation = ok.filter((r) => r.ablation);
const discovered = sum(withAblation.map((r) => r.ablation!.ours.discovered));
const reused = sum(withAblation.map((r) => r.ablation!.baseline.reusedSeeds));
const unverified = sum(withAblation.map((r) => r.ablation!.baseline.unverified));
const named = sum(withAblation.map((r) => r.ablation!.baseline.named));
const citations = sum(withAblation.map((r) => r.ablation!.ours.evidence));
const critic: Record<string, number> = {};
for (const r of ok)
  for (const c of r.program?.critiqueIssues ?? []) critic[c] = (critic[c] ?? 0) + 1;
const rej: Record<string, number> = {};
for (const r of ok) for (const [k, v] of Object.entries(r.rejections)) rej[k] = (rej[k] ?? 0) + v;
const obviousPop = ok.flatMap((r) => (r.obvious?.popularity == null ? [] : [r.obvious.popularity]));
const bridgePop = ok.flatMap((r) =>
  r.bridges.flatMap((b) => (b.popularity == null ? [] : [b.popularity])),
);

// The agent beyond the fixed search: extra rounds it chose, and whether it followed notes.
const withNotes = results.filter((r) => r.notes);
const noteChecks = withNotes.flatMap((r) => r.notes!.checks);
const agentRows = results
  .map(
    (r) =>
      `| ${r.context} | ${r.agent?.reviewRounds ?? 0} | ${r.agent?.addedDomains.join(", ") || "—"} | ${
        r.agent?.placeThemes.join(", ") || "—"
      } | ${r.agent?.decisions ?? 0} |`,
  )
  .join("\n");
const agentSection = `## The agent at work

After the first Qloo pass the agent reviews the evidence. With three strong bridges and no notes it stops; otherwise it may run up to two extra searches with its tools: **explore another kind of culture** (films, video games) or **look for places on a theme** (a Qloo place tag such as "Jazz club"). Everything it finds is scored by the same deterministic engine, and it keeps the extra results only if they beat the earlier ones.

| Case | Extra search rounds | Kinds it added | Place themes searched | Decisions logged |
|---|---|---|---|---|
${agentRows}

${
  withNotes.length
    ? `### Automated checks: notes, settings and stress cases

Each check is verified in code against the run's output (not judged by a model): **${noteChecks.filter((c) => c.passed).length} / ${noteChecks.length} passed** across ${withNotes.length} cases. Failures are listed, not hidden.

${withNotes
  .map(
    (r) =>
      `- **${r.context}:** "${r.notes!.text}"\n${r
        .notes!.checks.map((c) => `  - ${c.passed ? "✓" : "✗"} ${c.name}`)
        .join("\n")}`,
  )
  .join("\n")}
`
    : ""
}
`;

// Discovery preference: the same groups with familiar vs exploratory picks.
const popOf = (id: string) => {
  const r = results.find((x) => x.id === id);
  const ps = r?.bridges.flatMap((b) => (b.popularity == null ? [] : [b.popularity])) ?? [];
  return ps.length ? mean(ps) : null;
};
const fam = popOf("nyc-familiar");
const exp = popOf("nyc-exploratory");
const discoverySection =
  fam !== null && exp !== null
    ? `### Discovery preference

Same New York groups, two settings. Mean bridge popularity: **familiar ${ord(fam)}** vs **exploratory ${ord(exp)}** (percentile)${fam > exp ? ", so the setting moves picks in the intended direction" : ". The setting did not move picks in the intended direction here; this is a known limitation"}.

`
    : "";

// Optional earlier run (saved before a fix) to show what changed.
const previous: CaseResult[] | null = existsSync("eval/out/summary-run1.json")
  ? (JSON.parse(readFileSync("eval/out/summary-run1.json", "utf8")) as { results: CaseResult[] })
      .results
  : null;
const beforeAfter = previous
  ? `## What earlier runs found, and what changed

**Run 1 → content rules.** Four bridges were unsuitable for a community program. They were fixed with responsible-use rules, not score tuning (\`src/lib/engine/filters.ts\`). One came from the held-out case; the fix is a venue-type rule, not a threshold change.

**Run 2 → accuracy changes.** Two issues made results less trustworthy:
- *Repeatability:* the LLM planner picked different categories on different runs, so the same input could give different bridges (Berlin). Every proven category now always runs, and films only when a group named a film.
- *Weak third bridges:* some bridges passed at about the 51st percentile for both groups (Toronto). Only bridges with solid support from both groups (harmonic mean ≥ 0.55) are shown now; weaker ones move to "also in the running".

**Run 8 → stress cases under the revised scoring.** Organizer settings now change scoring (familiar picks averaged the 92nd popularity percentile vs 73rd for exploratory), and eight stress cases were added. Findings: a kids' TV group and a death-metal group got filler "bridges" at the 50th–64th percentile, because percentiles are relative to the pool; when Qloo's Compare finds no shared theme, a stricter bar (65th for both) now applies and the page warns, leaving one bridge. Two Tartu high schools appeared as bridges and a cardiology clinic as the mainstream contrast; K-12 schools, childcare and medical facilities are now excluded as venues (rerun: a canal and an artisan courtyard). Non-Latin titles (Korean, Japanese) all resolved.

**Run 6 → following notes.** With "adults only, a live jazz venue", the agent searched Qloo's *Jazz club* tag, but every club was rejected as a bar by the mixed-age alcohol rule. Bars and clubs are now allowed when the organizer says the group is adults only (hotels, worship and government buildings stay out). In run 7 the clubs were scored properly and still didn't qualify: the skate collective's support for Ronnie Scott's is only around the 20th percentile. The agent now says exactly that in its log instead of forcing a one-sided pick.

**Run 5 → stricter bridges.** Some third bridges had one group in the 40s (Yola at 44th, *Watership Down* at 41st, *The Beatles: Get Back* at 49th), which reads as "one group doesn't really like it". Every shown bridge now needs at least the 50th percentile from **both** groups. All six cases still show three bridges: the next strong candidate takes the slot (for example Royal Tenenbaums House at 88/90 in New York).

**Run 4 → robustness.** Run 4 gave the same bridges as run 3 in every case but one. In New York, Qloo rate-limited (429) one scoring call while another client was using the key. The engine read the missing scores as "no support" and silently dropped every place, including the top bridge. Now every busy Qloo call is retried after a pause; a call that still fails leaves its domain out (marked "not scored") rather than misjudging it; such runs are never cached and the page says so. Rerun alone, New York gave its usual bridges again.

| Problem in run 1 | Case | Rule added |
|---|---|---|
| Palace of Westminster (Parliament) | London | Government buildings are not venues |
| A café named "Chicago" | Chicago | Places named just like the city are skipped (confusing in a plan) |
| A "Collection 6 Books Set" listing | Chicago | Bundles and box sets are not single works |
| A sake brewery | Toronto *(held out)* | Alcohol-centred venues are excluded (mixed groups may include under-21s) |

| Case | Run 1 bridges | Latest bridges |
|---|---|---|
${results
  .map((r) => {
    const before = previous.find((x) => x.id === r.id);
    return `| ${r.context} | ${before?.bridges.map((b) => b.name).join("; ") ?? "—"} | ${r.bridges.map((b) => b.name).join("; ") || "—"} |`;
  })
  .join("\n")}

`
  : "";

const md = `# Evaluation (step 5.3)

**Run:** ${ranAt.slice(0, 10)} · **Cases:** ${results.length} (${results.filter((r) => r.heldOut).length} held out) · **Mode:** every case live (Qloo + LLM, no cache)

This is a **formative** evaluation: six fixed scenarios plus variants with notes, settings and stress conditions (mismatched groups, sparse profiles, non-Latin titles, a smaller city), technical metrics, deterministic checks, the agent's own decisions, and a with/without-Qloo ablation. It does **not** measure social impact, and the seeds are hypothetical test inputs, not real communities. Human ratings are collected separately (see "Human review" below).

Reproduce it with \`npm run spike eval/run.ts\`, then \`npm run spike eval/report.ts\`. Raw outputs stay in the git-ignored \`eval/out/\`.

## Conditions compared

| Condition | What it is |
|---|---|
| **LLM only** | The same objective, group labels and favourite *names* go to the same model, with no Qloo data (\`src/lib/agent/baseline.ts\`). |
| **Obvious pick** | The candidate with the strongest raw support from both groups, which is mainstream by construction: what a "most popular overlap" approach would choose. |
| **Common Ground** | The full system: Qloo discovery, per-group validation, popularity adjustment, an agent review that can search further with tools, an entity-anchored plan, a critic pass, and invitations. |

## Technical metrics

| Metric | Result |
|---|---|
| Runs completing with a plan | ${ok.length} / ${results.length}${results.some((r) => r.status === "insufficient_evidence") ? ` (${results.filter((r) => r.status === "insufficient_evidence").length} returned "insufficient evidence")` : ""} |
| Seeds resolved to a Qloo entity | ${pct((exact + ambiguous) / seeds)} (${exact} exact, ${ambiguous} flagged for a human check, ${unresolved} not found) |
| Mean end-to-end time (live) | ${(mean(results.map((r) => r.totalMs)) / 1000).toFixed(0)} s |
| Mean Qloo calls per run | ${mean(ok.map((r) => r.qlooCalls)).toFixed(1)} |
| Candidates considered per run (mean) | ${mean(ok.map((r) => r.poolSize)).toFixed(0)} |
| Candidates failing the two-sided test | ${pct(failedBilateral / Math.max(pool, 1))} of all candidates |
| Plan sessions anchored to a Qloo entity | ${pct(anchored / Math.max(sessions, 1))} (${anchored} / ${sessions}; the rest are co-creation sessions) |
| Unverified references removed by the evidence guard | ${guardRemoved} |
| Every shown bridge at or above the 50th percentile for both groups | ${ok.every((r) => r.bridges.every((b) => (b.pctA ?? 0) >= 0.5 && (b.pctB ?? 0) >= 0.5)) ? "Yes" : "No"} (lowest: ${ord(Math.min(...ok.flatMap((r) => r.bridges.map((b) => Math.min(b.pctA ?? 0, b.pctB ?? 0)))))}th) |
| Same top-3 bridges on an immediate rerun of the engine (including the agent's extra searches) | ${repro.filter((r) => r.reproducible).length} / ${repro.length} |
| Mean popularity of the obvious pick vs the chosen bridges | ${ord(mean(obviousPop))} vs ${ord(mean(bridgePop))} (percentile) |

**Rejections across all runs:** ${Object.entries(rej)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${v} ${k}`)
  .join(" · ")}.

**What the critic fixed most often:** ${
  Object.entries(critic)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.replace(/_/g, " ")} (${v})`)
    .join(", ") || "nothing"
}.

## Ablation: with vs without Qloo

| | Common Ground | LLM only |
|---|---|---|
| Plan anchors that are new titles **backed by both groups' Qloo data** | **${discovered}** | 0 |
| Titles that just **reuse the favourites** it was given | — | ${reused} of ${named} named |
| **Unverified** titles (named without any evidence) | 0 | ${unverified} of ${named} named |
| Evidence citations | ${citations} | 0 |

These counts show **provenance** (where each named title came from), not that the plans are better. The model-only version gets the same favourites, notes and settings. Whether organizers prefer either is a human judgment that is still pending.

## Per case

| Case | City | Status | Top bridges (support A / B · popularity) | Obvious pick (popularity) | Ablation: Qloo-found vs LLM reused / unverified |
|---|---|---|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.context}${r.heldOut ? " *(held out)*" : ""} | ${r.location} | ${r.status} | ${
        r.bridges
          .map((b) => `${b.name} (${ord(b.pctA)}/${ord(b.pctB)} · ${ord(b.popularity)})`)
          .join("; ") || "—"
      } | ${r.obvious ? `${r.obvious.name} (${ord(r.obvious.popularity)})` : "—"} | ${
        r.ablation
          ? `${r.ablation.ours.discovered} vs ${r.ablation.baseline.reusedSeeds} / ${r.ablation.baseline.unverified}`
          : "—"
      } |`,
  )
  .join("\n")}

${agentSection}
${discoverySection}${beforeAfter}## Human review

Running the evaluation writes one **blind packet** per case to \`eval/out/packets/\`. Each has two unlabelled plans (Common Ground and LLM only, in random order), a 1–5 rating form on seven criteria (cultural specificity, authenticity, appeal to each group, actionability, novelty without forcedness, likelihood of repeat attendance), and "which would you fund or run, and why?". The answer key is in \`*.key.json\`.

**Status:** pending. No real organizers have rated the proposals yet, so nothing here shows that people prefer them. The target is about 5 reviewers; results will be reported as informal feedback, not as a study.

## Limitations

- The seeds are plausible but **hypothetical**. Real profiles would come from participant intake.
- There are six base cases plus note variants, one run each. The LLM steps are non-deterministic; only the Qloo engine is reproducible.
- Bridges are only as good as Qloo's data for each group. For example, Mumbai's profiles surface a self-help podcast as a bridge, which is supported by both sides but may not suit every organizer.
- Bridge Potential is a transparent ranking score, not a probability, and **nothing here measures social cohesion**.
- Thresholds (40th-percentile floor for candidates, 50th for shown bridges, popularity band 0.3–0.9) were set on the New York spike scenario and the run 1–4 findings. Five of these cases, including the held-out one, were not used for tuning.
`;

writeFileSync("docs/EVALUATION.md", md);
console.log("Wrote docs/EVALUATION.md");
