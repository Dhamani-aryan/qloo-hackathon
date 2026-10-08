import { cacheKey, type Cache } from "@/lib/cache/cache";
import type { Scenario } from "@/lib/engine/types";
import type { AgentEvent, AgentResult } from "./orchestrator";

/**
 * Whole-run caching for demo speed. A finished run is stored server-side and replayed as a
 * compressed event stream (~3 s instead of ~80 s), so the investigation screen still shows
 * every real step. Runs whose LLM steps failed are never stored.
 */

export const RUN_CACHE_TTL = 7 * 24 * 60 * 60;
export const REPLAY_MS = 3000;

/** Marks a stream that is a replay of an earlier live run. */
export interface ReplayEvent {
  type: "replay";
  recordedAt: number;
  originalMs: number;
}
export type StreamEvent = AgentEvent | ReplayEvent;

interface Recording {
  version: 1;
  recordedAt: number;
  ms: number;
  /** Events with offsets; the two large events are stored once, in `result`. */
  events: { t: number; e: AgentEvent | { type: "engine_result_ref" } | { type: "done_ref" } }[];
  result: AgentResult;
}

export function runKey(scenario: Scenario, options: object): string {
  const seeds = (side: "a" | "b") =>
    scenario[side].seeds
      .filter((s) => s.confirmed)
      .map((s) => [s.entityId, s.weight])
      .sort();
  return cacheKey("run:v1", {
    objective: scenario.objective,
    location: scenario.location,
    labels: [scenario.a.label, scenario.b.label],
    a: seeds("a"),
    b: seeds("b"),
    options,
  });
}

/** Pass events through while recording them; store the recording when the run succeeds. */
export async function* recordRun(
  events: AsyncIterable<AgentEvent>,
  cache: Cache,
  key: string,
): AsyncGenerator<AgentEvent> {
  const started = Date.now();
  const recorded: Recording["events"] = [];
  for await (const e of events) {
    const t = Date.now() - started;
    recorded.push({
      t,
      e:
        e.type === "engine_result"
          ? { type: "engine_result_ref" }
          : e.type === "done"
            ? { type: "done_ref" }
            : e,
    });
    yield e;
    if (
      e.type === "done" &&
      (e.result.status === "ok" || e.result.status === "insufficient_evidence")
    ) {
      if (e.result.status === "ok" && !e.result.program) continue;
      const recording: Recording = {
        version: 1,
        recordedAt: Date.now(),
        ms: t,
        events: recorded,
        result: e.result,
      };
      await cache.set(key, recording, RUN_CACHE_TTL);
    }
  }
}

export async function loadRecording(cache: Cache, key: string): Promise<Recording | null> {
  const r = await cache.get<Recording>(key);
  return r && r.version === 1 ? r : null;
}

/** Replay a recording, compressing its timeline to about `REPLAY_MS`. */
export async function* replayRun(
  recording: Recording,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): AsyncGenerator<StreamEvent> {
  yield { type: "replay", recordedAt: recording.recordedAt, originalMs: recording.ms };
  const scale = recording.ms > 0 ? REPLAY_MS / recording.ms : 0;
  let last = 0;
  for (const { t, e } of recording.events) {
    const wait = (t - last) * scale;
    last = t;
    if (wait >= 15) await sleep(wait);
    if (e.type === "engine_result_ref") {
      yield { type: "engine_result", result: recording.result.engine! };
    } else if (e.type === "done_ref") {
      yield { type: "done", result: recording.result };
    } else {
      yield e;
    }
  }
}
