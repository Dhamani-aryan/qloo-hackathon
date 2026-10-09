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

// Optional earlier run (saved before a fix) to show what changed.
const previous: CaseResult[] | null = existsSync("eval/out/summary-run1.json")
  ? (JSON.parse(readFileSync("eval/out/summary-run1.json", "utf8")) as { results: CaseResult[] })
      .results
  : null;
const beforeAfter = previous
  ? `## What the first run found, and what changed

The first full run surfaced four bridges that are unsuitable for a community program. They come from content rules, not score tuning, so they were fixed as responsible-use rules (\`src/lib/engine/filters.ts\`). One of them came from the held-out case, and the fix is a venue-type rule, not a threshold change.

| Problem in run 1 | Case | Rule added |
|---|---|---|
| Palace of Westminster (Parliament) | London | Government buildings are not venues |
| A café named "Chicago" | Chicago | Places named just like the city are skipped (confusing in a plan) |
| A "Collection 6 Books Set" listing | Chicago | Bundles and box sets are not single works |
| A sake brewery | Toronto *(held out)* | Alcohol-centred venues are excluded (mixed groups may include under-21s) |

| Case | Run 1 bridges | Run 2 bridges (after the rules) |
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

This is a **formative** evaluation: six fixed scenarios, technical metrics, and a with/without-Qloo ablation. It does **not** measure social impact, and the seeds are hypothetical test inputs, not real communities. Human ratings are collected separately (see "Human review" below).

Reproduce it with \`npm run spike eval/run.ts\`, then \`npm run spike eval/report.ts\`. Raw outputs stay in the git-ignored \`eval/out/\`.

## Conditions compared

| Condition | What it is |
|---|---|
| **LLM only** | The same objective, group labels and favourite *names* go to the same model, with no Qloo data (\`src/lib/agent/baseline.ts\`). |
| **Obvious pick** | The candidate with the strongest raw support from both groups, which is mainstream by construction: what a "most popular overlap" approach would choose. |
| **Common Ground** | The full system: Qloo discovery, per-group validation, popularity adjustment, an entity-anchored plan, and a critic pass. |

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
| Same top-3 bridges on an immediate rerun of the engine | ${repro.filter((r) => r.reproducible).length} / ${repro.length} |
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

${beforeAfter}## Human review

Running the evaluation writes one **blind packet** per case to \`eval/out/packets/\`. Each has two unlabelled plans (Common Ground and LLM only, in random order), a 1–5 rating form on seven criteria (cultural specificity, authenticity, appeal to each group, actionability, novelty without forcedness, likelihood of repeat attendance), and "which would you fund or run, and why?". The answer key is in \`*.key.json\`.

**Status:** pending. The target is about 5 reviewers. Results will be reported here honestly as informal feedback, not as a study.

## Limitations

- The seeds are plausible but **hypothetical**. Real profiles would come from participant intake.
- There are six cases, one run each. The LLM steps are non-deterministic; only the Qloo engine is reproducible.
- Bridge Potential is a transparent ranking score, not a probability, and **nothing here measures social cohesion**.
- Thresholds (40th-percentile floor, popularity band 0.3–0.9) were set on the New York spike scenario. Five of these cases, including the held-out one, were not used for tuning.
`;

writeFileSync("docs/EVALUATION.md", md);
console.log("Wrote docs/EVALUATION.md");
