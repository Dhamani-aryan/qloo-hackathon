/**
 * Step 5.3: evaluation run (plan §14).
 *
 *   npm run spike eval/run.ts [caseId]
 *
 * For every case: resolve seeds through Qloo, run the full agent live, run the bridge engine a
 * second time for reproducibility, and compute technical metrics and the with/without-Qloo
 * ablation. Also writes blind review packets (two unlabelled plans per case) for human raters.
 *
 * Writes to eval/out/ (git-ignored: contains Qloo-derived results). The committed report
 * (docs/EVALUATION.md) is built from eval/out/summary.json by eval/report.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { compareStats } from "../src/lib/agent/ablation";
import type { BaselineProgram } from "../src/lib/agent/baseline";
import { runAgentToCompletion } from "../src/lib/agent/orchestrator";
import type { Program } from "../src/lib/agent/program";
import { getQlooEnv } from "../src/lib/env";
import {
  resolveSeed,
  runBridgeEngine,
  ScenarioSchema,
  toSeed,
  type Scenario,
} from "../src/lib/engine";
import { createLimiter } from "../src/lib/engine/context";
import { getLlm } from "../src/lib/llm";
import { createQlooClient } from "../src/lib/qloo";
import { CASES, type EvalCase } from "./cases";

const OUT = "eval/out";

export interface CaseResult {
  id: string;
  context: string;
  location: string;
  heldOut: boolean;
  resolution: { seeds: number; exact: number; ambiguous: number; unresolved: number };
  status: string;
  failure: string | null;
  timings: Record<string, number>;
  totalMs: number;
  qlooCalls: number;
  poolSize: number;
  rejections: Record<string, number>;
  bridges: {
    name: string;
    domain: string;
    pctA: number | null;
    pctB: number | null;
    popularity: number | null;
    bp: number;
  }[];
  obvious: {
    name: string;
    pctA: number | null;
    pctB: number | null;
    popularity: number | null;
  } | null;
  themes: number;
  program: {
    sessions: number;
    anchored: number;
    guardRemoved: number;
    guardWarnings: string[];
    critiqueIssues: string[];
  } | null;
  ablation: ReturnType<typeof compareStats> | null;
  baselineAvailable: boolean;
  reproducible: boolean | null;
  warnings: string[];
}

const limit = createLimiter(3);

function rejectionGroup(reason: string): string {
  if (reason.startsWith("One-sided")) return "one-sided";
  if (reason.startsWith("Weak support")) return "weak on both";
  if (reason.startsWith("Too niche")) return "too niche";
  if (reason.startsWith("Sensitive")) return "sensitive topic";
  if (reason.startsWith("Unsuitable venue")) return "unsuitable venue";
  if (reason.startsWith("A bundle")) return "bundle or box set";
  if (reason.startsWith("Shares its name")) return "named like the city";
  return "other";
}

async function buildScenario(c: EvalCase, qloo: ReturnType<typeof createQlooClient>) {
  const resolution = { seeds: 0, exact: 0, ambiguous: 0, unresolved: 0 };
  const side = async (seeds: EvalCase["a"]["seeds"]) =>
    (
      await Promise.all(
        seeds.map(([name, type]) =>
          limit(async () => {
            resolution.seeds++;
            const r = await resolveSeed(qloo, { input: name, type });
            if (!r.best) {
              resolution.unresolved++;
              return [];
            }
            if (r.ambiguous) resolution.ambiguous++;
            else resolution.exact++;
            return [toSeed(name, r.best)];
          }),
        ),
      )
    ).flat();
  const scenario = ScenarioSchema.parse({
    id: c.id,
    title: c.context,
    objective: c.objective,
    location: c.location,
    a: { side: "A", label: c.a.label, source: "organizer", seeds: await side(c.a.seeds) },
    b: { side: "B", label: c.b.label, source: "organizer", seeds: await side(c.b.seeds) },
  });
  return { scenario, resolution };
}

function packet(c: EvalCase, scenario: Scenario, program: Program, baseline: BaselineProgram) {
  const ourFirst = Math.random() < 0.5;
  const ours = [
    `**${program.title}**`,
    ...program.sessions.map(
      (s) =>
        `${s.number}. **${s.title}**${s.entity ? ` (built around: ${s.entity.name})` : ""}\n   ${s.activity}\n   - ${c.a.label}: ${s.roles.A}\n   - ${c.b.label}: ${s.roles.B}`,
    ),
  ].join("\n\n");
  const theirs = [
    `**${baseline.title}**`,
    ...baseline.sessions.map(
      (s) =>
        `${s.number}. **${s.title}**${s.anchor ? ` (built around: ${s.anchor})` : ""}\n   ${s.activity}\n   - ${c.a.label}: ${s.roles.A}\n   - ${c.b.label}: ${s.roles.B}`,
    ),
  ].join("\n\n");
  const [one, two] = ourFirst ? [ours, theirs] : [theirs, ours];
  const seeds = (side: "a" | "b") => scenario[side].seeds.map((s) => s.name).join(", ");
  const scale = [
    "Cultural specificity (feels made for these two groups)",
    "Authenticity (would not feel forced or tokenistic)",
    `Appeal to ${c.a.label}`,
    `Appeal to ${c.b.label}`,
    "Actionability (could actually be run)",
    "Novelty without forcedness",
    "Likelihood people come back for all sessions",
  ];
  const form = (label: string) =>
    [`#### Ratings for ${label} (1 = poor, 5 = excellent)`, ...scale.map((q) => `- ${q}: __`)].join(
      "\n",
    );
  return {
    ourFirst,
    md: [
      `# Review packet: ${c.context} (${c.location})`,
      "",
      `**Group A, ${c.a.label}**, likes: ${seeds("a")}`,
      `**Group B, ${c.b.label}**, likes: ${seeds("b")}`,
      "",
      "Read both plans, rate each, then answer the final question. Don't try to guess how they were made.",
      "",
      "## Plan 1",
      one,
      "",
      form("Plan 1"),
      "",
      "## Plan 2",
      two,
      "",
      form("Plan 2"),
      "",
      "## Final question",
      "Which plan would you actually fund or run, and why? __",
      "",
    ].join("\n"),
  };
}

async function evaluate(c: EvalCase): Promise<CaseResult> {
  const env = getQlooEnv();
  const qloo = createQlooClient({ ...env, timeoutMs: 20_000, onEmpty: () => {} });
  const { scenario, resolution } = await buildScenario(c, qloo);

  const started = Date.now();
  const r = await runAgentToCompletion({ qloo, llm: getLlm() }, scenario);
  const totalMs = Date.now() - started;

  // Reproducibility: the deterministic engine, rerun on the same inputs and domains.
  let reproducible: boolean | null = null;
  if (r.engine && r.plan) {
    const again = await runBridgeEngine(qloo, scenario, {
      domains: r.plan.domains.map((d) => d.domain),
    });
    const ids = (xs: { entity: { id: string } }[]) =>
      xs
        .map((x) => x.entity.id)
        .sort()
        .join(",");
    reproducible = ids(again.bridges) === ids(r.engine.bridges);
  }

  const rejections: Record<string, number> = {};
  for (const x of r.engine?.rejections ?? []) {
    const g = rejectionGroup(x.reason);
    rejections[g] = (rejections[g] ?? 0) + 1;
  }

  mkdirSync(`${OUT}/packets`, { recursive: true });
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify(r, null, 1));
  if (r.program && r.baseline) {
    const p = packet(c, scenario, r.program, r.baseline);
    writeFileSync(`${OUT}/packets/${c.id}.md`, p.md);
    writeFileSync(
      `${OUT}/packets/${c.id}.key.json`,
      JSON.stringify({ commonGround: p.ourFirst ? "Plan 1" : "Plan 2" }),
    );
  }

  const pr = r.program;
  return {
    id: c.id,
    context: c.context,
    location: c.location,
    heldOut: Boolean(c.heldOut),
    resolution,
    status: r.status,
    failure: r.failure,
    timings: r.timings as Record<string, number>,
    totalMs,
    qlooCalls: r.engine?.stats.qlooCalls ?? 0,
    poolSize: r.engine?.stats.poolSize ?? 0,
    rejections,
    bridges: (r.engine?.bridges ?? []).map((b) => ({
      name: b.entity.name,
      domain: b.domain,
      pctA: b.pct.A,
      pctB: b.pct.B,
      popularity: b.popularity,
      bp: b.bridgePotential,
    })),
    obvious: r.engine?.obvious
      ? {
          name: r.engine.obvious.entity.name,
          pctA: r.engine.obvious.pct.A,
          pctB: r.engine.obvious.pct.B,
          popularity: r.engine.obvious.popularity,
        }
      : null,
    themes: r.engine?.themes.length ?? 0,
    program: pr
      ? {
          sessions: pr.sessions.length,
          anchored: pr.sessions.filter((s) => s.entity).length,
          guardRemoved:
            pr.guard.removedEntityRefs.length +
            pr.guard.removedTitles.length +
            pr.guard.removedThemeRefs.length +
            pr.guard.removedEvidenceIds.length,
          guardWarnings: pr.guard.warnings,
          critiqueIssues: r.critique.map((i) => i.check),
        }
      : null,
    ablation: pr && r.baseline ? compareStats(pr, r.baseline, scenario) : null,
    baselineAvailable: Boolean(r.baseline),
    reproducible,
    warnings: r.warnings,
  };
}

async function main() {
  const only = process.argv[2];
  const cases = CASES.filter((c) => !only || c.id === only);
  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`\n▶ ${c.id} (${c.location})… `);
    try {
      const r = await evaluate(c);
      results.push(r);
      console.log(
        `${r.status} in ${(r.totalMs / 1000).toFixed(0)}s · bridges: ${r.bridges.map((b) => b.name).join(", ") || "none"} · obvious: ${r.obvious?.name ?? "-"} · reproducible: ${r.reproducible}`,
      );
      if (r.ablation) {
        console.log(
          `   ablation: Qloo discovered ${r.ablation.ours.discovered}, baseline reused ${r.ablation.baseline.reusedSeeds} / unverified ${r.ablation.baseline.unverified}`,
        );
      }
    } catch (e) {
      console.log(`CRASHED: ${(e as Error).message}`);
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 1),
  );
  console.log(
    `\nWrote ${OUT}/summary.json and ${results.length} review packet(s) in ${OUT}/packets/`,
  );
}

main();
