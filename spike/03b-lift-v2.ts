/**
 * Step 1.6, second pass. Lessons from 03-lift.ts:
 *  - affinities sit in a narrow 0.8–0.96 band, so absolute values barely discriminate;
 *  - dividing by popularity does little and explodes near popularity 0;
 *  - neutral (no-signal) queries return no affinity, so they can't be a baseline;
 *  - capping popularity on the combined query surfaces the interesting candidates.
 *
 * Method here:
 *  1. Pool = combined A+B top results  ∪  combined A+B results with popularity ≤ CAP.
 *  2. Score the pool against A and against B (shortlist scoring).
 *  3. Convert scores to percentiles WITHIN the pool (pctA, pctB), so they are comparable.
 *  4. bilateral = harmonic_mean(pctA, pctB)   (punishes one-sided candidates)
 *  5. obvious    = best bilateral among very popular items (pop ≥ 0.95)
 *     discovered = rank by bilateral × (1 − pop), keeping pop in [MIN_POP, CAP]
 *
 *   npm run spike spike/03b-lift-v2.ts [scenarioId]
 */
import type { InsightsEntity, QlooTypeKey } from "../src/lib/qloo";
import { confirmedIds, mapLimit, printStats, qloo, readResolved, urn, writeOut } from "./lib";

const TYPES: QlooTypeKey[] = ["movie", "artist", "tvShow", "book", "podcast", "place"];
const CAP = 0.9;
const MIN_POP = 0.3;
const hm = (x: number, y: number) => (x + y === 0 ? 0 : (2 * x * y) / (x + y));

function percentiles(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((x, y) => x[1] - y[1]);
  const n = sorted.length;
  return new Map(sorted.map(([id], i) => [id, n <= 1 ? 1 : i / (n - 1)]));
}

interface Scored {
  id: string;
  name: string;
  pop: number;
  sA: number;
  sB: number;
  pctA: number;
  pctB: number;
  bilateral: number;
  discovered: number;
}

async function main() {
  const client = qloo();
  const only = process.argv[2];
  const scenarios = readResolved().filter((s) => !only || s.id === only);
  const report: Record<string, unknown> = {};

  for (const sc of scenarios) {
    const a = confirmedIds(sc.a.seeds);
    const b = confirmedIds(sc.b.seeds);
    const seeds = [...a, ...b];
    console.log(`\n=================== ${sc.title}`);

    const perType = await mapLimit(TYPES, 2, async (type) => {
      const location = type === "place" ? sc.location : undefined;
      const common = {
        filterType: urn(type),
        signalEntities: seeds,
        excludeEntities: seeds,
        filterLocationQuery: location,
      };
      const [top, capped] = await Promise.all([
        client.getInsights({ ...common, take: 25 }),
        client.getInsights({ ...common, popularityMax: CAP, take: 25 }),
      ]);
      const pool = new Map<string, InsightsEntity>();
      for (const e of [...top.entities, ...capped.entities]) if (!pool.has(e.id)) pool.set(e.id, e);
      const ids = [...pool.keys()].slice(0, 50);

      const score = async (signal: string[]) => {
        const r = await client.getInsights({
          filterType: urn(type),
          signalEntities: signal,
          resultEntities: ids,
          filterLocationQuery: location,
          take: 50,
        });
        return new Map(
          r.entities.flatMap((e) => (e.affinity === null ? [] : [[e.id, e.affinity] as const])),
        );
      };
      const [rawA, rawB] = await Promise.all([score(a), score(b)]);
      const [pA, pB] = [percentiles(rawA), percentiles(rawB)];

      const rows: Scored[] = ids.flatMap((id) => {
        const e = pool.get(id)!;
        if (!rawA.has(id) || !rawB.has(id)) return [];
        const pop = e.popularity ?? 0.5;
        const pctA = pA.get(id)!;
        const pctB = pB.get(id)!;
        const bilateral = hm(pctA, pctB);
        return [
          {
            id,
            name: e.name,
            pop,
            sA: rawA.get(id)!,
            sB: rawB.get(id)!,
            pctA,
            pctB,
            bilateral,
            discovered: bilateral * (1 - pop),
          },
        ];
      });

      const obvious = [...rows]
        .filter((r) => r.pop >= 0.95)
        .sort((x, y) => y.bilateral - x.bilateral)
        .slice(0, 3);
      const discovered = [...rows]
        .filter((r) => r.pop >= MIN_POP && r.pop <= CAP && r.pctA >= 0.4 && r.pctB >= 0.4)
        .sort((x, y) => y.discovered - x.discovered)
        .slice(0, 6);
      return { type, pool: ids.length, scored: rows.length, obvious, discovered };
    });

    const fmt = (r: Scored) =>
      `${r.name.slice(0, 38).padEnd(38)} pctA ${r.pctA.toFixed(2)} pctB ${r.pctB.toFixed(2)} pop ${r.pop.toFixed(2)}`;
    for (const t of perType) {
      console.log(`\n--- ${t.type} (pool ${t.pool}, scored on both sides ${t.scored})`);
      console.log("  OBVIOUS (popular, high bilateral):");
      t.obvious.forEach((r) => console.log(`    ${fmt(r)}`));
      console.log("  DISCOVERED (high bilateral × novelty, both sides ≥ 40th pct):");
      if (!t.discovered.length) console.log("    none");
      t.discovered.forEach((r) => console.log(`    ${fmt(r)}  score ${r.discovered.toFixed(3)}`));
    }
    report[sc.id] = perType;
  }

  writeOut("lift-v2.json", report);
  printStats();
}

main();
