/** Spike: can a theme ("live music", "bookstore", "food") narrow place discovery via filter.tags? */
import { createQlooClient } from "../src/lib/qloo/client";
import { getQlooEnv } from "../src/lib/env";

const qloo = createQlooClient(getQlooEnv());

async function main() {
  for (const q of ["live music", "bookstore", "food", "jazz", "art gallery", "video games"]) {
    const tags = await qloo.searchTags({ query: q, parentTypes: ["urn:entity:place"], take: 5 });
    console.log(`\n"${q}" → ${tags.map((t) => `${t.name} [${t.type}] ${t.id}`).join(" | ") || "none"}`);
    if (!tags[0]) continue;
    const seeds = await qloo.searchEntities({ query: "Miles Davis", types: ["urn:entity:artist"], take: 1 });
    const r = await qloo.getInsights({
      filterType: "urn:entity:place",
      signalEntities: seeds.map((s) => s.id),
      filterLocationQuery: "London",
      filterTags: [tags[0].id],
      take: 6,
    });
    console.log(`  places: ${r.entities.map((e) => `${e.name} (${e.affinity?.toFixed(2)})`).join(", ") || "none"}`);
  }
  const vg = await qloo.getInsights({
    filterType: "urn:entity:videogame",
    signalEntities: (await qloo.searchEntities({ query: "Stardew Valley", types: ["urn:entity:videogame"], take: 1 })).map((s) => s.id),
    take: 5,
  });
  console.log(`\nvideogame: ${vg.entities.map((e) => `${e.name} pop ${e.popularity?.toFixed(2)}`).join(", ")}`);
}
main();
