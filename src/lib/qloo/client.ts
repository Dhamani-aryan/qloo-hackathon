import { createHttp, type HttpOptions, type QueryValue } from "./http";
import { normalizeCompare, normalizeInsights, normalizeSearch, normalizeTags } from "./normalize";
import type { InsightsInput, QlooClient } from "./types";

export interface QlooClientOptions extends HttpOptions {
  /**
   * Called when a request succeeds but returns no results. Qloo silently ignores invalid
   * parameters, so an empty 200 often means a bad parameter rather than "no data".
   * Defaults to `console.warn`.
   */
  onEmpty?: (info: { path: string; params: Record<string, QueryValue> }) => void;
}

const defaultOnEmpty: NonNullable<QlooClientOptions["onEmpty"]> = ({ path, params }) =>
  console.warn(
    `[qloo] ${path} returned 0 results. Qloo ignores invalid parameters silently; check them.`,
    Object.keys(params).filter((k) => params[k] !== undefined),
  );

export function insightsParams(input: InsightsInput): Record<string, QueryValue> {
  return {
    "filter.type": input.filterType,
    "signal.interests.entities": input.signalEntities,
    "signal.interests.tags": input.signalTags,
    "filter.results.entities": input.resultEntities,
    "filter.exclude.entities": input.excludeEntities,
    "filter.tags": input.filterTags,
    "filter.location.query": input.filterLocationQuery,
    "signal.location.query": input.signalLocationQuery,
    "filter.popularity.min": input.popularityMin,
    "filter.popularity.max": input.popularityMax,
    "bias.trends": input.biasTrends,
    "feature.explainability": input.explainability,
    take: input.take,
    page: input.page,
    ...input.extraParams,
  };
}

export function createQlooClient(opts: QlooClientOptions): QlooClient {
  const get = createHttp(opts);
  const onEmpty = opts.onEmpty ?? defaultOnEmpty;

  async function call<T>(
    path: string,
    params: Record<string, QueryValue>,
    normalize: (body: unknown) => T,
    count: (r: T) => number,
  ): Promise<T> {
    const result = normalize(await get(path, params));
    if (count(result) === 0) onEmpty({ path, params });
    return result;
  }

  return {
    searchEntities: (input) =>
      call(
        "/search",
        { query: input.query, types: input.types, take: input.take },
        normalizeSearch,
        (r) => r.length,
      ),

    searchTags: (input) =>
      call(
        "/v2/tags",
        {
          "filter.query": input.query,
          "filter.tag.types": input.tagTypes,
          "filter.parents.types": input.parentTypes,
          "feature.typo_tolerance": input.typoTolerance,
          take: input.take,
        },
        normalizeTags,
        (r) => r.length,
      ),

    getInsights: (input) =>
      call("/v2/insights", insightsParams(input), normalizeInsights, (r) => r.entities.length),

    compareProfiles: (input) =>
      call(
        "/v2/analysis/compare",
        {
          "a.signal.interests.entities": input.aEntities,
          "b.signal.interests.entities": input.bEntities,
          "filter.type": input.filterTypes,
          "filter.location.query": input.locationQuery,
          model: input.model,
          take: input.take,
        },
        normalizeCompare,
        (r) => r.sharedTags.length + r.aTags.length + r.bTags.length,
      ),
  };
}
