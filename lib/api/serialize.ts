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
import type { Company, CompanyRecord, CompanyRef, CompanySummary, Signal, SignalRecord } from "@/lib/api/model"
import { STAGES } from "@/lib/api/model"

export const SITE_URL = "https://www.franceairadar.com"

const toEuros = (millions: number | null) => (millions == null || !Number.isFinite(millions) ? null : Math.round(millions * 1_000_000))
const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null)
const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : null)

/** The Radar's stage label for a company, as a slug (series_b_plus, …) */
export function stageSlug(c: Pick<CompanyRecord, "lastRound">): string {
  const label = stageFrom(c.lastRound)
  return STAGES.find((s) => s.label === label)?.slug ?? "other"
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
      sources: [
        ...(httpUrl(r.ftjUrl) ? [{ name: "The French Tech Journal", url: httpUrl(r.ftjUrl)! }] : []),
        ...(httpUrl(r.pressReleaseUrl) ? [{ name: "Press release", url: httpUrl(r.pressReleaseUrl)! }] : []),
        ...(httpUrl(r.sourceUrl) ? [{ name: r.sourceName, url: httpUrl(r.sourceUrl)! }] : []),
      ],
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
