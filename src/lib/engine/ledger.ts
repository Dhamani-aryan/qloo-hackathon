import type { Evidence } from "./types";

/**
 * Append-only record of every Qloo fact the engine relies on. Every bridge, theme and
 * (later) every LLM claim must point at evidence IDs from here.
 */
export class EvidenceLedger {
  private readonly items = new Map<string, Evidence>();
  private readonly byCandidate = new Map<string, string[]>();
  private next = 1;

  add(evidence: Omit<Evidence, "evidenceId" | "source">): string {
    const evidenceId = `ev_${String(this.next++).padStart(4, "0")}`;
    this.items.set(evidenceId, { evidenceId, source: "qloo", ...evidence });
    const list = this.byCandidate.get(evidence.candidateId) ?? [];
    list.push(evidenceId);
    this.byCandidate.set(evidence.candidateId, list);
    return evidenceId;
  }

  get(evidenceId: string): Evidence | undefined {
    return this.items.get(evidenceId);
  }

  has(evidenceId: string): boolean {
    return this.items.has(evidenceId);
  }

  forCandidate(candidateId: string): Evidence[] {
    return (this.byCandidate.get(candidateId) ?? []).map((id) => this.items.get(id)!);
  }

  /** Mutate a stored item in place (used when shortlist percentiles are computed later). */
  update(evidenceId: string, patch: Partial<Omit<Evidence, "evidenceId" | "source">>): void {
    const current = this.items.get(evidenceId);
    if (!current) throw new Error(`Unknown evidence ID: ${evidenceId}`);
    this.items.set(evidenceId, { ...current, ...patch });
  }

  get size(): number {
    return this.items.size;
  }

  toJSON(): Evidence[] {
    return [...this.items.values()];
  }
}
