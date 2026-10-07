/**
 * Step 1.5: for every output type, query Insights with A seeds, B seeds and A+B seeds,
 * then measure result counts, latency, returned numeric fields and A∩B overlap.
 *
 *   npm run spike spike/02-insights.ts [scenarioId]
 *
 * Writes spike/out/insights.json (git-ignored) for step 1.6.
 */
import type { InsightsEntity, QlooTypeKey } from "../src/lib/qloo";
import { confirmedIds, mapLimit, printStats, qloo, readResolved, urn, writeOut } from "./lib";

const TYPES: QlooTypeKey[] = [
  "movie",
  "artist",
  "tvShow",
  "book",
  "videoGame",
  "podcast",
  "brand",
  "destination",
  "place",
];
const TAKE = 30;

type Side = "A" | "B" | "AB";
export interface InsightsRun {
  scenarioId: string;
  type: QlooTypeKey;
  side: Side;
  ms: number;
  error: string | null;
  entities: InsightsEntity[];
}

async function main() {
  const client = qloo();
  const only = process.argv[2];
  const scenarios = readResolved().filter((s) => !only || s.id === only);
  const runs: InsightsRun[] = [];

  for (const sc of scenarios) {
    const a = confirmedIds(sc.a.seeds);
    const b = confirmedIds(sc.b.seeds);
    const signals: Record<Side, string[]> = { A: a, B: b, AB: [...a, ...b] };
    const jobs = TYPES.flatMap((type) =>
      (["A", "B", "AB"] as Side[]).map((side) => ({ type, side })),
    );

    const results = await mapLimit(jobs, 3, async ({ type, side }) => {
      const started = Date.now();
      try {
        const r = await client.getInsights({
          filterType: urn(type),
          signalEntities: signals[side],
          excludeEntities: [...a, ...b],
          // Places need a location to mean anything.
          filterLocationQuery: type === "place" ? sc.location : undefined,
          take: TAKE,
        });
        return {
          scenarioId: sc.id,
          type,
          side,
          ms: Date.now() - started,
          error: null,
          entities: r.entities,
        };
      } catch (e) {
        return {
          scenarioId: sc.id,
          type,
          side,
          ms: Date.now() - started,
          error: (e as Error).message,
          entities: [],
        };
      }
    });
    runs.push(...results);

    console.log(`\n=== ${sc.title}`);
    console.log("type         A   B   AB  overlap  ms(A/B/AB)        fields");
    for (const type of TYPES) {
      const get = (side: Side) => results.find((r) => r.type === type && r.side === side)!;
      const [ra, rb, rab] = [get("A"), get("B"), get("AB")];
      const idsB = new Set(rb.entities.map((e) => e.id));
      const overlap = ra.entities.filter((e) => idsB.has(e.id));
      const sample = rab.entities[0] ?? ra.entities[0];
      const fields = sample
        ? [
            sample.affinity !== null && "affinity",
            sample.affinityRank !== null && "affinity_rank",
            sample.popularity !== null && "popularity",
          ]
            .filter(Boolean)
            .join(",")
        : "-";
      const err = [ra, rb, rab].find((r) => r.error)?.error;
      console.log(
        `${type.padEnd(12)} ${String(ra.entities.length).padStart(2)}  ${String(rb.entities.length).padStart(2)}  ${String(rab.entities.length).padStart(2)}  ${String(overlap.length).padStart(5)}    ${ra.ms}/${rb.ms}/${rab.ms}`.padEnd(
          52,
        ) + ` ${fields}${err ? `  ERROR: ${err.slice(0, 80)}` : ""}`,
      );
      if (overlap.length) {
        const names = overlap
          .slice(0, 6)
          .map((e) => {
            const rB = rb.entities.find((x) => x.id === e.id)!;
            return `${e.name} (#${e.rank}/#${rB.rank}, pop ${e.popularity?.toFixed(2)})`;
          })
          .join("; ");
        console.log(`             overlap: ${names}`);
      }
    }
  }

  writeOut("insights.json", runs);
  printStats();
}

main();
