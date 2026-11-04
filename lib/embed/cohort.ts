// Data for the embeddable cohort infographic (/embed/program/[slug]).
// buildCohort() is pure (tested in tests/embed-cohort.test.mjs); loadCohort()
// reads the rows with the service client. Only public facts leave this file:
// no SIREN, email, phone or private notes.
import type { SupabaseClient } from "@supabase/supabase-js"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.franceairadar.com"

export type BaseKey = "fr" | "foreign-parent" | "abroad-fr" | "abroad"
export type StageKey = "a" | "seed" | "pre" | "unsp" | "boot" | "none"

export const BASE_LABELS: Record<BaseKey, string> = {
  fr: "Based in France",
  "foreign-parent": "Foreign parent, team in France",
  "abroad-fr": "HQ abroad, French entity",
  abroad: "HQ abroad",
}
export const STAGE_LABELS: Record<StageKey, string> = {
  a: "Series A or later",
  seed: "Seed",
  pre: "Pre-seed",
  unsp: "Raised, stage not given",
  boot: "Bootstrapped (reported)",
  none: "None disclosed",
}
export const OTHER_THEME = "Other"

export type CohortLink = { label: string; url: string }
export type CohortCompany = {
  slug: string
  name: string
  theme: string
  base: BaseKey
  place: string
  year: number | null
  stage: StageKey
  funding: string[]
  backers: string[]
  founders: string[]
  programmes: string[]
  description: string | null
  website: string | null
  stealth: boolean
  links: CohortLink[]
}
export type Cohort = { editionName: string; companies: CohortCompany[]; themes: { name: string; count: number }[] }

// ---- Raw rows (shape of what loadCohort reads) ----
export type CohortRows = {
  editionName: string
  members: { organization_id: string; group_label: string | null }[]
  orgs: {
    id: string; name: string; slug: string; country: string | null; city_id: string | null; secondary_city_id: string | null
    founded_year: number | null; short_description: string | null; description: string | null; website: string | null; is_stealth: boolean | null
  }[]
  cities: { id: string; name: string }[]
  legal: { organization_id: string; country: string | null; is_primary: boolean | null; incorporation_date: string | null }[]
  rounds: {
    id: string; organization_id: string; stage: string; amount_eur: number | null; currency_original: string | null
    amount_original: number | null; announced_date: string | null; ftj_url: string | null
  }[]
  roundInvestors: { funding_round_id: string; investor_id: string }[]
  investorNames: { id: string; name: string }[]
  founders: { organization_id: string; person_id: string; full_name: string }[]
  programmes: { organization_id: string; program: string; program_type: string | null; cohort_label: string | null }[]
  tags: { organization_id: string; tag: string }[]
  radarIds: string[]
}

const isFrance = (c: string | null | undefined) => !!c && /^(france|fr)$/i.test(c.trim())
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const SYMBOL: Record<string, string> = { EUR: "€", USD: "US$", GBP: "£", CAD: "CA$", KRW: "₩", CHF: "CHF ", JPY: "¥" }
const STAGE_TEXT: Record<string, string> = {
  pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A", series_b: "Series B", series_c: "Series C", series_d: "Series D",
  series_e: "Series E", series_f: "Series F", growth: "Growth", bridge: "Bridge", debt: "Debt", grant: "Grant", ipo: "IPO",
  secondary: "Secondary", undisclosed: "Raised", other: "Raised",
}

/** 7000000 → "7M", 930000 → "930k", 10000000000 → "10bn", 2500000 → "2.5M" */
export function compactAmount(n: number): string {
  const trim = (x: number) => String(Math.round(x * 10) / 10)
  if (n >= 1e9) return `${trim(n / 1e9)}bn`
  if (n >= 1e6) return `${trim(n / 1e6)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}

/** One line per round, in the currency it was announced in. amount_eur is stored in millions. */
export function roundLine(r: CohortRows["rounds"][number]): string {
  let amount: string | null = null
  if (r.currency_original && r.amount_original) amount = `${SYMBOL[r.currency_original] ?? r.currency_original + " "}${compactAmount(Number(r.amount_original))}`
  else if (r.amount_eur != null) amount = `€${compactAmount(Number(r.amount_eur) * 1e6)}`
  const d = r.announced_date ? new Date(r.announced_date + "T00:00:00Z") : null
  const when = d ? ` (${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()})` : ""
  const stage = STAGE_TEXT[r.stage] ?? "Raised"
  if (!amount) return `${stage === "Raised" ? "Round" : stage}, amount undisclosed${when}`
  return `${stage} ${amount}${when}`
}

/** The furthest stage reached: a later strategic or undisclosed round doesn't take a company back. */
function stageKey(rounds: CohortRows["rounds"], bootstrapped: boolean): StageKey {
  const equity = rounds.filter((r) => r.stage !== "grant")
  if (equity.length === 0) return bootstrapped ? "boot" : "none"
  const rank = (s: string): StageKey => (/^series_|^growth$|^ipo$/.test(s) ? "a" : s === "seed" ? "seed" : s === "pre_seed" ? "pre" : "unsp")
  const order: StageKey[] = ["a", "seed", "pre", "unsp"]
  return equity.map((r) => rank(r.stage)).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
}

/** Grants without an amount add nothing to a funding list. */
const listed = (r: CohortRows["rounds"][number]) => r.stage !== "grant" || r.amount_eur != null || r.amount_original != null

export function buildCohort(rows: CohortRows): Cohort {
  const cityName = new Map(rows.cities.map((c) => [c.id, c.name]))
  const investor = new Map(rows.investorNames.map((i) => [i.id, i.name]))
  const radar = new Set(rows.radarIds)
  const by = <T extends { organization_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of list) m.set(x.organization_id, [...(m.get(x.organization_id) ?? []), x])
    return m
  }
  const legal = by(rows.legal), rounds = by(rows.rounds), founders = by(rows.founders), progs = by(rows.programmes), tags = by(rows.tags)
  const investorsByRound = new Map<string, string[]>()
  for (const ri of rows.roundInvestors) {
    const n = investor.get(ri.investor_id)
    if (n) investorsByRound.set(ri.funding_round_id, [...(investorsByRound.get(ri.funding_round_id) ?? []), n])
  }
  const themeOf = new Map(rows.members.map((m) => [m.organization_id, m.group_label?.trim() || OTHER_THEME]))

  const companies: CohortCompany[] = rows.orgs.filter((o) => themeOf.has(o.id)).map((o) => {
    const les = legal.get(o.id) ?? []
    const primary = les.find((l) => l.is_primary) ?? les[0]
    let base: BaseKey
    if (isFrance(o.country)) base = primary?.country && !isFrance(primary.country) ? "foreign-parent" : "fr"
    else base = les.some((l) => isFrance(l.country)) ? "abroad-fr" : "abroad"

    const c1 = o.city_id ? cityName.get(o.city_id) : undefined
    const c2 = o.secondary_city_id ? cityName.get(o.secondary_city_id) : undefined
    const cities = [c1, c2].filter(Boolean).join(" and ")
    const place = isFrance(o.country) ? (cities || "France") : cities ? `${cities} (${o.country})` : (o.country ?? "")

    const incYear = primary?.incorporation_date ? Number(primary.incorporation_date.slice(0, 4)) : null
    const rs = [...(rounds.get(o.id) ?? [])].sort((a, b) => (a.announced_date ?? "9999").localeCompare(b.announced_date ?? "9999"))
    const bootstrapped = (tags.get(o.id) ?? []).some((t) => /^bootstrapped$/i.test(t.tag.trim()))
    const accelerators = (progs.get(o.id) ?? []).filter((p) => p.program_type === "accelerator").map((p) => p.program)
    const backers = [...new Set([...rs.flatMap((r) => investorsByRound.get(r.id) ?? []), ...accelerators])]
      .filter((n) => !/^business angels?$/i.test(n))
    const programmes = [...new Set((progs.get(o.id) ?? []).map((p) => (p.cohort_label && p.cohort_label !== p.program ? `${p.program} ${p.cohort_label}` : p.program)))]
    const links: CohortLink[] = []
    if (radar.has(o.id)) links.push({ label: "Profile on the France AI Radar", url: `${SITE_URL}/startup/${o.slug}` })
    for (const r of rs) if (r.ftj_url && !links.some((l) => l.url === r.ftj_url)) links.push({ label: `French Tech Journal: ${roundLine(r)}`, url: r.ftj_url })

    return {
      slug: o.slug,
      name: o.name,
      theme: themeOf.get(o.id)!,
      base,
      place,
      year: o.founded_year ?? incYear,
      stage: stageKey(rs, bootstrapped),
      funding: rs.filter(listed).map(roundLine),
      backers,
      founders: [...new Map((founders.get(o.id) ?? []).map((f) => [f.person_id, f.full_name])).values()],
      programmes,
      description: o.short_description ?? o.description,
      website: o.website,
      stealth: !!o.is_stealth,
      links,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }))

  const counts = new Map<string, number>()
  for (const c of companies) counts.set(c.theme, (counts.get(c.theme) ?? 0) + 1)
  const themes = [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === OTHER_THEME ? 1 : b.name === OTHER_THEME ? -1 : b.count - a.count || a.name.localeCompare(b.name)))
  return { editionName: rows.editionName, companies, themes }
}

/** Reads one program edition's companies. Returns null when the edition doesn't exist. */
export async function loadCohort(svc: SupabaseClient, editionSlug: string): Promise<Cohort | null> {
  const { data: edition } = await svc.from("program_editions").select("id, name").eq("slug", editionSlug).maybeSingle()
  if (!edition) return null
  const { data: members } = await svc.from("program_organizations").select("organization_id, group_label").eq("program_edition_id", edition.id)
  const ids = (members ?? []).map((m) => m.organization_id as string)
  if (ids.length === 0) return { editionName: edition.name, companies: [], themes: [] }

  const [orgs, legal, rounds, founders, progs, tags, radar] = await Promise.all([
    svc.from("organizations").select("id, name, slug, country, city_id, secondary_city_id, founded_year, short_description, description, website, is_stealth").in("id", ids),
    svc.from("legal_entities").select("organization_id, country, is_primary, incorporation_date").in("organization_id", ids),
    svc.from("funding_rounds").select("id, organization_id, stage, amount_eur, currency_original, amount_original, announced_date, ftj_url").in("organization_id", ids),
    svc.from("organization_people").select("organization_id, person_id, is_founder, people(full_name)").in("organization_id", ids).eq("is_founder", true),
    svc.from("program_organizations").select("organization_id, program_edition_id, program_editions(cohort_label, programs(name, program_type))").in("organization_id", ids).neq("program_edition_id", edition.id),
    svc.from("organization_tags").select("organization_id, tag").in("organization_id", ids),
    svc.from("product_organizations").select("organization_id, product_catalog!inner(slug)").eq("product_catalog.slug", "ai-radar").in("organization_id", ids),
  ])
  const roundIds = (rounds.data ?? []).map((r) => r.id as string)
  const { data: ri } = roundIds.length
    ? await svc.from("funding_round_investors").select("funding_round_id, investor_id").in("funding_round_id", roundIds)
    : { data: [] }
  const investorIds = [...new Set((ri ?? []).map((r) => r.investor_id as string))]
  const { data: investorNames } = investorIds.length
    ? await svc.from("organizations").select("id, name").in("id", investorIds)
    : { data: [] }
  const cityIds = [...new Set((orgs.data ?? []).flatMap((o) => [o.city_id, o.secondary_city_id]).filter(Boolean) as string[])]
  const { data: cities } = cityIds.length ? await svc.from("cities").select("id, name").in("id", cityIds) : { data: [] }

  type Row = Record<string, unknown>
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

  return buildCohort({
    editionName: edition.name,
    members: (members ?? []) as CohortRows["members"],
    orgs: (orgs.data ?? []) as CohortRows["orgs"],
    cities: (cities ?? []) as CohortRows["cities"],
    legal: (legal.data ?? []) as CohortRows["legal"],
    rounds: (rounds.data ?? []) as CohortRows["rounds"],
    roundInvestors: (ri ?? []) as CohortRows["roundInvestors"],
    investorNames: (investorNames ?? []) as CohortRows["investorNames"],
    founders: ((founders.data ?? []) as Row[]).map((f) => ({
      organization_id: f.organization_id as string,
      person_id: f.person_id as string,
      full_name: (one(f.people as Row | Row[] | null)?.full_name as string) ?? "",
    })).filter((f) => f.full_name),
    programmes: ((progs.data ?? []) as Row[]).flatMap((p) => {
      const ed = one(p.program_editions as Row | Row[] | null)
      const pr = one(ed?.programs as Row | Row[] | null)
      return pr ? [{ organization_id: p.organization_id as string, program: pr.name as string, program_type: (pr.program_type as string) ?? null, cohort_label: (ed?.cohort_label as string) ?? null }] : []
    }),
    tags: (tags.data ?? []) as CohortRows["tags"],
    radarIds: ((radar.data ?? []) as Row[]).map((r) => r.organization_id as string),
  })
}
