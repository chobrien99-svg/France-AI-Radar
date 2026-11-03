// Editor actions on candidates. Every action is checked here (allowed state
// moves, required links) and written to the audit trail (candidate_events).
// Phase 1 publishes nothing: "Approved" records an editorial decision only.
import type { SupabaseClient } from "@supabase/supabase-js"

type Row = Record<string, unknown>

export const STATES = ["new", "under_review", "watching", "approved_signal", "verified_company", "rejected", "merged"] as const
export type State = (typeof STATES)[number]

export const STATE_LABELS: Record<State, string> = {
  new: "New",
  under_review: "Under review",
  watching: "Watching",
  approved_signal: "Approved (not published)",
  verified_company: "Company verified",
  rejected: "Rejected",
  merged: "Merged",
}

/** Where a candidate can go from each state. */
export const TRANSITIONS: Record<State, State[]> = {
  new: ["under_review", "watching", "rejected", "merged"],
  under_review: ["watching", "approved_signal", "verified_company", "rejected", "merged", "new"],
  watching: ["under_review", "approved_signal", "verified_company", "rejected", "merged"],
  approved_signal: ["under_review", "watching", "verified_company"],
  verified_company: ["under_review"],
  rejected: ["under_review"],
  merged: ["under_review"],
}

export class ReviewError extends Error {}

/** Organization types that count as a company for "Company verified". */
export const COMPANY_TYPES = ["startup", "corporate"]

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function loadCandidate(svc: SupabaseClient, id: string) {
  const c = must(await svc.from("detection_candidates").select("id, state, project_id, organization_id, title").eq("id", id).maybeSingle(), "Candidate") as Row | null
  if (!c) throw new ReviewError("Candidate not found")
  return c
}

async function log(svc: SupabaseClient, e: { candidate_id: string; actor_id: string; action: string; from_state?: string | null; to_state?: string | null; note?: string | null; details?: Row }) {
  must(await svc.from("candidate_events").insert({ details: {}, ...e }), "Audit trail")
}

export async function changeState(
  svc: SupabaseClient,
  candidateId: string,
  to: string,
  actorId: string,
  opts: { note?: string | null; organizationSlug?: string | null; mergeIntoId?: string | null } = {},
) {
  if (!STATES.includes(to as State)) throw new ReviewError("Unknown state")
  const c = await loadCandidate(svc, candidateId)
  const from = c.state as State
  if (!TRANSITIONS[from].includes(to as State)) throw new ReviewError(`Can't move from ${STATE_LABELS[from]} to ${STATE_LABELS[to as State]}`)

  const now = new Date().toISOString()
  const update: Row = { state: to, reviewed_by: actorId, reviewed_at: now }
  const details: Row = {}

  const project = c.project_id
    ? must(await svc.from("projects").select("id, organization_id, commercialization_status").eq("id", c.project_id as string).maybeSingle(), "Project") as Row | null
    : null

  if (to === "verified_company") {
    const slug = opts.organizationSlug?.trim()
    if (!slug) throw new ReviewError("Give the slug of the company on the Radar or in the Navigator")
    const org = must(await svc.from("organizations").select("id, name, organization_type").eq("slug", slug).maybeSingle(), "Company lookup") as Row | null
    if (!org) throw new ReviewError(`No organization with slug "${slug}"`)
    if (!COMPANY_TYPES.includes(String(org.organization_type))) {
      throw new ReviewError(`"${org.name}" is recorded as ${String(org.organization_type).replace("_", " ")}, not a company. Give the slug of a startup or corporate.`)
    }
    update.organization_id = org.id
    details.organization = { id: org.id, name: org.name, slug }
    // The project keeps all its pre-company evidence; it now points at the company.
    // Its previous status is kept in the history so leaving this state can restore it.
    if (project) {
      details.previous_commercialization_status = project.commercialization_status
      must(await svc.from("projects").update({ organization_id: org.id, commercialization_status: "incorporated" }).eq("id", project.id as string), "Project link")
    }
  }

  // Leaving "Company verified" (e.g. the company was wrong) undoes the company link.
  if (from === "verified_company" && to !== "verified_company") {
    update.organization_id = null
    details.company_unlinked = { organization_id: c.organization_id ?? null }
    if (project && (!c.organization_id || project.organization_id === c.organization_id)) {
      const entered = (must(await svc.from("candidate_events").select("details, created_at")
        .eq("candidate_id", candidateId).eq("action", "state_changed").eq("to_state", "verified_company")
        .order("created_at", { ascending: false }).limit(1), "History lookup") as Row[])[0]
      const restored = ((entered?.details ?? {}) as Row).previous_commercialization_status as string | undefined
        ?? ((must(await svc.from("awards").select("id").eq("recipient_project_id", project.id as string).limit(1), "Award lookup") as Row[]).length ? "awarded" : "unknown")
      must(await svc.from("projects").update({ organization_id: null, commercialization_status: restored }).eq("id", project.id as string), "Project unlink")
      details.project_status_restored = restored
    }
  }

  if (to === "merged") {
    const into = opts.mergeIntoId?.trim()
    if (!into || into === candidateId) throw new ReviewError("Choose another candidate to merge into")
    const target = must(await svc.from("detection_candidates").select("id, state, title").eq("id", into).maybeSingle(), "Merge target") as Row | null
    if (!target) throw new ReviewError("The candidate to merge into wasn't found")
    if (target.state === "merged") throw new ReviewError("That candidate is itself merged; merge into the one it points to")
    update.merged_into_id = into
    details.merged_into = { id: into, title: target.title }
    await log(svc, { candidate_id: into, actor_id: actorId, action: "merge_received", note: `"${c.title}" was merged into this candidate.`, details: { from_candidate_id: candidateId } })
  }

  if (from === "merged" && to !== "merged") update.merged_into_id = null

  must(await svc.from("detection_candidates").update(update).eq("id", candidateId), "Candidate update")
  await log(svc, { candidate_id: candidateId, actor_id: actorId, action: "state_changed", from_state: from, to_state: to, note: opts.note ?? null, details })
  return { from, to }
}

export async function addNote(svc: SupabaseClient, candidateId: string, actorId: string, note: string) {
  const text = note.trim()
  if (!text) throw new ReviewError("The note is empty")
  await loadCandidate(svc, candidateId)
  await log(svc, { candidate_id: candidateId, actor_id: actorId, action: "note", note: text.slice(0, 4000) })
}

/**
 * Identity decision on a person, lab or institution named by a source.
 *   confirm   → links to the chosen existing record (from the suggestions)
 *   unmatched → not in our database yet; stays private on the candidate
 *   reject    → the name was misread or isn't relevant
 *   reopen    → back to proposed
 * Confirming writes only private links (project_links, external_identities).
 *
 * Undoing or changing a confirmation releases what it created: the project
 * link and the identifiers (thesis number, RNSR code…) it marked verified
 * against the previous record are downgraded, to "rejected" when the match
 * was wrong (changed, unmatched, rejected) or back to "proposed" on reopen.
 * Anything another confirmed match still backs is left as it is.
 */
export async function decideSubject(
  svc: SupabaseClient,
  subjectId: string,
  decision: string,
  actorId: string,
  optionId?: string | null,
) {
  const s = must(await svc.from("candidate_subjects").select("*").eq("id", subjectId).maybeSingle(), "Subject") as Row | null
  if (!s) throw new ReviewError("Subject not found")
  const candidate = await loadCandidate(svc, s.candidate_id as string)
  const isPerson = s.role === "person"

  // Check the request before changing anything.
  let option: Row | undefined
  if (decision === "confirm") {
    const options = (Array.isArray(s.match_options) ? s.match_options : []) as Row[]
    option = options.find((o) => o.id === optionId)
    if (!option) throw new ReviewError("Pick one of the suggested matches")
  }
  const status = decision === "confirm" ? "confirmed" : ({ unmatched: "unmatched", reject: "rejected", reopen: "proposed" } as Record<string, string>)[decision]
  if (!status) throw new ReviewError("Unknown decision")

  const now = new Date().toISOString()
  const base = { reviewed_by: actorId, reviewed_at: now }

  // Release the previous confirmation, unless it is being confirmed again as is.
  const previous = (s.matched_person_id ?? s.matched_organization_id) as string | null
  let released: Row | null = null
  if (previous && !(option && option.id === previous)) {
    released = await releaseMatch(svc, s, candidate, previous, isPerson, decision === "reopen" ? "proposed" : "rejected")
  }

  if (option) {
    must(await svc.from("candidate_subjects").update({
      ...base,
      status,
      matched_person_id: isPerson ? option.id : null,
      matched_organization_id: isPerson ? null : option.id,
    }).eq("id", subjectId), "Subject update")

    if (candidate.project_id) {
      const link: Row = { project_id: candidate.project_id, role: isPerson ? "laureate" : s.role, status: "verified" }
      link[isPerson ? "person_id" : "organization_id"] = option.id
      const existing = must(await svc.from("project_links").select("id").eq("project_id", candidate.project_id as string)
        .eq(isPerson ? "person_id" : "organization_id", option.id as string).maybeSingle(), "Link lookup")
      if (!existing) must(await svc.from("project_links").insert(link), "Project link")
    }
    for (const [scheme, value] of Object.entries((s.identifiers ?? {}) as Record<string, string>)) {
      if (!value) continue
      // Not "skip if present": a row downgraded by an earlier correction must become verified again.
      must(await svc.from("external_identities").upsert(
        { entity_type: isPerson ? "person" : "organization", entity_id: option.id, scheme, value, status: "verified" },
        { onConflict: "scheme,value,entity_type,entity_id" },
      ), "Identifier")
    }
    await log(svc, {
      candidate_id: s.candidate_id as string, actor_id: actorId, action: "subject_confirmed",
      note: `${s.proposed_name} → ${option.name}`, details: { subject_id: subjectId, matched: option, ...(released ? { released } : {}) },
    })
    return
  }

  must(await svc.from("candidate_subjects").update({ ...base, status, matched_person_id: null, matched_organization_id: null }).eq("id", subjectId), "Subject update")
  await log(svc, {
    candidate_id: s.candidate_id as string, actor_id: actorId, action: `subject_${status}`,
    note: s.proposed_name as string, details: { subject_id: subjectId, ...(released ? { released } : {}) },
  })
}

/**
 * Undoes what confirming `subject` against `previousId` created, except where
 * another confirmed match still backs it. Returns what was done, for the audit trail.
 */
export async function releaseMatch(
  svc: SupabaseClient,
  subject: Row,
  candidate: Row,
  previousId: string,
  isPerson: boolean,
  downgradeTo: "rejected" | "proposed" | ((scheme: string, value: string) => "rejected" | "proposed"),
) {
  const column = isPerson ? "matched_person_id" : "matched_organization_id"
  const others = ((must(await svc.from("candidate_subjects").select("id, candidate_id, identifiers")
    .eq(column, previousId).eq("status", "confirmed"), "Other matches") ?? []) as Row[])
    .filter((o) => o.id !== subject.id)

  let linkRemoved = false
  if (candidate.project_id && !others.some((o) => o.candidate_id === subject.candidate_id)) {
    must(await svc.from("project_links").delete().eq("project_id", candidate.project_id as string)
      .eq(isPerson ? "person_id" : "organization_id", previousId), "Previous link")
    linkRemoved = true
  }

  const downgraded: string[] = []
  const kept: string[] = []
  for (const [scheme, value] of Object.entries((subject.identifiers ?? {}) as Record<string, string>)) {
    if (!value) continue
    const stillBacked = others.some((o) => ((o.identifiers ?? {}) as Record<string, string>)[scheme] === value)
    if (stillBacked) { kept.push(`${scheme}:${value}`); continue }
    const status = typeof downgradeTo === "function" ? downgradeTo(scheme, value) : downgradeTo
    must(await svc.from("external_identities").update({ status })
      .eq("entity_type", isPerson ? "person" : "organization").eq("entity_id", previousId)
      .eq("scheme", scheme).eq("value", value).eq("status", "verified"), "Identifier downgrade")
    downgraded.push(`${scheme}:${value}→${status}`)
  }
  return { previous_id: previousId, link_removed: linkRemoved, identifiers_downgraded: downgraded, identifiers_kept: kept }
}

// ------------------------------------------------------------------
// What an editor finds out about a pre-company project: the brand it uses,
// its website, its LinkedIn page. Stored on the (private) project.
// ------------------------------------------------------------------

export type ProjectDetails = { brand_name: string | null; website_url: string | null; linkedin_url: string | null }

/** "izena.fr" → "https://izena.fr/". Null for empty; throws ReviewError if it isn't a web address. */
export function normalizeWebsite(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : ""
  if (!raw) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new ReviewError(`"${raw}" isn't a web address`)
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || /\s/.test(raw)) {
    throw new ReviewError(`"${raw}" isn't a web address`)
  }
  return url.toString()
}

/** Any LinkedIn page, always https. Throws ReviewError for anything else. */
export function normalizeLinkedIn(input: unknown): string | null {
  const url = normalizeWebsite(input)
  if (!url) return null
  const u = new URL(url)
  if (!/(^|\.)linkedin\.com$/.test(u.hostname) || u.pathname === "/") {
    throw new ReviewError("Give the address of a LinkedIn page, e.g. https://www.linkedin.com/company/…")
  }
  u.protocol = "https:"
  return u.toString()
}

export async function updateProjectDetails(svc: SupabaseClient, candidateId: string, actorId: string, input: Record<string, unknown>) {
  const c = await loadCandidate(svc, candidateId)
  if (!c.project_id) throw new ReviewError("This candidate has no project to describe")

  const next: Partial<ProjectDetails> = {}
  if ("brand_name" in input) {
    const brand = typeof input.brand_name === "string" ? input.brand_name.trim().replace(/\s+/g, " ") : ""
    if (brand.length > 200) throw new ReviewError("The brand name is too long (200 characters at most)")
    next.brand_name = brand || null
  }
  if ("website_url" in input) next.website_url = normalizeWebsite(input.website_url)
  if ("linkedin_url" in input) next.linkedin_url = normalizeLinkedIn(input.linkedin_url)
  if (Object.keys(next).length === 0) throw new ReviewError("Nothing to save")

  const project = must(await svc.from("projects").select("id, brand_name, website_url, linkedin_url").eq("id", c.project_id as string).maybeSingle(), "Project") as Row | null
  if (!project) throw new ReviewError("Project not found")
  const changed = (Object.keys(next) as (keyof ProjectDetails)[]).filter((k) => (project[k] ?? null) !== next[k])
  if (changed.length === 0) return { changed: [] as string[] }
  const before = Object.fromEntries(changed.map((k) => [k, project[k] ?? null]))   // captured before the update

  must(await svc.from("projects").update(next).eq("id", project.id as string), "Project update")
  await log(svc, {
    candidate_id: candidateId, actor_id: actorId, action: "details_updated",
    note: changed.map((k) => `${k === "brand_name" ? "brand" : k === "website_url" ? "website" : "LinkedIn"}: ${next[k] ?? "removed"}`).join(" · "),
    details: { before, after: Object.fromEntries(changed.map((k) => [k, next[k]])) },
  })
  return { changed }
}
