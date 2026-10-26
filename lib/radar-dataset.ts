import type { SupabaseClient } from "@supabase/supabase-js"
import type { CardStartup, CardFounder } from "@/components/radar/cards"
import { SORTS, founderTags, paramList, paramOne, stageFrom } from "@/lib/radar"
import { loadTechnicalIndex, type Vocabulary } from "@/lib/technical-profile"
import {
  FACETS, UNCLASSIFIED, childrenIndex, facetMatches, familyLabel, techMatches,
  type Facet, type StartupTech, type TechSelection,
} from "@/lib/taxonomy"

// ------------------------------------------------------------------
// The Database's startup/founder dataset and its filter semantics.
// Shared by /database and /api/database/export so the CSV always
// contains exactly what the page shows.
// ------------------------------------------------------------------

export const TIME_OPTIONS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "12m", label: "Last 12 months", days: 365 },
]

type Row = Record<string, unknown>
type Named = { id: string; name: string }
type Params = Record<string, string | string[] | undefined>

export type StartupItem = CardStartup & {
  sectorId: string | null
  cityId: string | null
  firstSeen: string | null
  /** When it was added to the Radar (first seen, else created), for "Most recent" */
  added: number
  activity: number
  search: string
  /** Technical classification as slugs, for filtering */
  tech: StartupTech
  /** The same classification as display labels, for the CSV export */
  techLabels: { primaryLayer: string | null; secondaryLayers: string[] } & Record<Facet, string[]>
}
export type FounderItem = CardFounder & {
  sectorId: string | null
  cityId: string | null
  activity: number
  /** Name, role, company and bio — Professional search */
  search: string
  /** Name and company only — what non-Professional tiers may search */
  publicSearch: string
}

export type RadarDataset = {
  startups: StartupItem[]
  founders: FounderItem[]
  /** Startup ids on the user's watchlist */
  saved: Set<string>
  signalTotal: number
  /** Technical layers and terms, for filter options */
  vocab: Vocabulary
  /** Term slug → narrower term slugs */
  termChildren: Map<string, string[]>
}

export type DatabaseQuery = {
  tab: "startups" | "founders"
  q: string
  sort: string
  shortlistOnly: boolean
  /** Can search founder roles and bios (Professional) */
  premium: boolean
  sel: { sector: string[]; stage: string[]; signal: string[]; location: string[]; bg: string[]; time: string[] }
  /** Technical taxonomy filters (Professional) */
  tech: TechSelection
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null
}

/** Was `iso` within the last `days` days? */
export function withinTime(iso: string | null, days: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() <= days * 86_400_000
}

const matches = (selected: string[], values: Array<string | null | undefined>) =>
  selected.length === 0 || values.some((v) => v != null && selected.includes(v))

/** Read the Database URL state. Filters the tier can't use are ignored. */
export function parseDatabaseQuery(params: Params, opts: { advanced: boolean; canShortlist: boolean; premium: boolean }): DatabaseQuery {
  const { advanced, canShortlist, premium } = opts
  const tab = paramOne(params.tab) === "founders" ? "founders" : "startups"
  const sortParam = paramOne(params.sort)
  return {
    tab,
    q: paramOne(params.q).trim().toLowerCase(),
    sort: SORTS[tab].some((o) => o.value === sortParam) ? sortParam : "latest",
    shortlistOnly: tab === "startups" && canShortlist && paramOne(params.shortlist) === "1",
    premium,
    sel: {
      sector: advanced ? paramList(params.sector) : [],
      stage: advanced ? paramList(params.stage) : [],
      signal: advanced ? paramList(params.signal) : [],
      location: advanced ? paramList(params.location) : [],
      bg: advanced ? paramList(params.bg) : [],
      time: paramList(params.time),
    },
    tech: {
      layer: advanced ? paramList(params.layer) : [],
      includeSecondary: advanced && paramOne(params.layerscope) === "any",
      developsOnly: advanced && paramOne(params.develops) === "1",
      spec: advanced ? paramList(params.spec) : [],
      method: advanced ? paramList(params.method) : [],
      modality: advanced ? paramList(params.modality) : [],
      domain: advanced ? paramList(params.domain) : [],
    },
  }
}

/** Load every active AI Radar startup with its sector, latest signal and founders */
export async function loadRadarDataset(svc: SupabaseClient, supabase: SupabaseClient, userId: string): Promise<RadarDataset> {
  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const orgIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)
  const idFilter = orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"]

  const [{ data: orgRows, error: orgError }, { data: sectorRows }, { data: signalRows }, { data: founderRows }, { data: watchRows }, techIndex] =
    await Promise.all([
      svc
        .from("organizations")
        .select("id, name, slug, description, short_description, logo_url, last_round, signal_count, last_signal_date, first_seen_at, created_at, cities!organizations_city_id_fkey(id, name)")
        .in("id", idFilter)
        .eq("status", "active"),
      svc.from("organization_sectors").select("organization_id, is_primary, sectors(id, name)").in("organization_id", idFilter),
      svc
        .from("signals")
        .select("organization_id, signal_type, title, signal_date")
        .in("organization_id", idFilter)
        .order("signal_date", { ascending: false, nullsFirst: false }),
      svc
        .from("organization_people")
        .select("organization_id, role, people(id, full_name, slug, short_bio, bio, photo_url, has_phd, is_repeat_founder, has_big_tech_background, previous_exits, academic_lab)")
        .in("organization_id", idFilter)
        .eq("is_founder", true),
      supabase.from("watchlist").select("organization_id").eq("user_id", userId),
      loadTechnicalIndex(svc, idFilter),
    ])
  if (orgError) console.error("Database query error:", orgError.message, orgError.code)

  // Primary sector per startup
  const sectorByOrg = new Map<string, Named>()
  for (const r of (sectorRows ?? []) as Row[]) {
    const s = one(r.sectors as Named | Named[] | null)
    const orgId = r.organization_id as string
    if (s && (!sectorByOrg.has(orgId) || r.is_primary)) sectorByOrg.set(orgId, s)
  }

  // Latest signal per startup (rows are newest first)
  const latestByOrg = new Map<string, { type: string; title: string; date: string | null }>()
  for (const r of (signalRows ?? []) as Row[]) {
    const orgId = r.organization_id as string
    if (!latestByOrg.has(orgId)) {
      latestByOrg.set(orgId, { type: r.signal_type as string, title: r.title as string, date: (r.signal_date as string | null) ?? null })
    }
  }

  const founderNamesByOrg = new Map<string, string[]>()
  for (const r of (founderRows ?? []) as Row[]) {
    const p = one(r.people as Row | Row[] | null)
    if (!p) continue
    const list = founderNamesByOrg.get(r.organization_id as string) ?? []
    list.push(p.full_name as string)
    founderNamesByOrg.set(r.organization_id as string, list)
  }

  const saved = new Set(((watchRows ?? []) as Row[]).map((r) => r.organization_id as string))

  const startups: StartupItem[] = ((orgRows ?? []) as Row[]).map((o) => {
    const id = o.id as string
    const city = one(o.cities as Named | Named[] | null)
    const sector = sectorByOrg.get(id) ?? null
    const latest = latestByOrg.get(id) ?? null
    const latestDate = latest?.date ?? (o.last_signal_date as string | null) ?? (o.created_at as string)
    const tc = techIndex.byOrg.get(id)
    const labels = (facet: Facet) => (tc?.terms ?? []).filter(({ term }) => term.facet === facet).map(({ term }) => term.label)
    const item: StartupItem = {
      id,
      slug: o.slug as string,
      name: o.name as string,
      description: (o.short_description as string | null) || (o.description as string | null),
      logoUrl: (o.logo_url as string | null) ?? null,
      sector: sector?.name ?? null,
      sectorId: sector?.id ?? null,
      stage: stageFrom(o.last_round as string | null),
      city: city?.name ?? null,
      cityId: city?.id ?? null,
      signalCount: (o.signal_count as number | null) ?? 0,
      latestSignal: latest,
      firstSeen: (o.first_seen_at as string | null) ?? null,
      added: new Date(((o.first_seen_at as string | null) ?? (o.created_at as string)) || 0).getTime() || 0,
      activity: latestDate ? new Date(latestDate).getTime() : 0,
      search: "",
      tech: {
        primaryLayer: tc?.primary?.slug ?? null,
        secondaryLayers: (tc?.secondary ?? []).map((l) => l.slug),
        terms: (tc?.terms ?? []).map(({ term, kind }) => ({ slug: term.slug, facet: term.facet, kind })),
      },
      techLabels: {
        primaryLayer: tc?.primary?.label ?? null,
        secondaryLayers: (tc?.secondary ?? []).map((l) => l.label),
        specialization: labels("specialization"),
        method: labels("method"),
        modality: labels("modality"),
        domain: labels("domain"),
      },
    }
    // Technical terms are searchable by label and by alias ("RAG", "Agentic AI")
    const techWords = [tc?.primary?.label, ...(tc?.secondary ?? []).map((l) => l.label), ...(tc?.terms ?? []).flatMap(({ term }) => [term.label, ...term.aliases])]
    item.search = [item.name, o.description, item.sector, item.city, ...(founderNamesByOrg.get(id) ?? []), ...techWords].join(" ").toLowerCase()
    return item
  })
  const startupById = new Map(startups.map((s) => [s.id, s]))

  // One entry per person; first linked Radar startup is their company
  const founderMap = new Map<string, FounderItem>()
  for (const r of (founderRows ?? []) as Row[]) {
    const p = one(r.people as Row | Row[] | null)
    const company = startupById.get(r.organization_id as string)
    if (!p || !company || founderMap.has(p.id as string)) continue
    const f: FounderItem = {
      id: p.id as string,
      slug: (p.slug as string | null) ?? null,
      name: p.full_name as string,
      role: (r.role as string | null) ?? null,
      photoUrl: (p.photo_url as string | null) ?? null,
      bio: (p.short_bio as string | null) || (p.bio as string | null),
      tags: founderTags({
        has_big_tech_background: !!p.has_big_tech_background,
        has_phd: !!p.has_phd,
        is_repeat_founder: !!p.is_repeat_founder,
        previous_exits: (p.previous_exits as number | null) ?? 0,
        academic_lab: (p.academic_lab as string | null) ?? null,
      }),
      company: { name: company.name, slug: company.slug, sector: company.sector, city: company.city },
      sectorId: company.sectorId,
      cityId: company.cityId,
      activity: company.activity,
      search: "",
      publicSearch: "",
    }
    f.search = [f.name, f.role, company.name, f.bio].join(" ").toLowerCase()
    f.publicSearch = [f.name, company.name].join(" ").toLowerCase()
    founderMap.set(f.id, f)
  }

  return {
    startups,
    founders: Array.from(founderMap.values()),
    saved,
    signalTotal: (signalRows ?? []).length,
    vocab: techIndex.vocab,
    termChildren: childrenIndex(techIndex.vocab.terms),
  }
}

/** Startups matching the query, in display order */
export function filterStartups(ds: RadarDataset, query: DatabaseQuery): StartupItem[] {
  const { sel, q, sort, shortlistOnly } = query
  const timeOpt = TIME_OPTIONS.find((t) => t.value === sel.time[sel.time.length - 1])
  const out = ds.startups.filter(
    (s) =>
      matches(sel.sector, [s.sectorId]) &&
      matches(sel.stage, [s.stage]) &&
      matches(sel.signal, [s.latestSignal?.type]) &&
      matches(sel.location, [s.cityId]) &&
      (!timeOpt || withinTime(s.firstSeen, timeOpt.days)) &&
      (!shortlistOnly || ds.saved.has(s.id)) &&
      techMatches(s.tech, query.tech, ds.termChildren) &&
      (!q || s.search.includes(q))
  )
  if (sort === "az") out.sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === "signals") out.sort((a, b) => b.signalCount - a.signalCount || b.activity - a.activity)
  else if (sort === "recent") out.sort((a, b) => b.added - a.added || a.name.localeCompare(b.name))
  else out.sort((a, b) => b.activity - a.activity)
  return out
}

/** Founders matching the query, in display order */
export function filterFounders(ds: RadarDataset, query: DatabaseQuery): FounderItem[] {
  const { sel, q, sort, premium } = query
  const out = ds.founders.filter(
    (f) =>
      matches(sel.bg, f.tags) &&
      matches(sel.sector, [f.sectorId]) &&
      matches(sel.location, [f.cityId]) &&
      (!q || (premium ? f.search : f.publicSearch).includes(q))
  )
  const bareName = (n: string) => n.replace(/^Dr\.?\s*/i, "")
  if (sort === "az") out.sort((a, b) => bareName(a.name).localeCompare(bareName(b.name)))
  else out.sort((a, b) => b.activity - a.activity)
  return out
}

export type TechFilterOption = { value: string; label: string; n: number; section?: string; hint?: string }

/**
 * Options for the technical filters, counted over the whole Radar with the
 * same rules as filtering (an umbrella term counts startups tagged with a
 * narrower one). Only values some startup has are offered, plus an explicit
 * "Unclassified" option once a dimension is in use.
 */
export function technicalFilterOptions(ds: RadarDataset): { layer: TechFilterOption[] } & Record<Facet, TechFilterOption[]> {
  const withUnclassified = (opts: TechFilterOption[], unclassified: number) =>
    opts.length > 0 && unclassified > 0 ? [...opts, { value: UNCLASSIFIED, label: "Unclassified", n: unclassified }] : opts

  const layer = withUnclassified(
    ds.vocab.layers
      .map((l) => ({ value: l.slug, label: l.label, hint: l.description ?? undefined, n: ds.startups.filter((s) => s.tech.primaryLayer === l.slug).length }))
      .filter((o) => o.n > 0),
    ds.startups.filter((s) => !s.tech.primaryLayer).length,
  )

  const facetOptions = (facet: Facet) =>
    withUnclassified(
      ds.vocab.terms
        .filter((t) => t.facet === facet)
        .map((t) => ({
          value: t.slug,
          label: t.label,
          hint: t.definition ?? undefined,
          section: facet === "specialization" ? familyLabel(t.family) : undefined,
          n: ds.startups.filter((s) => facetMatches(s.tech, facet, [t.slug], ds.termChildren)).length,
        }))
        .filter((o) => o.n > 0),
      ds.startups.filter((s) => !s.tech.terms.some((t) => t.facet === facet)).length,
    )

  return {
    layer,
    ...(Object.fromEntries(FACETS.map((f) => [f.value, facetOptions(f.value)])) as Record<Facet, TechFilterOption[]>),
  }
}
