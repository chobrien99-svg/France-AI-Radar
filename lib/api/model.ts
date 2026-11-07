// Records the Enterprise API works with: the internal shape loaded from the
// database (CompanyRecord, SignalRecord) and the public JSON it returns
// (Company, CompanySummary, Signal). Only lib/api/serialize.ts turns one into
// the other, field by field, so nothing reaches a customer by accident.
import type { Facet, RelationshipKind, TechLayer, TechTerm } from "@/lib/taxonomy"

export type Place = { name: string; slug: string | null; region: string | null }

export type RoundRecord = {
  id: string
  stage: string | null
  /** Stored in millions of euros, as in the database */
  amountEurMillions: number | null
  amountOriginal: number | null
  currencyOriginal: string | null
  announcedDate: string | null
  closedDate: string | null
  isEstimated: boolean
  sourceName: string | null
  sourceUrl: string | null
  pressReleaseUrl: string | null
  ftjUrl: string | null
  investors: { name: string; isLead: boolean }[]
}

export type CompanyRecord = {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  description: string | null
  website: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  logoUrl: string | null
  country: string | null
  city: Place | null
  secondaryCity: Place | null
  foundedYear: number | null
  isStealth: boolean
  employeeRange: string | null
  lastRound: string | null
  /** Sum of the published rounds' disclosed amounts, in millions of euros */
  totalRaisedEurMillions: number | null
  signalCount: number
  latestSignalAt: string | null
  firstSeenAt: string | null
  createdAt: string
  updatedAt: string
  sectors: { slug: string; name: string; isPrimary: boolean }[]
  tech: { primary: TechLayer | null; secondary: TechLayer[]; terms: { term: TechTerm; kind: RelationshipKind }[] }
  founders: { id: string; name: string; slug: string | null; role: string | null; linkedinUrl: string | null; shortBio: string | null }[]
  rounds: RoundRecord[]
  programs: { program: string; programSlug: string | null; edition: string | null; editionSlug: string | null; year: number | null; role: string | null }[]
}

export type SignalRecord = {
  id: string
  companyId: string
  type: string
  date: string | null
  title: string
  description: string | null
  strength: number | null
  sourceName: string | null
  sourceUrl: string | null
  verificationStatus: string | null
  createdAt: string
  updatedAt: string
}

export type Dataset = {
  companies: CompanyRecord[]
  signals: SignalRecord[]
  layers: TechLayer[]
  terms: TechTerm[]
  /** Term slug → narrower term slugs */
  termChildren: Map<string, string[]>
  loadedAt: number
}

// ---- Public JSON ----

export type CompanyRef = { id: string; slug: string; name: string; url: string }

export type CompanySummary = CompanyRef & {
  object: "company"
  short_description: string | null
  website: string | null
  logo_url: string | null
  country: string | null
  city: string | null
  stage: string
  is_stealth: boolean
  sectors: string[]
  primary_layer: string | null
  latest_signal_at: string | null
  publication_status: "published"
  updated_at: string
}

export type Company = Omit<CompanySummary, "sectors" | "primary_layer"> & {
  description: string | null
  linkedin_url: string | null
  twitter_url: string | null
  secondary_city: string | null
  founded_year: number | null
  employee_range: string | null
  total_raised_eur: number | null
  signal_count: number
  sectors: { slug: string; name: string; primary: boolean }[]
  technology: {
    primary_layer: { slug: string; label: string } | null
    secondary_layers: { slug: string; label: string }[]
    terms: { slug: string; label: string; facet: Facet; relationship: RelationshipKind }[]
  }
  founders: { id: string; name: string; role: string | null; linkedin_url: string | null; short_bio: string | null; url: string | null }[]
  funding_rounds: {
    id: string
    stage: string | null
    amount_eur: number | null
    amount_original: number | null
    currency_original: string | null
    is_estimated: boolean
    announced_date: string | null
    closed_date: string | null
    investors: { name: string; lead: boolean }[]
    sources: { name: string | null; url: string }[]
  }[]
  programs: { program: string; edition: string | null; year: number | null; role: string | null }[]
  first_seen_at: string | null
}

export type Signal = {
  object: "signal"
  id: string
  company: CompanyRef
  type: string
  type_label: string
  date: string | null
  title: string
  description: string | null
  strength: number | null
  source: { name: string | null; url: string | null }
  publication_status: "approved"
  verification_status: string
  created_at: string
  updated_at: string
}

/** Company stage buckets, as shown on the Radar */
export const STAGES = [
  { slug: "pre_seed", label: "Pre-seed" },
  { slug: "seed", label: "Seed" },
  { slug: "series_a", label: "Series A" },
  { slug: "series_b_plus", label: "Series B+" },
  { slug: "grant", label: "Grant" },
  { slug: "other", label: "Other" },
  { slug: "undisclosed", label: "Undisclosed" },
] as const
