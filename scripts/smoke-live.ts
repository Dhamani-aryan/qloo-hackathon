/**
 * Smoke-test a deployment under load: run every prebuilt scenario LIVE (no cache) at the same
 * time, and report status, bridges, warnings and timing for each.
 *
 *   npm run smoke                                (against http://localhost:3005)
 *   npm run smoke -- https://your-app.vercel.app
 *
 * Parallel runs are what made Qloo rate-limit us once (eval run 4), so a clean result here
 * means busy-Qloo retries work in production. Each run counts against the per-IP live limit.
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
  retry?: boolean;
}

interface DoneResult {
  status: string;
  failure: string | null;
  engine?: { bridges: { entity: { name: string } }[]; warnings: string[] };
  program?: { sessions: unknown[] } | null;
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

async function run(id: string): Promise<boolean> {
  const preset = PREBUILT.find((p) => p.id === id)!;
  const draft = draftFromPrebuilt(preset);
  const sides: SideKey[] = ["a", "b"];
  const seeds = sides.flatMap((side) => draft[side].seeds.map((seed) => ({ side, seed })));
  const { results } = (await (
    await post("/api/entities/resolve", {
      queries: seeds.map(({ seed }) => ({ input: seed.input, type: seed.type })),
    })
  ).json()) as { results: Resolution[] };
  const busy = results.filter((r) => r.retry).length;
  results.forEach((r, i) => {
    Object.assign(seeds[i].seed, {
      status: r.bestId ? "resolved" : "unresolved",
      matches: r.matches,
      chosenId: r.bestId,
      confirmed: Boolean(r.bestId),
    });
  });

  const started = Date.now();
  const text = await (
    await post("/api/analysis", { scenario: toScenario(draft), fresh: true })
  ).text();
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  const block = text.split("\n\n").find((b) => b.startsWith("event: done"));
  if (!block) {
    console.log(`✗ ${preset.title}: stream ended without a result after ${secs}s`);
    return false;
  }
  const { result } = JSON.parse(block.split("\ndata: ")[1]) as { result: DoneResult };
  const warnings = result.engine?.warnings ?? [];
  const ok =
    result.status === "ok" && Boolean(result.program) && warnings.length === 0 && busy === 0;
  console.log(
    `${ok ? "✓" : "✗"} ${preset.title}: ${result.status} in ${secs}s · bridges: ${
      result.engine?.bridges.map((b) => b.entity.name).join(", ") || "none"
    } · plan: ${result.program ? `${result.program.sessions.length} sessions` : "missing"}${
      warnings.length ? ` · warnings: ${warnings.join(" | ")}` : ""
    }${busy ? ` · ${busy} lookup(s) needed a retry` : ""}${result.failure ? ` · failure: ${result.failure}` : ""}`,
  );
  return ok;
}

async function main() {
  console.log(`Running ${PREBUILT.length} scenario(s) live, in parallel, on ${base}`);
  const oks = await Promise.all(PREBUILT.map((p) => run(p.id)));
  if (oks.includes(false)) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
