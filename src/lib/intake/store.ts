import { z } from "zod";

/**
 * Participant intake storage. Stores ONLY aggregate counts per entity and a participant
 * counter: no names, emails, IPs or free text (plan §15). Backed by Upstash Redis when
 * configured, otherwise an in-process store (fine for local development, not for serverless).
 */

export const SIDE_KEYS = ["a", "b"] as const;
export type IntakeSide = (typeof SIDE_KEYS)[number];

export const PickSchema = z.object({
  entityId: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  type: z.string().max(80).nullable(),
  imageUrl: z.url().max(600).nullable(),
  popularity: z.number().min(0).max(1).nullable(),
});
export type Pick = z.infer<typeof PickSchema>;

export interface IntakeSession {
  id: string;
  title: string;
  labels: Record<IntakeSide, string>;
  createdAt: number;
}

export interface IntakeTally extends Pick {
  count: number;
}

export interface IntakeSideSummary {
  participants: number;
  entities: IntakeTally[];
}

export interface IntakeStore {
  readonly kind: "redis" | "memory";
  createSession(session: IntakeSession): Promise<void>;
  getSession(id: string): Promise<IntakeSession | null>;
  /** Record one participant's picks (deduplicated by entity). */
  addPicks(id: string, side: IntakeSide, picks: Pick[]): Promise<void>;
  summary(id: string, side: IntakeSide): Promise<IntakeSideSummary>;
}

export const TTL_SECONDS = 30 * 24 * 60 * 60;
const k = (id: string, ...parts: string[]) => ["cg", "intake", id, ...parts].join(":");

function tally(counts: Record<string, string>, info: Record<string, string>): IntakeTally[] {
  return Object.entries(counts)
    .flatMap(([entityId, n]) => {
      const raw = info[entityId];
      if (!raw) return [];
      const parsed = PickSchema.safeParse(JSON.parse(raw));
      return parsed.success ? [{ ...parsed.data, count: Number(n) || 0 }] : [];
    })
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}

// ---------- in-memory ----------

interface MemoryData {
  sessions: Map<string, IntakeSession>;
  hashes: Map<string, Record<string, string>>;
  counters: Map<string, number>;
}

const globalForStore = globalThis as unknown as { __cgIntake?: MemoryData };

export function createMemoryStore(data?: MemoryData): IntakeStore {
  const d =
    data ??
    (globalForStore.__cgIntake ??= { sessions: new Map(), hashes: new Map(), counters: new Map() });
  const hash = (key: string) => {
    let h = d.hashes.get(key);
    if (!h) d.hashes.set(key, (h = {}));
    return h;
  };
  return {
    kind: "memory",
    async createSession(s) {
      d.sessions.set(s.id, s);
    },
    async getSession(id) {
      return d.sessions.get(id) ?? null;
    },
    async addPicks(id, side, picks) {
      const counts = hash(k(id, side, "counts"));
      const info = hash(k(id, side, "entities"));
      for (const p of dedupe(picks)) {
        counts[p.entityId] = String((Number(counts[p.entityId]) || 0) + 1);
        info[p.entityId] = JSON.stringify(p);
      }
      const key = k(id, side, "participants");
      d.counters.set(key, (d.counters.get(key) ?? 0) + 1);
    },
    async summary(id, side) {
      return {
        participants: d.counters.get(k(id, side, "participants")) ?? 0,
        entities: tally(hash(k(id, side, "counts")), hash(k(id, side, "entities"))),
      };
    },
  };
}

// ---------- Upstash Redis (REST) ----------

export function createRedisStore(
  env: { url: string; token: string },
  doFetch: typeof fetch = fetch,
): IntakeStore {
  async function pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await doFetch(`${env.url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Intake store error (${res.status})`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Intake store error: ${failed.error}`);
    return out.map((r) => r.result);
  }
  const toRecord = (flat: unknown): Record<string, string> => {
    const arr = Array.isArray(flat) ? (flat as string[]) : [];
    const rec: Record<string, string> = {};
    for (let i = 0; i + 1 < arr.length; i += 2) rec[arr[i]] = arr[i + 1];
    return rec;
  };

  return {
    kind: "redis",
    async createSession(s) {
      await pipeline([["SET", k(s.id, "session"), JSON.stringify(s), "EX", TTL_SECONDS]]);
    },
    async getSession(id) {
      const [raw] = await pipeline([["GET", k(id, "session")]]);
      return typeof raw === "string" ? (JSON.parse(raw) as IntakeSession) : null;
    },
    async addPicks(id, side, picks) {
      const commands: (string | number)[][] = [];
      for (const p of dedupe(picks)) {
        commands.push(["HINCRBY", k(id, side, "counts"), p.entityId, 1]);
        commands.push(["HSET", k(id, side, "entities"), p.entityId, JSON.stringify(p)]);
      }
      commands.push(["INCR", k(id, side, "participants")]);
      for (const key of ["counts", "entities", "participants"]) {
        commands.push(["EXPIRE", k(id, side, key), TTL_SECONDS]);
      }
      await pipeline(commands);
    },
    async summary(id, side) {
      const [participants, counts, info] = await pipeline([
        ["GET", k(id, side, "participants")],
        ["HGETALL", k(id, side, "counts")],
        ["HGETALL", k(id, side, "entities")],
      ]);
      return {
        participants: Number(participants) || 0,
        entities: tally(toRecord(counts), toRecord(info)),
      };
    },
  };
}

function dedupe(picks: Pick[]): Pick[] {
  const seen = new Set<string>();
  return picks.filter((p) => !seen.has(p.entityId) && (seen.add(p.entityId), true));
}
