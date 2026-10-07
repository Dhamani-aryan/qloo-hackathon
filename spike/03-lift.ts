/**
 * Step 1.6 (the decisive test): does popularity adjustment surface non-obvious bridges?
 *
 *   npm run spike spike/03-lift.ts [scenarioId]
 *
 * For each type:
 *  1. Candidate pool = combined A+B results plus the top of A and of B (≤ 50 entities).
 *  2. Score the pool against A alone and B alone with `filter.results.entities` (shortlist scoring).
 *  3. Baselines tried:
 *     (a) entity `popularity` percentile,
 *     (b) neutral query: shortlist scored with no interest signal,
 *     (c) combined A+B query capped with `filter.popularity.max`.
 *  4. Print top candidates by raw bilateral support vs by bilateral lift.
 *
 * Writes spike/out/lift.json (git-ignored).
 */
import type { InsightsEntity, QlooTypeKey } from "../src/lib/qloo";
import {
  confirmedIds,
  mapLimit,
  printStats,
  qloo,
  readJson,
  readResolved,
  urn,
  writeOut,
} from "./lib";
import type { InsightsRun } from "./02-insights";

const TYPES: QlooTypeKey[] = ["movie", "artist", "tvShow", "book", "podcast", "place"];
const POP_CAP = 0.85;
const hm = (x: number, y: number) => (x + y === 0 ? 0 : (2 * x * y) / (x + y));

interface Row {
  id: string;
  name: string;
  popularity: number | null;
  sA: number | null;
  sB: number | null;
  neutral: number | null;
  raw: number;
  liftPop: number;
  liftNeutral: number | null;
}

async function main() {
  const client = qloo();
  const only = process.argv[2];
  const scenarios = readResolved().filter((s) => !only || s.id === only);
  const insights = readJson<InsightsRun[]>("spike/out/insights.json");
  const report: Record<string, unknown> = {};
  let neutralWorks: boolean | null = null;

  for (const sc of scenarios) {
    const a = confirmedIds(sc.a.seeds);
    const b = confirmedIds(sc.b.seeds);
    console.log(`\n=================== ${sc.title}`);

    const perType = await mapLimit(TYPES, 2, async (type) => {
      const run = (side: string) =>
        insights.find((r) => r.scenarioId === sc.id && r.type === type && r.side === side)
          ?.entities ?? [];
      const pool = new Map<string, InsightsEntity>();
      for (const e of [...run("AB"), ...run("A").slice(0, 10), ...run("B").slice(0, 10)]) {
        if (pool.size < 50 && !pool.has(e.id)) pool.set(e.id, e);
      }
      const ids = [...pool.keys()];
      const location = type === "place" ? sc.location : undefined;
      const score = async (signal: string[] | undefined) => {
        try {
          const r = await client.getInsights({
            filterType: urn(type),
            signalEntities: signal,
            resultEntities: ids,
            filterLocationQuery: location,
            take: 50,
          });
          return {
            map: new Map(r.entities.map((e) => [e.id, e.affinity])),
            n: r.entities.length,
            err: null,
          };
        } catch (e) {
          return { map: new Map<string, number | null>(), n: 0, err: (e as Error).message };
        }
      };
      const [sa, sb, neutral] = await Promise.all([score(a), score(b), score(undefined)]);
      const capped = await client
        .getInsights({
          filterType: urn(type),
          signalEntities: [...a, ...b],
          excludeEntities: [...a, ...b],
          popularityMax: POP_CAP,
          filterLocationQuery: location,
          take: 10,
        })
        .then((r) => r.entities)
        .catch(() => []);

      if (neutral.n > 0) neutralWorks = true;
      else if (neutralWorks === null) neutralWorks = false;

      const rows: Row[] = ids.map((id) => {
        const e = pool.get(id)!;
        const sA = sa.map.get(id) ?? null;
        const sB = sb.map.get(id) ?? null;
        const n = neutral.map.get(id) ?? null;
        const raw = sA !== null && sB !== null ? hm(sA, sB) : 0;
        const p = e.popularity ?? 0.5;
        return {
          id,
          name: e.name,
          popularity: e.popularity,
          sA,
          sB,
          neutral: n,
          raw,
          // (a) popularity baseline: support relative to how mainstream the item is.
          liftPop:
            sA !== null && sB !== null ? hm(sA / Math.max(p, 0.05), sB / Math.max(p, 0.05)) : 0,
          // (b) neutral baseline: support relative to a no-signal score.
          liftNeutral:
            sA !== null && sB !== null && n
              ? hm(sA / Math.max(n, 0.01), sB / Math.max(n, 0.01))
              : null,
        };
      });
      return {
        type,
        rows,
        capped,
        counts: { pool: ids.length, a: sa.n, b: sb.n, neutral: neutral.n },
        errs: [sa.err, sb.err, neutral.err].filter(Boolean),
      };
    });

    const fmt = (r: Row) =>
      `${r.name.slice(0, 34).padEnd(34)} A ${r.sA?.toFixed(2) ?? " ? "} B ${r.sB?.toFixed(2) ?? " ? "} pop ${r.popularity?.toFixed(2) ?? " ? "}`;

    for (const t of perType) {
      console.log(
        `\n--- ${t.type}: pool ${t.counts.pool}, scored A ${t.counts.a}, B ${t.counts.b}, neutral ${t.counts.neutral}${t.errs.length ? `  ERR ${t.errs[0]?.slice(0, 80)}` : ""}`,
      );
      const byRaw = [...t.rows].sort((x, y) => y.raw - x.raw).slice(0, 5);
      const byLift = [...t.rows].sort((x, y) => y.liftPop - x.liftPop).slice(0, 5);
      console.log("  RAW bilateral (obvious?):");
      byRaw.forEach((r) => console.log(`    ${fmt(r)}`));
      console.log("  LIFT vs popularity (discovered?):");
      byLift.forEach((r) => console.log(`    ${fmt(r)}  lift ${r.liftPop.toFixed(2)}`));
      if (t.rows.some((r) => r.liftNeutral !== null)) {
        const byN = [...t.rows]
          .filter((r) => r.liftNeutral !== null)
          .sort((x, y) => y.liftNeutral! - x.liftNeutral!)
          .slice(0, 5);
        console.log("  LIFT vs neutral query:");
        byN.forEach((r) => console.log(`    ${fmt(r)}  neutral ${r.neutral?.toFixed(2)}`));
      }
      console.log(`  A+B with popularity ≤ ${POP_CAP}:`);
      console.log(
        `    ${
          t.capped
            .slice(0, 6)
            .map((e) => `${e.name} (pop ${e.popularity?.toFixed(2)})`)
            .join("; ") || "none"
        }`,
      );
    }
    report[sc.id] = perType;
  }

  console.log(`\nNeutral (no-signal) shortlist scoring works: ${neutralWorks}`);
  writeOut("lift.json", report);
  printStats();
}

main();
