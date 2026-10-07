import type { DomainExpansion } from "./expand";
import type { EngineContext } from "./context";
import { rejectionReason } from "./filters";
import type { AdmissionRule, Candidate, Rejection } from "./types";

/** Qloo shortlist scoring accepts at most this many entities per request. */
export const MAX_POOL = 50;

const RULE_ORDER: AdmissionRule[] = ["combined-top", "popularity-capped"];

/**
 * Merge a domain's discovery results into one de-duplicated candidate pool.
 * The spike showed that intersecting separate A and B top lists is too strict, so the
 * pool is the combined-signal results; bilateral support is tested afterwards.
 */
export function buildPool(
  ctx: EngineContext,
  x: DomainExpansion,
): { candidates: Candidate[]; rejections: Rejection[] } {
  const byId = new Map<string, Candidate>();
  const rejections: Rejection[] = [];
  const rejected = new Set<string>();

  for (const rule of RULE_ORDER) {
    for (const entity of x.results[rule]) {
      if (rejected.has(entity.id)) continue;
      const existing = byId.get(entity.id);
      if (existing) {
        if (!existing.admittedBy.includes(rule)) existing.admittedBy.push(rule);
        continue;
      }
      const reason = rejectionReason(entity, x.domain);
      if (reason) {
        rejected.add(entity.id);
        rejections.push({ candidateId: entity.id, name: entity.name, domain: x.domain, reason });
        ctx.emit({ type: "candidate_rejected", domain: x.domain, name: entity.name, reason });
        continue;
      }
      if (byId.size >= MAX_POOL) continue;
      byId.set(entity.id, {
        entity,
        domain: x.domain,
        admittedBy: [rule],
        supportingSeeds: x.supportingSeeds.get(entity.id) ?? { A: [], B: [] },
        evidenceIds: x.evidenceIds.get(entity.id) ?? [],
      });
    }
  }

  const candidates = [...byId.values()];
  for (const c of candidates) {
    ctx.emit({
      type: "candidate_found",
      domain: x.domain,
      name: c.entity.name,
      admittedBy: c.admittedBy,
    });
  }
  return { candidates, rejections };
}

export function poolIds(candidates: Candidate[]): string[] {
  return candidates.map((c) => c.entity.id);
}
