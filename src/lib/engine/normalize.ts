/**
 * Score normalization. Qloo affinities are only comparable within one query and sit in a
 * narrow band (~0.80–0.97), so the engine compares candidates by percentile within a fixed pool.
 */

/** Percentile rank (0–1) of each value within the map. Ties share the lower rank. */
export function percentiles(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((x, y) => x[1] - y[1]);
  const n = sorted.length;
  const out = new Map<string, number>();
  if (n === 0) return out;
  if (n === 1) return new Map([[sorted[0][0], 1]]);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j++;
    for (let k = i; k <= j; k++) out.set(sorted[k][0], i / (n - 1));
    i = j + 1;
  }
  return out;
}

/** Harmonic mean: high only when BOTH inputs are high. */
export function harmonicMean(x: number, y: number): number {
  return x + y === 0 ? 0 : (2 * x * y) / (x + y);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0.22 → "22nd", 0.03 → "3rd": percentiles for display. */
export function ordinalPct(v: number): string {
  const n = Math.round(v * 100);
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}
