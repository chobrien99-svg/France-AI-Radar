// The Enterprise API's field policy, in code. Every public field is listed
// here explicitly; nothing is copied from a database row wholesale.
//
// Never returned: SIREN/SIRET and legal entities, emails, phones, editor
// notes and investor briefs (organization_profiles), detection candidates,
// private programme memberships, unpublished funding rounds, internal
// legacy ids, other customers' lists. Tests in tests/enterprise-api.test.mjs
// check the output against this list.
import { stageFrom } from "@/lib/radar"
import { SIGNAL_TYPE_LABELS } from "@/lib/subscription"
import type { Company, CompanyRecord, CompanyRef, CompanySummary, RoundRecord, Signal, SignalRecord } from "@/lib/api/model"
import { STAGES } from "@/lib/api/model"

export const SITE_URL = "https://www.franceairadar.com"

const toEuros = (millions: number | null) => (millions == null || !Number.isFinite(millions) ? null : Math.round(millions * 1_000_000))
const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null)
const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : null)

/** Funding round stage (database enum) → the Radar's stage buckets */
const ROUND_STAGE: Record<string, string> = {
  pre_seed: "pre_seed", seed: "seed", series_a: "series_a",
  series_b: "series_b_plus", series_c: "series_b_plus", series_d: "series_b_plus", series_e: "series_b_plus", series_f: "series_b_plus", growth: "series_b_plus",
  grant: "grant", undisclosed: "undisclosed",
}

/**
 * The Radar's stage for a company, as a slug (series_b_plus, …): from the
 * editor's "last round" text, or, when that is empty, the latest published round.
 */
export function stageSlug(c: Pick<CompanyRecord, "lastRound" | "rounds">): string {
  if (c.lastRound?.trim()) {
    const label = stageFrom(c.lastRound)
    return STAGES.find((s) => s.label === label)?.slug ?? "other"
  }
  const latest = c.rounds.find((r) => r.stage) // rounds are newest first
  return latest ? ROUND_STAGE[latest.stage!] ?? "other" : "undisclosed"
}

// France AI Radar funding is compiled by The French Tech Journal. Links are
// references only, labelled by website, and never to data vendors.
export const COMPILED_BY = "The French Tech Journal"
const VENDOR_DOMAINS = ["pitchbook.com", "crunchbase.com", "dealroom.co", "cbinsights.com", "tracxn.com", "harmonic.ai", "specter.com", "growjo.com", "owler.com", "zoominfo.com", "apollo.io", "lusha.com"]

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

export function isVendorUrl(url: string): boolean {
  const host = hostOf(url)
  return !!host && VENDOR_DOMAINS.some((d) => host === d || host.endsWith("." + d))
}

export function roundReferences(r: Pick<RoundRecord, "ftjUrl" | "pressReleaseUrl" | "sourceUrl">): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = []
  for (const raw of [r.ftjUrl, r.pressReleaseUrl, r.sourceUrl]) {
    const url = httpUrl(raw)
    const host = url ? hostOf(url) : null
    if (!url || !host || isVendorUrl(url) || out.some((x) => x.url === url)) continue
    out.push({ label: host === "frenchtechjournal.com" ? "The French Tech Journal" : host, url })
  }
  return out
}

export function companyUrl(slug: string) {
  return `${SITE_URL}/startup/${encodeURIComponent(slug)}`
}

export function companyRef(c: Pick<CompanyRecord, "id" | "slug" | "name">): CompanyRef {
  return { id: c.id, slug: c.slug, name: c.name, url: companyUrl(c.slug) }
}

export function toCompanySummary(c: CompanyRecord): CompanySummary {
  return {
    object: "company",
    ...companyRef(c),
    short_description: c.shortDescription ?? c.description,
    website: httpUrl(c.website),
    logo_url: httpUrl(c.logoUrl),
    country: c.country,
    city: c.city?.name ?? null,
    stage: stageSlug(c),
    is_stealth: c.isStealth,
    sectors: c.sectors.map((s) => s.slug),
    primary_layer: c.tech.primary?.slug ?? null,
    latest_signal_at: iso(c.latestSignalAt),
    publication_status: "published",
    updated_at: iso(c.updatedAt)!,
  }
}

export function toCompany(c: CompanyRecord): Company {
  const summary: Partial<CompanySummary> = toCompanySummary(c)
  delete summary.sectors
  delete summary.primary_layer
  return {
    ...(summary as Omit<CompanySummary, "sectors" | "primary_layer">),
    description: c.description,
    linkedin_url: httpUrl(c.linkedinUrl),
    twitter_url: httpUrl(c.twitterUrl),
    secondary_city: c.secondaryCity?.name ?? null,
    founded_year: c.foundedYear,
    employee_range: c.employeeRange,
    total_raised_eur: c.totalRaisedEurMillions ? toEuros(c.totalRaisedEurMillions) : null,
    signal_count: c.signalCount,
    sectors: c.sectors.map((s) => ({ slug: s.slug, name: s.name, primary: s.isPrimary })),
    technology: {
      primary_layer: c.tech.primary ? { slug: c.tech.primary.slug, label: c.tech.primary.label } : null,
      secondary_layers: c.tech.secondary.map((l) => ({ slug: l.slug, label: l.label })),
      terms: c.tech.terms.map(({ term, kind }) => ({ slug: term.slug, label: term.label, facet: term.facet, relationship: kind })),
    },
    founders: c.founders.map((f) => ({
      id: f.id,
      name: f.name,
      role: f.role,
      linkedin_url: httpUrl(f.linkedinUrl),
      short_bio: f.shortBio,
      url: f.slug ? `${SITE_URL}/founder/${encodeURIComponent(f.slug)}` : null,
    })),
    funding_rounds: c.rounds.map((r) => ({
      id: r.id,
      stage: r.stage,
      amount_eur: toEuros(r.amountEurMillions),
      amount_original: r.amountOriginal,
      currency_original: r.currencyOriginal,
      is_estimated: r.isEstimated,
      announced_date: r.announcedDate,
      closed_date: r.closedDate,
      investors: r.investors.map((i) => ({ name: i.name, lead: i.isLead })),
      compiled_by: COMPILED_BY,
      references: roundReferences(r),
    })),
    programs: c.programs.map((p) => ({ program: p.program, edition: p.edition, year: p.year, role: p.role })),
    first_seen_at: iso(c.firstSeenAt),
  }
}

export function toSignal(s: SignalRecord, company: CompanyRecord): Signal {
  return {
    object: "signal",
    id: s.id,
    company: companyRef(company),
    type: s.type,
    type_label: SIGNAL_TYPE_LABELS[s.type] ?? s.type,
    date: s.date,
    title: s.title,
    description: s.description,
    strength: s.strength,
    source: { name: s.sourceName, url: httpUrl(s.sourceUrl) },
    // Signals reach the database only after an editor approves them. Evidence
    // status is separate: most are "unverified" until checked (decision D9).
    publication_status: "approved",
    verification_status: s.verificationStatus ?? "unverified",
    created_at: iso(s.createdAt)!,
    updated_at: iso(s.updatedAt)!,
  }
}
