// Programme memberships on a startup page and in its CSV export.
//
// Some cohorts are known to the editors but not public (for example the
// editor-only "F/ai — Batch 2"): the membership, its edition or the
// programme itself is marked verification_status = 'private'. The startup
// page and export read with the service role, which bypasses row-level
// security, so private memberships must be dropped here. Admins still see
// them, flagged `isPrivate` so the page can label them.
//
// Same rule as lib/embed/cohort.ts and the Enterprise API loader.

/** Columns to select from program_organizations (with its edition and programme). */
export const PROGRAM_MEMBERSHIP_SELECT =
  "id, membership_role, verification_status, program_editions(name, cohort_label, year, verification_status, programs(name, program_type, verification_status))"

export type ProgramMembership = {
  id: string
  program_name: string
  program_type: string
  edition_label: string | null
  year: number | null
  membership_role: string | null
  /** Marked private on the membership, edition or programme (only ever true for admins). */
  isPrivate: boolean
}

type Row = Record<string, unknown>
const one = (v: unknown): Row | null => ((Array.isArray(v) ? v[0] : v) as Row | null | undefined) ?? null

/** Turn raw program_organizations rows into memberships, dropping private ones unless `isAdmin`. */
export function programMemberships(rows: Row[] | null | undefined, isAdmin: boolean): ProgramMembership[] {
  return (rows ?? []).flatMap((row) => {
    const ed = one(row.program_editions)
    const prog = ed ? one(ed.programs) : null
    const isPrivate = [row.verification_status, ed?.verification_status, prog?.verification_status].includes("private")
    if (isPrivate && !isAdmin) return []
    return [{
      id: row.id as string,
      program_name: (prog?.name as string) ?? "Unknown",
      program_type: (prog?.program_type as string) ?? "other",
      edition_label: (ed?.cohort_label as string) ?? (ed?.name as string) ?? null,
      year: (ed?.year as number) ?? null,
      membership_role: (row.membership_role as string) ?? null,
      isPrivate,
    }]
  })
}
