/**
 * Warm the run cache for the prebuilt demo scenarios, so judges get instant replays.
 *
 *   npm run warm                         (against http://localhost:3005)
 *   npm run warm -- https://your-app.vercel.app
 *
 * Builds each scenario with the same code the website uses (draft → toScenario), so the cache
 * key matches what a visitor's click will look up. A scenario that is already cached is reported
 * as such and not re-run. Run it against a server that uses the same Upstash database as the
 * deployment (or against the deployment itself).
 */
import {
  draftFromPrebuilt,
  toScenario,
  type DraftSeed,
  type SideKey,
} from "../src/components/studio/draft";
import { PREBUILT } from "../src/scenarios";

interface Resolution {
  bestId: string | null;
  matches: DraftSeed["matches"];
}

const base = (process.argv[2] ?? "http://localhost:3005").replace(/\/+$/, "");

async function post(path: string, body: unknown): Promise<Response> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`${path} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function warm(id: string) {
  const preset = PREBUILT.find((p) => p.id === id)!;
  const draft = draftFromPrebuilt(preset);
  const sides: SideKey[] = ["a", "b"];
  const seeds = sides.flatMap((side) => draft[side].seeds.map((seed) => ({ side, seed })));
  const { results } = (await (
    await post("/api/entities/resolve", {
      queries: seeds.map(({ seed }) => ({ input: seed.input, type: seed.type })),
    })
  ).json()) as { results: Resolution[] };
  // Same rule as the website for prebuilt scenarios: take Qloo's best match, confirmed.
  results.forEach((r, i) => {
    Object.assign(seeds[i].seed, {
      status: r.bestId ? "resolved" : "unresolved",
      matches: r.matches,
      chosenId: r.bestId,
      confirmed: Boolean(r.bestId),
    });
  });
  const scenario = toScenario(draft);

  const started = Date.now();
  const res = await post("/api/analysis", { scenario });
  const text = await res.text();
  const replayed = text.includes("event: replay");
  const done = text.includes("event: done");
  const status = text.match(/"status":"(ok|insufficient_evidence|partial)"/)?.[1] ?? "unknown";
  console.log(
    `${preset.title}: ${replayed ? "already cached" : "ran live and cached"} · ${status} · ${(
      (Date.now() - started) /
      1000
    ).toFixed(0)}s${done ? "" : " · WARNING: stream ended without a result"}`,
  );
}

async function main() {
  console.log(`Warming ${PREBUILT.length} scenario(s) on ${base}`);
  for (const p of PREBUILT) await warm(p.id);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
