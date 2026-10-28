// ------------------------------------------------------------------
// Ranking the companies to vet (company_leads), run nightly and from
// the "Check now" button on Admin › To vet:
//   1. Free first check: each new company is looked up in the government
//      directory and scored (lib/leads/parse.ts).
//   2. Web research: the best-scored ones not yet researched get a web
//      search by Claude, at most LEAD_RESEARCH_PER_DAY a day (default 10).
// How it works: docs/signal-monitoring.md ("Companies to vet").
// ------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchDirectory } from "@/lib/leads/directory"
import { scoreLead, type DirectoryFacts } from "@/lib/leads/parse"
import { researchAdjustment, researchCompany, type Research } from "@/lib/leads/research"

type Lead = {
  siren: string
  name: string | null
  status: string
  first_seen_at: string
  checked_at: string | null
  naf_code: string | null
  directors: unknown
  legal_form: string | null
  created_on: string | null
  city: string | null
  employer: boolean | null
  score: number | null
  score_reasons: string[] | null
  research: (Research & { error?: undefined }) | { error: string } | null
  researched_at: string | null
}

/** Directory lookups per run (the directory allows about 7 a second). */
const MAX_CHECKS = 100
/** Only companies at least this promising are researched. */
const MIN_SCORE_FOR_RESEARCH = 40
/** Research calls running at once. */
const PARALLEL = 4
const DAY = 86_400_000

export function researchPerDay(): number {
  const n = Number(process.env.LEAD_RESEARCH_PER_DAY)
  return Number.isFinite(n) && n >= 0 && process.env.LEAD_RESEARCH_PER_DAY?.trim() ? Math.floor(n) : 10
}

export type VetSummary = { checked: number; researched: number; errors: string[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function factsFromRow(l: Lead): DirectoryFacts | null {
  if (!l.checked_at) return null
  return {
    name: l.name,
    nafCode: l.naf_code,
    nafLabel: null,
    legalForm: l.legal_form,
    createdOn: l.created_on,
    city: l.city,
    employer: l.employer,
    directors: Array.isArray(l.directors) ? (l.directors as DirectoryFacts["directors"]) : [],
    closed: false,
  }
}

/** Is this lead due a (re)check? Companies too new for the directory are retried every 3 days for 3 weeks. */
function needsCheck(l: Lead, now: number): boolean {
  if (!l.checked_at) return true
  return !l.naf_code && now - Date.parse(l.checked_at) > 3 * DAY && now - Date.parse(l.first_seen_at) < 21 * DAY
}

export async function vetLeads(svc: SupabaseClient, opts: { deadline: number; sirens?: string[] }): Promise<VetSummary> {
  const summary: VetSummary = { checked: 0, researched: 0, errors: [] }
  const note = (m: string) => { if (summary.errors.length < 50) summary.errors.push(m) }
  const now = Date.now()

  let query = svc.from("company_leads").select("*").eq("status", "new")
  if (opts.sirens) query = query.in("siren", opts.sirens)
  const { data, error } = await query.order("first_seen_at", { ascending: false }).limit(500)
  if (error) {
    note(`companies to vet: ${error.message}`)
    return summary
  }
  const leads = (data ?? []) as Lead[]

  // 1. Free first check.
  for (const lead of leads.filter((l) => needsCheck(l, now)).slice(0, MAX_CHECKS)) {
    if (Date.now() > opts.deadline) break
    let facts: DirectoryFacts | null
    try {
      facts = await fetchDirectory(lead.siren)
    } catch (err) {
      note(`${lead.name ?? lead.siren}: ${err instanceof Error ? err.message : "directory lookup failed"}`)
      if (err instanceof Error && /429/.test(err.message)) break
      continue
    }
    const base = scoreLead(lead.name, facts)
    const reasons = facts ? base.reasons : [...base.reasons, "not in the government directory yet (registered in the last days)"]
    const adjust = lead.research && !("error" in lead.research && lead.research.error) ? researchAdjustment(lead.research as Research) : null
    const update = {
      name: lead.name ?? facts?.name ?? null,
      naf_code: facts?.nafCode ?? null,
      naf_label: facts?.nafLabel ?? null,
      legal_form: facts?.legalForm ?? null,
      created_on: facts?.createdOn ?? null,
      city: facts?.city ?? null,
      employer: facts?.employer ?? null,
      directors: facts?.directors ?? [],
      score: Math.max(0, Math.min(100, base.score + (adjust?.points ?? 0))),
      score_reasons: adjust ? [...reasons, adjust.reason] : reasons,
      checked_at: new Date().toISOString(),
    }
    const { error: upErr } = await svc.from("company_leads").update(update).eq("siren", lead.siren)
    if (upErr) note(`${lead.siren}: could not save the check: ${upErr.message}`)
    else {
      Object.assign(lead, update)
      summary.checked++
    }
    await sleep(150)
  }

  // 2. Web research on the most promising, within today's allowance.
  const perDay = researchPerDay()
  if (perDay === 0 || !process.env.ANTHROPIC_API_KEY) return summary
  const since = new Date(now - (now % DAY)).toISOString()   // start of today, UTC
  const { data: today } = await svc.from("company_leads").select("siren, researched_at").gte("researched_at", since)
  let allowance = perDay - (today ?? []).length
  const queue = leads
    .filter((l) => l.checked_at && !l.researched_at && (l.score ?? 0) >= MIN_SCORE_FOR_RESEARCH)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.first_seen_at.localeCompare(a.first_seen_at))

  const worker = async () => {
    while (queue.length && allowance > 0 && Date.now() < opts.deadline) {
      const lead = queue.shift()!
      allowance--
      await researchOne(svc, lead, summary, note)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  return summary
}

async function researchOne(svc: SupabaseClient, lead: Lead, summary: VetSummary, note: (m: string) => void) {
  const result = await researchCompany(lead.siren, lead.name ?? lead.siren, factsFromRow(lead))
  const researchedAt = new Date().toISOString()
  if ("error" in result) {
    // Recorded (and counted against today's allowance) so a failing company isn't retried every night.
    note(`${lead.name ?? lead.siren}: research failed: ${result.error}`)
    await svc.from("company_leads").update({ research: { error: result.error }, researched_at: researchedAt }).eq("siren", lead.siren)
    return
  }
  const adjust = researchAdjustment(result)
  const reasons = (lead.score_reasons ?? []).filter((r) => !r.includes("web research:"))
  const baseScore = (lead.score ?? 50) - (lead.score_reasons ?? []).filter((r) => r.includes("web research:")).reduce((n, r) => n + parseInt(r, 10), 0)
  const { error } = await svc.from("company_leads").update({
    research: result,
    researched_at: researchedAt,
    score: Math.max(0, Math.min(100, baseScore + (adjust?.points ?? 0))),
    score_reasons: adjust ? [...reasons, adjust.reason] : reasons,
  }).eq("siren", lead.siren)
  if (error) note(`${lead.siren}: could not save the research: ${error.message}`)
  else summary.researched++
}

/** "Research now" on one company, outside the daily allowance. */
export async function researchLeadNow(svc: SupabaseClient, siren: string): Promise<VetSummary> {
  const summary: VetSummary = { checked: 0, researched: 0, errors: [] }
  const { data } = await svc.from("company_leads").select("*").eq("siren", siren).maybeSingle()
  if (!data) return { ...summary, errors: ["Not found"] }
  await researchOne(svc, data as Lead, summary, (m) => summary.errors.push(m))
  return summary
}
