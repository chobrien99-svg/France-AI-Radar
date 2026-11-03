import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { STATES, STATE_LABELS, type State } from "@/lib/detection/review"

type Row = Record<string, unknown>

const HISTORY = [
  { value: "all", label: "All" },
  { value: "new", label: "New finds only" },
  { value: "history", label: "History import only" },
] as const

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ state?: string; history?: string; year?: string }> }) {
  await requireAdmin()
  const params = await searchParams
  const state: State = STATES.includes(params.state as State) ? (params.state as State) : "new"
  const history = HISTORY.some((h) => h.value === params.history) ? params.history! : "all"
  const svc = await createServiceClient()

  // Editions (e.g. i-PhD 2026): yearly awards make the latest cohort the freshest signal.
  // Only awards to a project: candidates are filtered and labelled through their project,
  // and awards made directly to a person or organization have no project to attach to.
  const { data: awardRows } = await svc.from("awards").select("recipient_project_id, program_name, edition_year")
    .not("edition_year", "is", null).not("recipient_project_id", "is", null)
  const awards = ((awardRows ?? []) as Row[]).filter((a) => a.recipient_project_id)
  const years = [...new Set(awards.map((a) => Number(a.edition_year)))].sort((a, b) => b - a)
  const year = years.includes(Number(params.year)) ? Number(params.year) : null
  const yearProjects = year === null ? null : awards.filter((a) => Number(a.edition_year) === year).map((a) => a.recipient_project_id as string)
  const editionByProject = new Map<string, string>()
  for (const a of awards) {
    const label = `${a.program_name ?? "Award"} ${a.edition_year}`
    const prev = editionByProject.get(a.recipient_project_id as string)
    editionByProject.set(a.recipient_project_id as string, prev ? `${prev}, ${label}` : label)
  }
  // Project ids of the chosen edition year (null = all years; a placeholder id when none, so nothing matches).
  const yearIds = yearProjects === null ? null : yearProjects.length ? yearProjects : ["00000000-0000-0000-0000-000000000000"]

  let query = svc.from("detection_candidates")
    .select("id, kind, title, summary, why_surfaced, ai_relevance, ai_terms, is_backfill, created_at, last_evidence_at, project_id, candidate_subjects(role, proposed_name, status)")
    .eq("state", state)
    // Latest evidence first, so a changed item resurfaces above older imports.
    .order("last_evidence_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200)
  if (history === "new") query = query.eq("is_backfill", false)
  if (history === "history") query = query.eq("is_backfill", true)
  if (yearIds) query = query.in("project_id", yearIds)

  const [{ data: rows, error }, counts, { data: sources }] = await Promise.all([
    query,
    Promise.all(STATES.map(async (s) => {
      let q = svc.from("detection_candidates").select("id", { count: "exact", head: true }).eq("state", s)
      if (yearIds) q = q.in("project_id", yearIds)
      return [s, (await q).count ?? 0] as const
    })),
    svc.from("detection_sources").select("name, enabled, last_run_at, last_success_at, consecutive_failures"),
  ])
  const countBy = Object.fromEntries(counts) as Record<State, number>
  const failing = ((sources ?? []) as Row[]).filter((s) => Number(s.consecutive_failures) > 0)

  const href = (s: string, h = history, y: number | null = year) =>
    `/admin/candidates?state=${s}${h !== "all" ? `&history=${h}` : ""}${y !== null ? `&year=${y}` : ""}`

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin · Early detection</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Candidates</h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
          Possible founders and pre-company projects found in the <Link href="/admin/sources" className="underline">sources</Link>.
          Everything here is private. People and labs are only suggested matches until you confirm them,
          and approving a candidate publishes nothing yet.
        </p>
        {failing.length > 0 && (
          <p className="mt-3 border-l-2 border-l-destructive bg-card px-3 py-2 text-[12px] text-foreground">
            {failing.map((s) => `${s.name}: last ${s.consecutive_failures} run${Number(s.consecutive_failures) === 1 ? "" : "s"} failed`).join(" · ")}{" "}
            <Link href="/admin/sources" className="underline">See sources</Link>
          </p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {STATES.map((s) => (
          <Link key={s} href={href(s)}
            className={`border-b-2 px-3 py-2 text-[13px] font-medium ${state === s ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {STATE_LABELS[s]}{countBy[s] ? ` (${countBy[s]})` : ""}
          </Link>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-3 text-[12px]">
        {HISTORY.map((h) => (
          <Link key={h.value} href={href(state, h.value)} className={history === h.value ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>
            {h.label}
          </Link>
        ))}
      </div>
      {years.length > 0 && (
        <div className="mb-5 flex flex-wrap items-baseline gap-3 text-[12px]">
          <span className="text-muted-foreground">Edition:</span>
          <Link href={href(state, history, null)} className={year === null ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>All years</Link>
          {years.map((y) => (
            <Link key={y} href={href(state, history, y)} className={year === y ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>{y}</Link>
          ))}
        </div>
      )}

      {error ? (
        <p className="border-l-2 border-l-destructive bg-card p-4 text-[13px] text-foreground">
          Early detection isn&rsquo;t set up in this database yet. Apply <code>supabase/migrations/20261104_early_detection_foundation.sql</code>.
        </p>
      ) : (rows ?? []).length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {year !== null ? `Nothing here for ${year}.` : state === "new" ? "Nothing new. Candidates appear here after a source is read (Admin › Sources)." : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-2">
          {((rows ?? []) as Row[]).map((c) => {
            const subjects = (c.candidate_subjects ?? []) as Row[]
            const person = subjects.filter((s) => s.role === "person").map((s) => s.proposed_name).join(", ")
            const lab = subjects.find((s) => s.role === "lab")?.proposed_name as string | undefined
            const terms = ((c.ai_terms ?? []) as string[]).slice(0, 4)
            return (
              <li key={c.id as string}>
                <Link href={`/admin/candidates/${c.id}`} className="data-card block p-4 hover:bg-accent/40">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[15px] font-semibold text-foreground">{c.title as string}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.kind === "project" ? "Pre-company project" : String(c.kind)}</span>
                    {c.project_id && editionByProject.get(c.project_id as string) ? (
                      <span className="bg-secondary px-1.5 text-[11px] font-medium text-foreground">{editionByProject.get(c.project_id as string)}</span>
                    ) : null}
                    {c.is_backfill ? <span className="bg-secondary px-1.5 text-[11px] text-muted-foreground">History import</span> : <span className="bg-primary/10 px-1.5 text-[11px] text-primary">New find</span>}
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {[person, lab].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-[12px] text-foreground">{c.why_surfaced as string}</p>
                  {terms.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      AI relevance {Math.round(Number(c.ai_relevance) * 100)}% (triage aid): {terms.join(", ")}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
