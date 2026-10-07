/**
 * Shared helpers for spike scripts. Raw Qloo output only ever goes to spike/out/
 * (git-ignored): Qloo's terms prohibit storing responses in a public repo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getQlooEnv } from "../src/lib/env";
import { QLOO_TYPES, createQlooClient, type QlooTypeKey } from "../src/lib/qloo";

export const OUT = "spike/out";

export interface SeedSpec {
  name: string;
  type: QlooTypeKey;
  /** Optional manual override when search picks the wrong entity. */
  pickId?: string;
}

export interface CommunitySpec {
  label: string;
  seeds: SeedSpec[];
}

export interface ScenarioSpec {
  id: string;
  title: string;
  location?: string;
  a: CommunitySpec;
  b: CommunitySpec;
}

export interface ResolvedSeed extends SeedSpec {
  id: string | null;
  resolvedName: string | null;
  resolvedType: string | null;
  popularity: number | null;
  status: "exact" | "close" | "override" | "unresolved";
  alternatives: string[];
}

export interface ResolvedScenario extends Omit<ScenarioSpec, "a" | "b"> {
  a: { label: string; seeds: ResolvedSeed[] };
  b: { label: string; seeds: ResolvedSeed[] };
}

export const stats = { calls: 0, totalMs: 0, byPath: {} as Record<string, number[]> };

export function qloo() {
  return createQlooClient({
    ...getQlooEnv(),
    timeoutMs: 20_000,
    onResponse: ({ path, ms }) => {
      stats.calls++;
      stats.totalMs += ms;
      (stats.byPath[path] ??= []).push(ms);
    },
    onEmpty: () => {},
  });
}

export function printStats() {
  console.log(`\nQloo calls: ${stats.calls}, total ${(stats.totalMs / 1000).toFixed(1)}s`);
  for (const [path, list] of Object.entries(stats.byPath)) {
    const sorted = [...list].sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${path}: n=${list.length}, median ${median}ms, max ${sorted.at(-1)}ms`);
  }
}

export function urn(type: QlooTypeKey): string {
  return QLOO_TYPES[type];
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeOut(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2));
}

export function readResolved(): ResolvedScenario[] {
  const path = `${OUT}/resolved.json`;
  if (!existsSync(path)) {
    console.error("Run step 1.4 first: npm run spike spike/01-resolve.ts");
    process.exit(1);
  }
  return readJson<ResolvedScenario[]>(path);
}

export function confirmedIds(seeds: ResolvedSeed[]): string[] {
  return seeds.flatMap((s) => (s.id ? [s.id] : []));
}

/** Bounded-concurrency map, to stay gentle on the API. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
