/**
 * Step 2.8: run the full bridge engine live on a resolved spike scenario.
 *
 *   npm run spike spike/run-engine.ts [scenarioId]     (default: campus-city-nyc)
 *
 * Prints ranked bridges and writes spike/out/engine-<id>.json (git-ignored: it contains
 * Qloo data).
 */
import { runBridgeEngine, ScenarioSchema, type ScoredCandidate } from "../src/lib/engine";
import { qloo, readResolved, writeOut, type ResolvedSeed } from "./lib";

const id = process.argv[2] ?? "campus-city-nyc";
const resolved = readResolved().find((s) => s.id === id);
if (!resolved) {
  console.error(`Unknown scenario: ${id}`);
  process.exit(1);
}

const toSeed = (s: ResolvedSeed) =>
  s.id
    ? [
        {
          input: s.name,
          entityId: s.id,
          name: s.resolvedName ?? s.name,
          type: s.resolvedType,
          popularity: s.popularity,
          confirmed: true,
        },
      ]
    : [];

const scenario = ScenarioSchema.parse({
  id: resolved.id,
  title: resolved.title,
  location: resolved.location ?? null,
  a: {
    side: "A",
    label: resolved.a.label,
    source: "organizer",
    seeds: resolved.a.seeds.flatMap(toSeed),
  },
  b: {
    side: "B",
    label: resolved.b.label,
    source: "organizer",
    seeds: resolved.b.seeds.flatMap(toSeed),
  },
});
const seedName = new Map(
  [...scenario.a.seeds, ...scenario.b.seeds].map((s) => [s.entityId, s.name]),
);
const names = (ids: string[]) =>
  ids
    .map((i) => seedName.get(i) ?? i)
    .slice(0, 3)
    .join(", ") || "—";

const line = (b: ScoredCandidate) =>
  `${b.entity.name} [${b.domain}]  BP ${b.bridgePotential}  ` +
  `A ${pctStr(b.pct.A)} · B ${pctStr(b.pct.B)} · pop ${b.popularity?.toFixed(2) ?? "?"}  ` +
  `evidence ${b.evidenceIds.length}`;
const pctStr = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}th`);

async function main() {
  const events: string[] = [];
  const r = await runBridgeEngine(qloo(), scenario, {
    onEvent: (e) => {
      if (e.type === "qloo_query_done") events.push(`${e.purpose}:${e.domain ?? "-"}`);
    },
  });

  console.log(`\n=== ${scenario.title} → ${r.status.toUpperCase()}`);
  console.log(`\nDISCOVERED BRIDGES`);
  r.bridges.forEach((b, i) => {
    console.log(`  ${i + 1}. ${line(b)}`);
    console.log(
      `     supported by A: ${names(b.supportingSeeds.A)} | B: ${names(b.supportingSeeds.B)}`,
    );
  });
  console.log(`\nOBVIOUS BRIDGE\n  ${r.obvious ? line(r.obvious) : "none"}`);
  console.log(`\nRUNNERS-UP`);
  for (const b of r.runnersUp) console.log(`  · ${line(b)}`);
  console.log(`\nSHARED THEMES`);
  for (const t of r.themes) {
    console.log(
      `  • ${t.name}  (A: ${names(t.supportingSeeds.A)} | B: ${names(t.supportingSeeds.B)})  ${t.evidenceId}`,
    );
  }
  const reasons = new Map<string, number>();
  for (const x of r.rejections) {
    const key = x.reason
      .replace(/\d+th/, "N")
      .replace(/\(.*\)/, "")
      .trim();
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  console.log(`\nREJECTED ${r.rejections.length}`);
  for (const [k, n] of reasons) console.log(`  ${n} × ${k}`);
  for (const w of r.warnings) console.log(`WARNING ${w}`);

  const traced = r.bridges.every((b) =>
    b.evidenceIds.every((e) => r.evidence.some((x) => x.evidenceId === e)),
  );
  console.log(
    `\nStats: ${r.stats.qlooCalls} Qloo calls, ${(r.stats.ms / 1000).toFixed(1)}s, pool ${r.stats.poolSize}, ` +
      `evidence ${r.evidence.length}, every bridge traced to ledger: ${traced}`,
  );
  writeOut(`engine-${id}.json`, r);
}

main();
