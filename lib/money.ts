// Money columns shared with the Navigator are stored in MILLIONS of euros:
// organizations.total_raised_eur and funding_rounds.amount_eur both hold
// 5 for €5M. People and import files work in whole euros (5000000), so convert
// at the edges: toStoredMillions() on the way in, fromStoredMillions() on the
// way out. The Navigator does the same (its formatEurFromDb / AMOUNT_MULTIPLIER).
//
// Not every *_eur column is in millions: grants.amount_eur, legal-entity
// capital_eur and subscription event amounts are whole euros.

export const EUR_MILLIONS_UNIT = 1_000_000

/** Whole euros → stored millions, rounded to the column's 2 decimals (€10K). */
export function toStoredMillions(eur: number | string | null | undefined): number | null {
  if (eur === null || eur === undefined || eur === "") return null
  const n = typeof eur === "number" ? eur : Number(eur)
  if (!Number.isFinite(n)) return null
  return Math.round((n / EUR_MILLIONS_UNIT) * 100) / 100
}

/** Stored millions → whole euros. Postgres numeric can arrive as a string. */
export function fromStoredMillions(millions: number | string | null | undefined): number | null {
  if (millions === null || millions === undefined || millions === "") return null
  const n = typeof millions === "number" ? millions : Number(millions)
  if (!Number.isFinite(n)) return null
  return Math.round(n * EUR_MILLIONS_UNIT)
}
