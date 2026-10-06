import { QlooError } from "./errors";
import type {
  CompareResult,
  EntityMatch,
  InsightsEntity,
  InsightsResult,
  QlooEntity,
  TagMatch,
} from "./types";

/**
 * Lenient normalizers for raw Qloo JSON. The docs describe the shapes only loosely, so
 * every field is optional here and missing values become `null` rather than errors.
 * The spike (steps 1.5–1.7) confirms real shapes; tighten these if needed then.
 */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function imageUrl(props: Obj): string | null {
  const image = props.image;
  if (typeof image === "string") return image;
  if (isObj(image)) return str(image.url);
  return null;
}

function tagsOf(raw: Obj): QlooEntity["tags"] {
  return arr(raw.tags).flatMap((t) => {
    if (typeof t === "string") return [{ id: t, name: null, type: null }];
    if (!isObj(t)) return [];
    const id = str(t.tag_id) ?? str(t.id);
    return id ? [{ id, name: str(t.name), type: str(t.type) }] : [];
  });
}

/** Explainability values may be numbers or `{ score }` objects. */
function scoreMap(v: unknown): Record<string, number> | null {
  if (!isObj(v)) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v)) {
    const score = num(value) ?? (isObj(value) ? num(value.score) : null);
    if (score !== null) out[key] = score;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeEntity(raw: unknown): QlooEntity | null {
  if (!isObj(raw)) return null;
  const id = str(raw.entity_id) ?? str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const props = obj(raw.properties);
  const geo = isObj(props.geocode) ? props.geocode : null;
  return {
    id,
    name,
    type: str(raw.type) ?? str(arr(raw.types)[0]),
    subtype: str(raw.subtype),
    description: str(props.description) ?? str(props.short_description),
    imageUrl: imageUrl(props),
    popularity: num(raw.popularity),
    disambiguation: str(raw.disambiguation),
    geocode: geo && {
      city: str(geo.city),
      metro: str(geo.metro),
      countryCode: str(geo.country_code),
      latitude: num(geo.latitude),
      longitude: num(geo.longitude),
    },
    tags: tagsOf(raw),
  };
}

function requireSuccess(body: unknown, path: string): Obj {
  if (!isObj(body)) throw new QlooError("invalid_response", path, null, "expected a JSON object");
  if (body.success === false) {
    throw new QlooError("bad_request", path, null, str(obj(body.error).message) ?? "success=false");
  }
  return body;
}

export function normalizeSearch(body: unknown): EntityMatch[] {
  const b = requireSuccess(body, "/search");
  const results = Array.isArray(b.results) ? b.results : arr(obj(b.results).entities);
  return results.flatMap((raw, i) => {
    const e = normalizeEntity(raw);
    return e ? [{ ...e, rank: i + 1 }] : [];
  });
}

export function normalizeInsights(body: unknown): InsightsResult {
  const b = requireSuccess(body, "/v2/insights");
  const results = obj(b.results);
  const entities: InsightsEntity[] = arr(results.entities).flatMap((raw, i) => {
    const e = normalizeEntity(raw);
    if (!e) return [];
    const q = obj((raw as Obj).query);
    return [
      {
        ...e,
        rank: i + 1,
        affinity: num(q.affinity),
        affinityRank: num(q.affinity_rank),
        explainability: scoreMap(q.explainability),
      },
    ];
  });
  const aggregate = obj(obj(b.query).explainability);
  return {
    entities,
    aggregateExplainability: scoreMap(aggregate.all) ?? scoreMap(aggregate.top_10),
    durationMs: num(results.duration) ?? num(b.duration),
  };
}

export function normalizeTags(body: unknown): TagMatch[] {
  const b = requireSuccess(body, "/v2/tags");
  const tags = Array.isArray(b.results) ? b.results : arr(obj(b.results).tags);
  return tags.flatMap((t) => {
    if (!isObj(t)) return [];
    const id = str(t.id) ?? str(t.tag_id);
    const name = str(t.name);
    if (!id || !name) return [];
    const parents = arr(t.parents).flatMap((p) =>
      typeof p === "string" ? [p] : isObj(p) && str(p.type) ? [str(p.type)!] : [],
    );
    return [{ id, name, type: str(t.type) ?? str(t.subtype), parents }];
  });
}

export function normalizeCompare(body: unknown): CompareResult {
  const b = requireSuccess(body, "/v2/analysis/compare");
  const list = Array.isArray(b.results)
    ? b.results
    : [...arr(obj(b.results).entities), ...arr(obj(b.results).tags)];
  return {
    entities: list.flatMap((raw) => normalizeEntity(raw) ?? []),
    raw: b.results ?? null,
    durationMs: num(b.duration),
  };
}
