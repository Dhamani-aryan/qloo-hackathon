import type { QlooClient } from "@/lib/qloo";
import { buildPool } from "./candidates";
import { createContext, type EngineOptions } from "./context";
import { expandDomain } from "./expand";
import { scoreCandidate } from "./score";
import { selectBridges } from "./select";
import { findThemes } from "./themes";
import {
  DEFAULT_DOMAINS,
  type EngineResult,
  type Rejection,
  type Scenario,
  type ScoredCandidate,
} from "./types";
import { scoreSides } from "./validate";

export const MIN_SEEDS_PER_SIDE = 3;
const MAX_TAGS = 12;

/** Every Qloo call failed (bad key, outage, rate limit): not the same as "no bridge found". */
export class QlooUnavailableError extends Error {
  constructor(detail: string) {
    super(`Qloo is unavailable: ${detail}`);
    this.name = "QlooUnavailableError";
  }
}

export interface RunOptions extends EngineOptions {
  minSeedsPerSide?: number;
}

/**
 * The deterministic bridge engine: confirmed profiles in, ranked bilateral bridges out,
 * with every claim traceable to the evidence ledger. No LLM is involved.
 *
 * Per domain: expand (combined + popularity-capped) → pool + filters → score against A and B →
 * percentile, lift, Bridge Potential. Themes come from one Analysis Compare call.
 */
export async function runBridgeEngine(
  client: QlooClient,
  scenario: Scenario,
  options: RunOptions = {},
): Promise<EngineResult> {
  const started = Date.now();
  const ctx = createContext(client, scenario, options);
  const domains = options.domains ?? DEFAULT_DOMAINS;
  const minSeeds = options.minSeedsPerSide ?? MIN_SEEDS_PER_SIDE;

  const result = (partial: Partial<EngineResult>, poolSize = 0): EngineResult => ({
    scenarioId: scenario.id,
    status: "insufficient_evidence",
    bridges: [],
    obvious: null,
    runnersUp: [],
    themes: [],
    rejections: [],
    evidence: ctx.ledger.toJSON(),
    warnings: ctx.warnings,
    stats: {
      qlooCalls: ctx.budget.spent,
      ms: Date.now() - started,
      domains,
      poolSize,
      evidenceTotal: ctx.ledger.size,
    },
    ...partial,
  });

  for (const side of ["A", "B"] as const) {
    if (ctx.seedIds[side].length < minSeeds) {
      ctx.emit({
        type: "warning",
        message: `Community ${side} has ${ctx.seedIds[side].length} confirmed seeds; at least ${minSeeds} are needed.`,
      });
    }
  }
  if (ctx.warnings.length) return result({});

  const themesPromise = findThemes(ctx);
  const perDomain = await Promise.all(
    domains.map(async (domain) => {
      const expansion = await expandDomain(ctx, domain);
      const { candidates, rejections } = buildPool(ctx, expansion);
      const scores = await scoreSides(ctx, domain, candidates);
      return { candidates, rejections, scores };
    }),
  );
  const themes = await themesPromise;
  if (ctx.succeeded === 0) {
    throw new QlooUnavailableError(ctx.warnings[0] ?? "no response from Qloo");
  }

  const scored: ScoredCandidate[] = [];
  const rejections: Rejection[] = [];
  let poolSize = 0;
  for (const d of perDomain) {
    poolSize += d.candidates.length;
    rejections.push(...d.rejections);
    for (const c of d.candidates) {
      const s = scoreCandidate(c, d.scores, themes);
      scored.push(s);
      if (s.verdict === "rejected") {
        rejections.push({
          candidateId: c.entity.id,
          name: c.entity.name,
          domain: c.domain,
          reason: s.rejectionReason ?? "rejected",
        });
      }
    }
  }

  const selection = selectBridges(scored);
  selection.bridges.forEach((b, i) =>
    ctx.emit({
      type: "bridge_ranked",
      rank: i + 1,
      name: b.entity.name,
      domain: b.domain,
      bridgePotential: b.bridgePotential,
    }),
  );
  if (selection.status === "insufficient_evidence") {
    ctx.emit({
      type: "warning",
      message: "No candidate had strong, non-mainstream support from both communities.",
    });
  }

  // Keep the payload small (the full ledger was ~430 KB for one NYC run): return only the
  // evidence the results cite, and trim the long tag lists Qloo attaches to entities.
  const shown = [
    ...selection.bridges,
    ...selection.runnersUp,
    ...(selection.obvious ? [selection.obvious] : []),
  ];
  const cited = new Set([
    ...shown.flatMap((c) => c.evidenceIds),
    ...themes.map((t) => t.evidenceId),
  ]);
  const slim = (c: ScoredCandidate): ScoredCandidate => ({
    ...c,
    entity: { ...c.entity, tags: c.entity.tags.slice(0, MAX_TAGS) },
  });
  return result(
    {
      bridges: selection.bridges.map(slim),
      runnersUp: selection.runnersUp.map(slim),
      obvious: selection.obvious && slim(selection.obvious),
      status: selection.status,
      themes,
      rejections,
      evidence: ctx.ledger.toJSON().filter((e) => cited.has(e.evidenceId)),
    },
    poolSize,
  );
}

export * from "./types";
export { EvidenceLedger } from "./ledger";
export { resolveSeed, toSeed, assessMatches, type SeedResolution } from "./resolve";
