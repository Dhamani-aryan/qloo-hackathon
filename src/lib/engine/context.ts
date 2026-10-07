import type { QlooClient } from "@/lib/qloo";
import { EvidenceLedger } from "./ledger";
import type { DomainKey, EngineEvent, Scenario, Side } from "./types";

export class BudgetExceededError extends Error {
  constructor(max: number) {
    super(`Qloo call budget of ${max} calls for this analysis is used up`);
    this.name = "BudgetExceededError";
  }
}

/** Caps how many Qloo calls one analysis may make. */
export class CallBudget {
  private used = 0;
  constructor(readonly max: number) {}

  spend(): void {
    if (this.used >= this.max) throw new BudgetExceededError(this.max);
    this.used++;
  }

  get spent(): number {
    return this.used;
  }
}

/** Runs at most `concurrency` tasks at once. */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

export interface EngineOptions {
  domains?: DomainKey[];
  /** Max Qloo calls per analysis. Default 40 (the spike needed ~21 for five domains). */
  maxCalls?: number;
  concurrency?: number;
  onEvent?: (event: EngineEvent) => void;
}

/** Shared state for one engine run. */
export interface EngineContext {
  client: QlooClient;
  scenario: Scenario;
  ledger: EvidenceLedger;
  budget: CallBudget;
  limit: ReturnType<typeof createLimiter>;
  emit: (event: EngineEvent) => void;
  warnings: string[];
  /** Confirmed seed entity IDs per side. */
  seedIds: Record<Side, string[]>;
  /** Seed entity ID → side, for attributing explainability. */
  sideOf: Map<string, Side>;
}

export function createContext(
  client: QlooClient,
  scenario: Scenario,
  options: EngineOptions = {},
): EngineContext {
  const ids = (side: Side) =>
    (side === "A" ? scenario.a : scenario.b).seeds
      .filter((s) => s.confirmed)
      .map((s) => s.entityId);
  const seedIds = { A: ids("A"), B: ids("B") };
  const sideOf = new Map<string, Side>();
  for (const side of ["A", "B"] as const) for (const id of seedIds[side]) sideOf.set(id, side);

  const warnings: string[] = [];
  const onEvent = options.onEvent ?? (() => {});
  return {
    client,
    scenario,
    ledger: new EvidenceLedger(),
    budget: new CallBudget(options.maxCalls ?? 40),
    limit: createLimiter(options.concurrency ?? 4),
    emit: (event) => {
      if (event.type === "warning") warnings.push(event.message);
      onEvent(event);
    },
    warnings,
    seedIds,
    sideOf,
  };
}

/** Run one Qloo call under the limiter and budget, reporting timing. */
export async function qlooCall<T>(
  ctx: EngineContext,
  purpose: string,
  domain: DomainKey | null,
  call: () => Promise<T>,
  count: (r: T) => number,
): Promise<T> {
  return ctx.limit(async () => {
    ctx.budget.spend();
    const started = Date.now();
    const result = await call();
    ctx.emit({
      type: "qloo_query_done",
      purpose,
      domain,
      results: count(result),
      ms: Date.now() - started,
    });
    return result;
  });
}
