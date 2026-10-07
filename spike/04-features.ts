/**
 * Step 1.7: test explainability, Analysis Compare, taste analysis (tags) and location.
 *
 *   npm run spike spike/04-features.ts [scenarioId]   (default: campus-city-nyc)
 */
import { QLOO_TYPES } from "../src/lib/qloo";
import { getQlooEnv } from "../src/lib/env";
import { confirmedIds, printStats, qloo, readResolved, writeOut } from "./lib";

async function main() {
  const client = qloo();
  const id = process.argv[2] ?? "campus-city-nyc";
  const sc = readResolved().find((s) => s.id === id)!;
  const a = confirmedIds(sc.a.seeds);
  const b = confirmedIds(sc.b.seeds);
  const aSet = new Set(a);
  const out: Record<string, unknown> = {};
  console.log(`=== ${sc.title}`);

  // 1. Explainability: does each combined recommendation get contributions from both sides?
  console.log("\n[1] feature.explainability on combined A+B (tv_show)");
  const ex = await client.getInsights({
    filterType: QLOO_TYPES.tvShow,
    signalEntities: [...a, ...b],
    excludeEntities: [...a, ...b],
    explainability: true,
    take: 10,
  });
  const withEx = ex.entities.filter((e) => e.explainability);
  console.log(`  per-entity explainability on ${withEx.length}/${ex.entities.length} results`);
  for (const e of withEx.slice(0, 8)) {
    const entries = Object.entries(e.explainability!);
    const sumA = entries.filter(([k]) => aSet.has(k)).reduce((s, [, v]) => s + v, 0);
    const sumB = entries.filter(([k]) => !aSet.has(k)).reduce((s, [, v]) => s + v, 0);
    const shareA = sumA + sumB ? sumA / (sumA + sumB) : 0;
    console.log(
      `  ${e.name.slice(0, 32).padEnd(32)} A-share ${(shareA * 100).toFixed(0).padStart(3)}%  (${entries.length} seeds contribute)`,
    );
  }
  console.log(`  aggregate explainability: ${ex.aggregateExplainability ? "yes" : "no"}`);
  out.explainability = {
    coverage: `${withEx.length}/${ex.entities.length}`,
    aggregate: !!ex.aggregateExplainability,
  };

  // 2. Analysis Compare: inspect the raw shape (undocumented in detail).
  console.log("\n[2] /v2/analysis/compare A vs B");
  try {
    const cmp = await client.compareProfiles({ aEntities: a, bEntities: b, take: 10 });
    const raw = cmp.raw as unknown;
    const describe = (v: unknown): string =>
      Array.isArray(v)
        ? `array(${v.length})${v[0] && typeof v[0] === "object" ? ` of {${Object.keys(v[0]).slice(0, 12).join(",")}}` : ""}`
        : v && typeof v === "object"
          ? `{${Object.keys(v).slice(0, 12).join(",")}}`
          : typeof v;
    console.log(`  results: ${describe(raw)}`);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) console.log(`    .${k}: ${describe(v)}`);
    }
    const nameOf = new Map(
      [...sc.a.seeds, ...sc.b.seeds].map((s) => [s.id, s.resolvedName ?? s.name]),
    );
    const interesting = cmp.sharedTags.filter(
      (t) => t.subtype?.includes("theme") || t.subtype?.includes("keyword"),
    );
    console.log(
      `  shared tags: ${cmp.sharedTags.length} unique (A-only ${cmp.aTags.length}, B-only ${cmp.bTags.length})`,
    );
    for (const t of [...cmp.sharedTags.slice(0, 5), ...interesting.slice(0, 5)]) {
      const who = (ids: string[]) =>
        ids
          .map((i) => nameOf.get(i) ?? "?")
          .slice(0, 3)
          .join(", ");
      console.log(
        `    ${t.name.padEnd(22)} ${String(t.subtype).padEnd(26)} score ${t.score?.toFixed(2)}  A: ${who(t.aEntityIds)} | B: ${who(t.bEntityIds)}`,
      );
    }
    out.compare = {
      shape: describe(raw),
      shared: cmp.sharedTags.length,
      themes: interesting.length,
    };
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
    out.compare = { error: (e as Error).message };
  }

  // 3. Taste analysis: tags for each side, and their overlap (program themes).
  console.log("\n[3] taste analysis (filter.type=urn:tag) for A, B");
  const tags = async (signal: string[]) => {
    const { apiKey, baseUrl } = getQlooEnv();
    const url = new URL("/v2/insights", baseUrl);
    url.searchParams.set("filter.type", "urn:tag");
    url.searchParams.set("signal.interests.entities", signal.join(","));
    url.searchParams.set("take", "40");
    const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
    const body = (await res.json()) as {
      results?: {
        tags?: {
          name: string;
          tag_id?: string;
          id?: string;
          subtype?: string;
          types?: string[];
          query?: { affinity?: number };
        }[];
      };
    };
    return { status: res.status, tags: body.results?.tags ?? [] };
  };
  const [ta, tb] = await Promise.all([tags(a), tags(b)]);
  console.log(
    `  status A ${ta.status} (${ta.tags.length} tags), B ${tb.status} (${tb.tags.length} tags)`,
  );
  const keyOf = (t: { tag_id?: string; id?: string; name: string }) => t.tag_id ?? t.id ?? t.name;
  const bKeys = new Set(tb.tags.map(keyOf));
  const shared = ta.tags.filter((t) => bKeys.has(keyOf(t)));
  console.log(
    `  A top: ${ta.tags
      .slice(0, 8)
      .map((t) => t.name)
      .join(", ")}`,
  );
  console.log(
    `  B top: ${tb.tags
      .slice(0, 8)
      .map((t) => t.name)
      .join(", ")}`,
  );
  console.log(
    `  shared (${shared.length}): ${shared
      .slice(0, 15)
      .map((t) => t.name)
      .join(", ")}`,
  );
  if (ta.tags[0]) console.log(`  tag fields: ${Object.keys(ta.tags[0]).join(",")}`);
  out.tags = { a: ta.tags.length, b: tb.tags.length, shared: shared.length };

  // 4. Location: place results scoped to the city.
  if (sc.location) {
    console.log(`\n[4] place results with filter.location.query="${sc.location}"`);
    const r = await client.getInsights({
      filterType: QLOO_TYPES.place,
      signalEntities: [...a, ...b],
      filterLocationQuery: sc.location,
      take: 10,
    });
    const cities = new Map<string, number>();
    for (const e of r.entities) {
      const c = e.geocode?.city ?? "unknown";
      cities.set(c, (cities.get(c) ?? 0) + 1);
    }
    console.log(
      `  ${r.entities.length} places; cities: ${[...cities].map(([c, n]) => `${c}×${n}`).join(", ")}`,
    );
    console.log(
      `  sample tags on a place: ${r.entities[0]?.tags
        .slice(0, 6)
        .map((t) => t.name ?? t.id)
        .join(", ")}`,
    );
    out.location = { places: r.entities.length, cities: Object.fromEntries(cities) };
  }

  writeOut(`features-${id}.json`, out);
  printStats();
}

main();
