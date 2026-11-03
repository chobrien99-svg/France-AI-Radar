import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { STATE_LABELS, TRANSITIONS, type State } from "@/lib/detection/review"
import { CandidateActions, SubjectDecisions, type Subject } from "@/components/admin/candidate-review"

type Row = Record<string, unknown>

const fmt = (iso: unknown, withTime = false) =>
  iso ? new Date(String(iso).length === 10 ? `${iso}T00:00:00Z` : String(iso)).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Paris",
  }) : null

const PAYLOAD_LABELS: Record<string, string> = {
  millesime: "Year", resultat: "Result", prenom_nom: "Laureate", acronyme_du_projet: "Project",
  laboratoire: "Lab", code_laboratoire: "Lab code (RNSR)", etablissement: "Institutions", secteur: "Sector",
  region: "Region", structure_de_transfert_de_technologie: "Tech transfer", incubateur: "Incubator",
  numero_national_de_these: "Thesis number", lien_vers_theses_fr: "theses.fr",
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const svc = await createServiceClient()

  const { data: c } = await svc.from("detection_candidates").select("*").eq("id", id).maybeSingle()
  if (!c) notFound()
  const cand = c as Row

  const [{ data: evidence }, { data: subjects }, { data: events }, { data: project }, { data: awards }, { data: org }, { data: mergedInto }] = await Promise.all([
    svc.from("candidate_evidence").select("id, evidence_family, created_at, source_records(id, title, url, payload, edition_year, event_date, published_at, first_seen_at, is_backfill, detection_sources(name, license))").eq("candidate_id", id).order("created_at"),
    svc.from("candidate_subjects").select("*").eq("candidate_id", id).order("created_at"),
    svc.from("candidate_events").select("*").eq("candidate_id", id).order("created_at"),
    cand.project_id ? svc.from("projects").select("*").eq("id", cand.project_id as string).maybeSingle() : Promise.resolve({ data: null }),
    cand.project_id ? svc.from("awards").select("*").eq("recipient_project_id", cand.project_id as string) : Promise.resolve({ data: [] }),
    cand.organization_id ? svc.from("organizations").select("name, slug").eq("id", cand.organization_id as string).maybeSingle() : Promise.resolve({ data: null }),
    cand.merged_into_id ? svc.from("detection_candidates").select("id, title").eq("id", cand.merged_into_id as string).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const actorIds = [...new Set(((events ?? []) as Row[]).map((e) => e.actor_id).filter(Boolean))] as string[]
  const { data: actors } = actorIds.length ? await svc.from("profiles").select("id, full_name, email").in("id", actorIds) : { data: [] }
  const actorName = new Map(((actors ?? []) as Row[]).map((a) => [a.id as string, (a.full_name as string) || (a.email as string)]))
  const state = cand.state as State
  const proj = project as Row | null

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[12px] text-muted-foreground"><Link href={`/admin/candidates?state=${state}`} className="hover:text-foreground">← Candidates</Link></p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-[24px] font-bold text-foreground">{cand.title as string}</h1>
        <span className="text-[12px] uppercase tracking-wide text-muted-foreground">{cand.kind === "project" ? "Pre-company project" : String(cand.kind)}</span>
        <span className="bg-secondary px-2 py-0.5 text-[12px] font-medium text-foreground">{STATE_LABELS[state]}</span>
        {cand.is_backfill ? <span className="text-[12px] text-muted-foreground">History import</span> : null}
      </div>
      <p className="mt-2 text-[13px] text-foreground">{cand.why_surfaced as string}</p>
      {org ? <p className="mt-1 text-[13px]">Company: <Link className="underline" href={`/startup/${(org as Row).slug}`}>{(org as Row).name as string}</Link></p> : null}
      {mergedInto ? <p className="mt-1 text-[13px]">Merged into <Link className="underline" href={`/admin/candidates/${(mergedInto as Row).id}`}>{(mergedInto as Row).title as string}</Link></p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Score label="AI relevance" value={cand.ai_relevance} hint={((cand.ai_terms ?? []) as string[]).join(", ") || "no terms"} />
        <Score label="Evidence confidence" value={cand.evidence_confidence} hint="How reliable the source is" />
        <Score label="Founding likelihood" value={cand.formation_likelihood} hint="Not assessed in Phase 1" />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Scores help sort the queue. They are not facts and decide nothing.</p>

      <Section title="Decision">
        <CandidateActions id={id} state={state} allowed={TRANSITIONS[state]} />
      </Section>

      {proj && (
        <Section title="Project">
          <p className="text-[13px] font-semibold text-foreground">{proj.name as string}{proj.sector ? <span className="font-normal text-muted-foreground"> · {proj.sector as string}</span> : null}</p>
          {proj.summary ? <p className="mt-1 whitespace-pre-line text-[13px] text-foreground">{proj.summary as string}</p> : null}
          <p className="mt-1 text-[12px] text-muted-foreground">Status: {String(proj.commercialization_status)}. Not incorporated according to this source unless a company is linked above.</p>
          {((awards ?? []) as Row[]).map((a) => (
            <p key={a.id as string} className="mt-2 text-[12px] text-foreground">
              Award: {a.title as string}{a.category ? ` — ${a.category}` : ""} ({a.award_type as string}{a.funder_name ? `, ${a.funder_name}` : ""}). Not an equity round.
            </p>
          ))}
        </Section>
      )}

      <Section title="People and organizations named">
        <SubjectDecisions candidateId={id} subjects={(subjects ?? []) as unknown as Subject[]} />
      </Section>

      <Section title="Evidence">
        <ul className="space-y-3">
          {((evidence ?? []) as Row[]).map((e) => {
            const r = (Array.isArray(e.source_records) ? e.source_records[0] : e.source_records) as Row
            const src = (Array.isArray(r?.detection_sources) ? r.detection_sources[0] : r?.detection_sources) as Row | null
            const payload = (r?.payload ?? {}) as Record<string, string>
            return (
              <li key={e.id as string} className="data-card p-3 text-[12px]">
                <p className="font-semibold text-foreground">{src?.name as string} {r?.url ? <a href={r.url as string} target="_blank" rel="noopener noreferrer" className="font-normal underline">original ↗</a> : null}</p>
                <p className="text-muted-foreground">
                  {r?.edition_year ? `Edition ${r.edition_year} · ` : ""}{r?.event_date ? `Event ${fmt(r.event_date)} · ` : ""}{r?.published_at ? `Published ${fmt(r.published_at)} · ` : ""}
                  First seen {fmt(r?.first_seen_at, true)}{r?.is_backfill ? " (history import)" : ""} · {src?.license as string}
                </p>
                <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5">
                  {Object.entries(PAYLOAD_LABELS).filter(([k]) => payload[k]).map(([k, label]) => (
                    <div key={k} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words text-foreground">{payload[k]}</dd></div>
                  ))}
                </dl>
                <p className="mt-1 text-[11px] text-muted-foreground">Evidence family: {e.evidence_family as string}</p>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="History">
        <ol className="space-y-1 text-[12px]">
          {((events ?? []) as Row[]).map((e) => (
            <li key={e.id as string}>
              <span className="text-muted-foreground">{fmt(e.created_at, true)} · {e.actor_id ? actorName.get(e.actor_id as string) ?? "an admin" : "system"}:</span>{" "}
              <span className="text-foreground">{describe(e)}</span>
              {e.note ? <span className="text-muted-foreground"> — {e.note as string}</span> : null}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

function describe(e: Row) {
  switch (e.action) {
    case "created": return "created"
    case "state_changed": return `${STATE_LABELS[e.from_state as State] ?? e.from_state} → ${STATE_LABELS[e.to_state as State] ?? e.to_state}`
    case "evidence_added": return "new evidence"
    case "subject_confirmed": return "match confirmed"
    case "subject_unmatched": return "marked not in our database"
    case "subject_rejected": return "name rejected"
    case "subject_proposed": return "match reopened"
    case "merge_received": return "another candidate merged in"
    case "note": return "note"
    default: return String(e.action)
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Score({ label, value, hint }: { label: string; value: unknown; hint: string }) {
  return (
    <div className="data-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[18px] font-semibold text-foreground">{value == null ? "—" : `${Math.round(Number(value) * 100)}%`}</p>
      <p className="truncate text-[11px] text-muted-foreground" title={hint}>{hint}</p>
    </div>
  )
}
