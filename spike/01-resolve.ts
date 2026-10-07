/**
 * Step 1.4: resolve every seed in spike/seeds.json to a Qloo entity.
 *
 *   npm run spike spike/01-resolve.ts
 *
 * Writes spike/out/resolved.json (git-ignored). If a seed resolves to the wrong entity,
 * add "pickId": "<entity id>" to it in seeds.json and run again.
 */
import {
  mapLimit,
  pct,
  printStats,
  qloo,
  readJson,
  urn,
  writeOut,
  type ResolvedSeed,
  type ScenarioSpec,
  type SeedSpec,
} from "./lib";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

async function main() {
  const client = qloo();
  const scenarios = readJson<ScenarioSpec[]>("spike/seeds.json");

  async function resolve(seed: SeedSpec): Promise<ResolvedSeed> {
    const matches = await client
      .searchEntities({ query: seed.name, types: [urn(seed.type)], take: 5 })
      .catch((e) => {
        console.log(`  ! ${seed.name}: ${e.message}`);
        return [];
      });
    const alternatives = matches.map(
      (m) => `${m.name}${m.disambiguation ? ` (${m.disambiguation})` : ""} [${m.id}]`,
    );
    const override = seed.pickId ? matches.find((m) => m.id === seed.pickId) : undefined;
    const exact = matches.find((m) => norm(m.name) === norm(seed.name));
    const pick = override ?? exact ?? matches[0];
    return {
      ...seed,
      id: pick?.id ?? seed.pickId ?? null,
      resolvedName: pick?.name ?? null,
      resolvedType: pick?.type ?? null,
      popularity: pick?.popularity ?? null,
      status: !pick ? "unresolved" : override ? "override" : exact ? "exact" : "close",
      alternatives,
    };
  }

  const resolved = [];
  for (const sc of scenarios) {
    console.log(`\n=== ${sc.title}`);
    const side = async (label: string, seeds: SeedSpec[]) => {
      const out = await mapLimit(seeds, 3, resolve);
      console.log(`\n  ${label}`);
      for (const s of out) {
        const mark = { exact: "✔", override: "✔", close: "?", unresolved: "✘" }[s.status];
        console.log(
          `  ${mark} ${s.name} → ${s.resolvedName ?? "—"} [${s.type}] pop=${s.popularity?.toFixed(3) ?? "?"}`,
        );
        if (s.status === "close") console.log(`      alternatives: ${s.alternatives.join(" | ")}`);
      }
      return { label, seeds: out };
    };
    const a = await side(`A: ${sc.a.label}`, sc.a.seeds);
    const b = await side(`B: ${sc.b.label}`, sc.b.seeds);
    const all = [...a.seeds, ...b.seeds];
    const ok = all.filter((s) => s.status === "exact" || s.status === "override").length;
    console.log(`\n  Resolution: ${ok}/${all.length} exact (${pct(ok / all.length)})`);
    resolved.push({ ...sc, a, b });
  }

  writeOut("resolved.json", resolved);
  printStats();
}

main();
