// The Enterprise API's only database reader. It loads the published Radar
// dataset with the server-side service client and applies the publication
// rule in one place:
//
//   a company is published  = linked to the "ai-radar" product AND status 'active'
//   a funding round is shown = publish_status 'published'
//   a programme is shown     = membership and edition not marked 'private'
//   a signal is shown        = belongs to a published company (signals are
//                              stored only after an editor approves them)
//
// The dataset is small (tens of companies), so it is loaded whole and kept
// for 60 seconds per server instance; filters run in lib/api/query.ts.
import type { SupabaseClient } from "@supabase/supabase-js"
import { childrenIndex } from "@/lib/taxonomy"
import { loadTechnicalIndex } from "@/lib/technical-profile"
import { loadRoundInvestors } from "@/lib/investors"
import type { CompanyRecord, Dataset, Place, RoundRecord, SignalRecord } from "@/lib/api/model"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null
const num = (v: unknown) => (v == null || v === "" ? null : Number(v))
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

const TTL_MS = 60_000
let cache: { at: number; promise: Promise<Dataset> } | null = null

export function loadDataset(svc: SupabaseClient): Promise<Dataset> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise
  const promise = fetchDataset(svc)
  cache = { at: Date.now(), promise }
  promise.catch(() => { if (cache?.promise === promise) cache = null })
  return promise
}

async function must<T>(label: string, q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  return (data ?? []) as T
}

/** Every row of a query, 1,000 at a time (Supabase caps a response at 1,000 rows). */
async function all(label: string, build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const rows = await must<Row[]>(label, build(from, from + 999))
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

const latestOf = (a: string, b: string | undefined) => (b && Date.parse(b) > Date.parse(a) ? b : a)

function place(v: unknown): Place | null {
  const c = one(v as Row | Row[] | null)
  return c && str(c.name) ? { name: c.name as string, slug: str(c.slug), region: str(c.region) } : null
}

async function fetchDataset(svc: SupabaseClient): Promise<Dataset> {
  const radarRows = await must<Row[]>(
    "product_organizations",
    svc.from("product_organizations").select("organization_id, product_catalog!inner(slug)").eq("product_catalog.slug", "ai-radar"),
  )
  const radarIds = [...new Set(radarRows.map((r) => r.organization_id as string))]
  const ids = radarIds.length ? radarIds : ["00000000-0000-0000-0000-000000000000"]

  const orgRows = await must<Row[]>(
    "organizations",
    svc
      .from("organizations")
      .select(
        "id, name, slug, short_description, description, website, linkedin_url, twitter_url, logo_url, country, founded_year, is_stealth, employee_range, last_round, signal_count, last_signal_date, first_seen_at, created_at, updated_at, city:cities!organizations_city_id_fkey(name, slug, region), secondary_city:cities!organizations_secondary_city_id_fkey(name, slug, region)",
      )
      .in("id", ids)
      .eq("status", "active"),
  )
  const pubIds = orgRows.map((o) => o.id as string)
  const pub = pubIds.length ? pubIds : ["00000000-0000-0000-0000-000000000000"]

  const [sectorRows, founderRows, roundRows, programRows, signalRows, techIndex, techLayerTimes, techTermTimes] = await Promise.all([
    must<Row[]>("organization_sectors", svc.from("organization_sectors").select("organization_id, is_primary, created_at, sectors(slug, name)").in("organization_id", pub)),
    must<Row[]>(
      "organization_people",
      svc.from("organization_people").select("organization_id, role, updated_at, people(id, full_name, slug, linkedin_url, short_bio, updated_at)").in("organization_id", pub).eq("is_founder", true),
    ),
    all("funding_rounds", (from, to) =>
      svc
        .from("funding_rounds")
        .select("id, organization_id, stage, amount_eur, amount_original, currency_original, announced_date, closed_date, is_estimated, source_name, source_url, press_release_url, ftj_url, updated_at")
        .in("organization_id", pub)
        .eq("publish_status", "published")
        .order("id")
        .range(from, to),
    ),
    must<Row[]>(
      "program_organizations",
      svc
        .from("program_organizations")
        .select("organization_id, membership_role, verification_status, updated_at, program_editions(name, slug, year, cohort_label, verification_status, programs(name, slug, verification_status))")
        .in("organization_id", pub),
    ),
    all("signals", (from, to) =>
      svc
        .from("signals")
        .select("id, organization_id, signal_type, signal_date, strength, title, description, source_name, source_url, verification_status, created_at, updated_at")
        .in("organization_id", pub)
        .order("id")
        .range(from, to),
    ),
    loadTechnicalIndex(svc, pub),
    // Only for change times: the technical index above doesn't carry them.
    must<Row[]>("organization_technical_layers", svc.from("organization_technical_layers").select("organization_id, updated_at").in("organization_id", pub)),
    must<Row[]>("organization_technical_terms", svc.from("organization_technical_terms").select("organization_id, updated_at").in("organization_id", pub)),
  ])
  const roundIds = roundRows.map((r) => r.id as string)
  const [investorsByRound, investorTimes] = await Promise.all([
    loadRoundInvestors(svc, roundIds),
    roundIds.length ? must<Row[]>("funding_round_investors", svc.from("funding_round_investors").select("funding_round_id, created_at").in("funding_round_id", roundIds)) : Promise.resolve([] as Row[]),
  ])

  // A company counts as updated when anything in its public record changes,
  // not only its organizations row (a new round, founder, sector, term…).
  // Removals leave no timestamp; the Stage 2 change feed reports those.
  const touched = new Map<string, string>()
  const touch = (orgId: unknown, ...times: unknown[]) => {
    for (const t of times) {
      if (typeof t !== "string" || !t) continue
      const prev = touched.get(orgId as string)
      if (!prev || Date.parse(t) > Date.parse(prev)) touched.set(orgId as string, t)
    }
  }
  const orgOfRound = new Map(roundRows.map((r) => [r.id as string, r.organization_id as string]))
  for (const r of sectorRows) touch(r.organization_id, r.created_at)
  for (const r of founderRows) touch(r.organization_id, r.updated_at, one(r.people as Row | Row[] | null)?.updated_at)
  for (const r of roundRows) touch(r.organization_id, r.updated_at)
  for (const r of investorTimes) touch(orgOfRound.get(r.funding_round_id as string), r.created_at)
  for (const r of programRows) touch(r.organization_id, r.updated_at)
  for (const r of [...techLayerTimes, ...techTermTimes]) touch(r.organization_id, r.updated_at)
  for (const r of signalRows) touch(r.organization_id, r.updated_at, r.created_at)

  const group = <T,>(rows: Row[], map: (r: Row) => T | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows) {
      const v = map(r)
      if (v != null) m.set(r.organization_id as string, [...(m.get(r.organization_id as string) ?? []), v])
    }
    return m
  }

  const sectors = group(sectorRows, (r) => {
    const s = one(r.sectors as Row | Row[] | null)
    return s && str(s.slug) ? { slug: s.slug as string, name: s.name as string, isPrimary: !!r.is_primary } : null
  })
  const founders = group(founderRows, (r) => {
    const p = one(r.people as Row | Row[] | null)
    return p ? { id: p.id as string, name: p.full_name as string, slug: str(p.slug), role: str(r.role), linkedinUrl: str(p.linkedin_url), shortBio: str(p.short_bio) } : null
  })
  const rounds = group<RoundRecord>(roundRows, (r) => ({
    id: r.id as string,
    stage: str(r.stage),
    amountEurMillions: num(r.amount_eur),
    amountOriginal: num(r.amount_original),
    currencyOriginal: str(r.currency_original),
    announcedDate: str(r.announced_date),
    closedDate: str(r.closed_date),
    isEstimated: !!r.is_estimated,
    sourceName: str(r.source_name),
    sourceUrl: str(r.source_url),
    pressReleaseUrl: str(r.press_release_url),
    ftjUrl: str(r.ftj_url),
    investors: (investorsByRound[r.id as string] ?? []).map((i) => ({ name: i.name, isLead: i.is_lead })),
  }))
  const programs = group(programRows, (r) => {
    const ed = one(r.program_editions as Row | Row[] | null)
    const prog = ed ? one(ed.programs as Row | Row[] | null) : null
    const isPrivate = [r.verification_status, ed?.verification_status, prog?.verification_status].includes("private")
    if (!ed || !prog || isPrivate) return null
    return { program: prog.name as string, programSlug: str(prog.slug), edition: str(ed.cohort_label) ?? str(ed.name), editionSlug: str(ed.slug), year: num(ed.year), role: str(r.membership_role) }
  })

  const companies: CompanyRecord[] = orgRows.map((o) => {
    const id = o.id as string
    const tc = techIndex.byOrg.get(id)
    const roundList = (rounds.get(id) ?? []).sort((a, b) => (b.announcedDate ?? "").localeCompare(a.announcedDate ?? ""))
    const sectorList = (sectors.get(id) ?? []).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name))
    return {
      id,
      slug: o.slug as string,
      name: o.name as string,
      shortDescription: str(o.short_description),
      description: str(o.description),
      website: str(o.website),
      linkedinUrl: str(o.linkedin_url),
      twitterUrl: str(o.twitter_url),
      logoUrl: str(o.logo_url),
      country: str(o.country),
      city: place(o.city),
      secondaryCity: place(o.secondary_city),
      foundedYear: num(o.founded_year),
      isStealth: !!o.is_stealth,
      employeeRange: str(o.employee_range),
      lastRound: str(o.last_round),
      // Summed from the published rounds: organizations.total_raised_eur mixes units (older rows in millions, the importer writes euros).
      totalRaisedEurMillions: roundList.some((r) => r.amountEurMillions != null) ? roundList.reduce((sum, r) => sum + (r.amountEurMillions ?? 0), 0) : null,
      signalCount: num(o.signal_count) ?? 0,
      latestSignalAt: str(o.last_signal_date),
      firstSeenAt: str(o.first_seen_at),
      createdAt: o.created_at as string,
      updatedAt: latestOf((o.updated_at as string) ?? (o.created_at as string), touched.get(id)),
      sectors: sectorList,
      tech: { primary: tc?.primary ?? null, secondary: tc?.secondary ?? [], terms: tc?.terms ?? [] },
      founders: founders.get(id) ?? [],
      rounds: roundList,
      programs: programs.get(id) ?? [],
    }
  })

  const signals: SignalRecord[] = signalRows.map((s) => ({
    id: s.id as string,
    companyId: s.organization_id as string,
    type: s.signal_type as string,
    date: str(s.signal_date),
    title: (s.title as string) ?? "",
    description: str(s.description),
    strength: num(s.strength),
    sourceName: str(s.source_name),
    sourceUrl: str(s.source_url),
    verificationStatus: str(s.verification_status),
    createdAt: s.created_at as string,
    updatedAt: (s.updated_at as string) ?? (s.created_at as string),
  }))

  // Latest signal date from the signals themselves when newer than the stored column
  // and the signal count from the signals actually published.
  const latest = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const s of signals) {
    counts.set(s.companyId, (counts.get(s.companyId) ?? 0) + 1)
    if (s.date && (!latest.has(s.companyId) || s.date > latest.get(s.companyId)!)) latest.set(s.companyId, s.date)
  }
  for (const c of companies) {
    const d = latest.get(c.id)
    if (d && (!c.latestSignalAt || d > c.latestSignalAt.slice(0, 10))) c.latestSignalAt = d
    c.signalCount = counts.get(c.id) ?? 0
  }

  return { companies, signals, layers: techIndex.vocab.layers, terms: techIndex.vocab.terms, termChildren: childrenIndex(techIndex.vocab.terms), loadedAt: Date.now() }
}
