/**
 * Live connectivity check for the Qloo hackathon key.
 *
 *   npm run spike spike/00-ping.ts
 *
 * Makes three small calls (search, tags, insights) and prints a pass/fail line for each.
 * Set QLOO_DUMP=1 to save raw responses to spike/out/ (git-ignored; never commit them).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { MissingEnvError, getQlooEnv } from "../src/lib/env";
import { QLOO_TYPES, QlooError, createQlooClient } from "../src/lib/qloo";

async function main() {
  let env;
  try {
    env = getQlooEnv();
  } catch (err) {
    if (err instanceof MissingEnvError) {
      console.log("No Qloo key yet. Add QLOO_API_KEY to .env.local, then run this again.");
      process.exit(1);
    }
    throw err;
  }

  const dump = process.env.QLOO_DUMP === "1";
  if (dump) mkdirSync("spike/out", { recursive: true });

  const qloo = createQlooClient({
    ...env,
    onResponse: ({ path, body, ms }) => {
      console.log(`  ${path} answered in ${ms}ms`);
      if (dump) {
        const file = `spike/out/ping${path.replace(/\W+/g, "_")}.json`;
        writeFileSync(file, JSON.stringify(body, null, 2));
      }
    },
  });

  console.log(`Base URL: ${env.baseUrl}\n`);
  let failures = 0;

  async function check(label: string, fn: () => Promise<string>) {
    try {
      console.log(`✔ ${label}: ${await fn()}`);
    } catch (err) {
      failures++;
      console.log(`✘ ${label}: ${err instanceof QlooError ? err.message : String(err)}`);
    }
  }

  let movieId: string | undefined;
  await check("search", async () => {
    const r = await qloo.searchEntities({
      query: "Spirited Away",
      types: [QLOO_TYPES.movie],
      take: 3,
    });
    movieId = r[0]?.id;
    return r.map((e) => `${e.name} [${e.type}]`).join(", ") || "no results";
  });

  await check("tags", async () => {
    const r = await qloo.searchTags({ query: "coming of age", take: 3 });
    return r.map((t) => `${t.name} (${t.id})`).join(", ") || "no results";
  });

  await check("insights", async () => {
    if (!movieId) throw new Error("skipped: search found no seed entity");
    const r = await qloo.getInsights({
      filterType: QLOO_TYPES.movie,
      signalEntities: [movieId],
      take: 5,
    });
    return r.entities
      .map((e) => `${e.name} (affinity ${e.affinity ?? "?"}, pop ${e.popularity ?? "?"})`)
      .join(", ");
  });

  console.log(
    failures === 0 ? "\nAll checks passed. The key works." : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
