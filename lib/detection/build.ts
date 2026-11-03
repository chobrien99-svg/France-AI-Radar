// Turns one source record into (or onto) a private candidate.
//
// Writes only to the staff-only Early Detection tables: projects, awards,
// project_links, detection_candidates, candidate_evidence, candidate_subjects,
// candidate_events. It never creates organizations, people, signals or Radar
// listings: people and labs named by a source are stored as proposals with
// suggested matches, for an editor to confirm.
//
// Safe to repeat: everything is looked up before it is created, so a run that
// failed halfway can simply run again.
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CandidateDraft, SubjectDraft } from "@/lib/connectors/types"
import { RELEVANCE_THRESHOLD, scoreAiRelevance } from "@/lib/detection/relevance"

type Row = Record<string, unknown>

export type BuildContext = {
  /** Cache of program edition ids by "programSlug:year" (null when not found). */
  editions: Map<string, string | null>
}

export type BuildResult = "created" | "updated" | "not_relevant"

export type RecordRef = { id: string; isBackfill: boolean; firstSeenAt: string }

const ORG_TYPES: Record<SubjectDraft["role"], string[]> = {
  person: [],
  lab: ["research_lab", "university"],
  institution: ["university", "research_lab", "public_agency"],
  support: ["incubator", "accelerator", "public_agency", "university", "research_lab"],
  company: ["startup", "corporate"],
}

/** Suggestions below this similarity aren't shown. */
const MIN_MATCH_SCORE = 0.45

const slugPart = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

/** Same project slug every time for the same source item. */
export function projectSlug(draft: CandidateDraft) {
  const h = createHash("sha256").update(draft.sourceKey).digest("hex").slice(0, 8)
  return `${slugPart(draft.project?.name ?? draft.title) || "project"}-${h}`
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

export async function buildCandidate(
  svc: SupabaseClient,
  draft: CandidateDraft,
  record: RecordRef,
  ctx: BuildContext,
): Promise<BuildResult> {
  const relevance = scoreAiRelevance(draft.relevanceText)
  if (relevance.score < RELEVANCE_THRESHOLD) return "not_relevant"

  const existing = must(
    await svc.from("detection_candidates").select("id, state").eq("source_key", draft.sourceKey).maybeSingle(),
    "Candidate lookup",
  ) as Row | null

  if (existing) {
    const candidateId = existing.id as string
    const added = await addEvidence(svc, candidateId, record, draft)
    if (added) {
      // A change found outside history mode is news: the candidate leaves the
      // history import and moves up the queue (sorted by latest evidence).
      must(await svc.from("detection_candidates")
        .update({ last_evidence_at: record.firstSeenAt, ...(record.isBackfill ? {} : { is_backfill: false }) })
        .eq("id", candidateId), "Candidate update")
      must(await svc.from("candidate_events").insert({
        candidate_id: candidateId,
        action: "evidence_added",
        note: record.isBackfill
          ? "The source published a changed version of this item during the history import; both versions are kept."
          : "The source published a changed version of this item; both versions are kept. Now listed as a new find.",
        details: { source_record_id: record.id, is_backfill: record.isBackfill },
      }), "Audit trail")
    }
    // Finish a candidate whose first build stopped before its subjects were stored.
    await ensureSubjects(svc, candidateId, draft)
    return "updated"
  }

  // Project (private). Reused if an earlier, interrupted run created it.
  let projectId: string | null = null
  if (draft.project) {
    const slug = projectSlug(draft)
    const found = must(await svc.from("projects").select("id").eq("slug", slug).maybeSingle(), "Project lookup") as Row | null
    projectId = found
      ? (found.id as string)
      : (must(await svc.from("projects").insert({
          name: draft.project.name,
          slug,
          summary: draft.project.summary,
          sector: draft.project.sector,
          technical_focus: relevance.terms.slice(0, 8),
          commercialization_status: draft.project.commercializationStatus,
          first_evidence_date: draft.firstEvidenceDate,
        }).select("id").single(), "Project") as Row).id as string
  }

  const created = await svc.from("detection_candidates").insert({
    kind: draft.kind,
    source_key: draft.sourceKey,
    title: draft.title,
    summary: draft.summary,
    why_surfaced: `${draft.whySurfaced} AI terms: ${relevance.terms.slice(0, 6).join(", ")}.`,
    ai_relevance: relevance.score,
    ai_terms: relevance.terms,
    evidence_confidence: draft.evidenceConfidence,
    project_id: projectId,
    is_backfill: record.isBackfill,
    first_evidence_date: draft.firstEvidenceDate,
    last_evidence_at: record.firstSeenAt,
  }).select("id").single()
  if (created.error) {
    // Another run created it at the same moment: treat as an update.
    if (/duplicate|unique/i.test(created.error.message)) return buildCandidate(svc, draft, record, ctx)
    throw new Error(`Candidate: ${created.error.message}`)
  }
  const candidateId = (created.data as Row).id as string

  must(await svc.from("candidate_events").insert({
    candidate_id: candidateId,
    action: "created",
    to_state: "new",
    note: record.isBackfill ? "Found while importing the source's history." : "Found in a new item from the source.",
    details: { source_record_id: record.id, ai_relevance: relevance.score, ai_terms: relevance.terms },
  }), "Audit trail")

  await addEvidence(svc, candidateId, record, draft)

  if (draft.award && projectId) {
    const editionId = await findEdition(svc, ctx, draft.award.programSlug, draft.award.editionYear)
    const hasAward = must(await svc.from("awards").select("id").eq("recipient_project_id", projectId).eq("program_name", draft.award.programName).maybeSingle(), "Award lookup")
    if (!hasAward) {
      must(await svc.from("awards").insert({
        award_type: draft.award.awardType,
        title: draft.award.title,
        program_name: draft.award.programName,
        program_edition_id: editionId,
        category: draft.award.category,
        edition_year: draft.award.editionYear,
        award_date: draft.award.awardDate,
        recipient_project_id: projectId,
        funder_name: draft.award.funderName,
        source_record_id: record.id,
      }), "Award")
    }
    if (editionId) {
      const linked = must(await svc.from("project_links").select("id").eq("project_id", projectId).eq("program_edition_id", editionId).maybeSingle(), "Link lookup")
      if (!linked) {
        must(await svc.from("project_links").insert({
          project_id: projectId, program_edition_id: editionId, role: "laureate", status: "proposed", source_record_id: record.id,
        }), "Program link")
      }
    }
  }

  await ensureSubjects(svc, candidateId, draft)

  return "created"
}

async function addEvidence(svc: SupabaseClient, candidateId: string, record: RecordRef, draft: CandidateDraft): Promise<boolean> {
  const res = await svc.from("candidate_evidence")
    .upsert({ candidate_id: candidateId, source_record_id: record.id, evidence_family: draft.evidenceFamily },
      { onConflict: "candidate_id,source_record_id", ignoreDuplicates: true })
    .select("id")
  if (res.error) throw new Error(`Evidence: ${res.error.message}`)
  return (res.data ?? []).length > 0
}

async function ensureSubjects(svc: SupabaseClient, candidateId: string, draft: CandidateDraft) {
  const have = must(await svc.from("candidate_subjects").select("id").eq("candidate_id", candidateId).limit(1), "Subjects lookup") as Row[]
  if (have.length > 0 || draft.subjects.length === 0) return
  const rows = []
  for (const s of draft.subjects) {
    rows.push({
      candidate_id: candidateId,
      role: s.role,
      proposed_name: s.name,
      proposed_affiliation: s.affiliation,
      identifiers: s.identifiers,
      match_options: await matchOptions(svc, s),
      status: "proposed",
    })
  }
  must(await svc.from("candidate_subjects").insert(rows), "Subjects")
}

/** Suggested existing records for a named person or organization. Never fails the build. */
export async function matchOptions(svc: SupabaseClient, s: SubjectDraft) {
  try {
    if (s.role === "person") {
      const { data, error } = await svc.rpc("detection_match_people", { p_name: s.name, p_limit: 5 })
      if (error) return []
      return ((data ?? []) as Row[])
        .filter((r) => Number(r.score) >= MIN_MATCH_SCORE)
        .map((r) => ({ id: r.id, kind: "person", name: r.full_name, slug: r.slug, score: Math.round(Number(r.score) * 100) / 100, basis: "name similarity" }))
    }
    const { data, error } = await svc.rpc("detection_match_organizations", { p_name: s.name, p_types: ORG_TYPES[s.role], p_limit: 5 })
    if (error) return []
    return ((data ?? []) as Row[])
      .filter((r) => Number(r.score) >= MIN_MATCH_SCORE)
      .map((r) => ({ id: r.id, kind: "organization", name: r.name, slug: r.slug, type: r.organization_type, score: Math.round(Number(r.score) * 100) / 100, basis: "name similarity" }))
  } catch {
    return []
  }
}

async function findEdition(svc: SupabaseClient, ctx: BuildContext, programSlug: string | null, year: number | null) {
  if (!programSlug || !year) return null
  const key = `${programSlug}:${year}`
  if (ctx.editions.has(key)) return ctx.editions.get(key)!
  let id: string | null = null
  const program = (await svc.from("programs").select("id").eq("slug", programSlug).maybeSingle()).data as Row | null
  if (program) {
    const edition = (await svc.from("program_editions").select("id").eq("program_id", program.id as string).eq("year", year).maybeSingle()).data as Row | null
    id = (edition?.id as string) ?? null
  }
  ctx.editions.set(key, id)
  return id
}
