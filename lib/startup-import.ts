// ------------------------------------------------------------------
// Startup drafts produced by the Claude Project template
// (France_AI_Radar_Startup_Template.md, Part 3 › S) and imported at
// /admin/startups/import. This module only parses and validates: it
// turns the pasted JSON into database-ready values and lists what it
// had to drop or adjust. Writing is in lib/startup-import-server.ts.
//
// Kept free of "@/..." imports so `npm test` can run it with plain Node.
// ------------------------------------------------------------------

import {
  CLAIMS, EVIDENCE_STATUSES, FACETS, MATURITIES, POSITIONINGS, PRODUCT_ROLES, RELATIONSHIP_KINDS,
  type EvidenceStatus, type Facet, type RelationshipKind,
} from "./taxonomy.ts"

export const DRAFT_SCHEMA = "france-ai-radar/startup-draft@1"

type Option = { value: string; label: string }

export const FUNDRAISING_STATUSES: Option[] = [
  { value: "unknown", label: "Unknown" },
  { value: "not_raising", label: "Not raising" },
  { value: "exploring", label: "Exploring" },
  { value: "actively_raising", label: "Actively raising" },
  { value: "closing", label: "Closing" },
  { value: "recently_closed", label: "Recently closed" },
]

export const SIGNAL_TYPES: Option[] = [
  "fundraising", "hiring_surge", "key_hire", "restructuring", "incorporation", "new_product", "pivot",
  "expansion", "partnership", "founder_departure", "talent_move", "patent_filing", "award",
  "media_mention", "regulatory", "open_source", "conference", "other",
].map((v) => ({ value: v, label: v.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") }))

export const FUNDING_STAGES: Option[] = [
  ["pre_seed", "Pre-Seed"], ["seed", "Seed"], ["series_a", "Series A"], ["series_b", "Series B"],
  ["series_c", "Series C"], ["series_d", "Series D"], ["series_e", "Series E"], ["series_f", "Series F"],
  ["growth", "Growth"], ["bridge", "Bridge"], ["debt", "Debt"], ["grant", "Grant"], ["ipo", "IPO"],
  ["secondary", "Secondary"], ["undisclosed", "Undisclosed"], ["other", "Other"],
].map(([value, label]) => ({ value, label }))

export const PROGRAM_TYPES: Option[] = [
  ["accelerator", "Accelerator"], ["incubator", "Incubator"], ["france_2030", "France 2030"],
  ["competition", "Competition"], ["grant_program", "Grant Program"], ["government", "Government"],
  ["university", "University"], ["corporate", "Corporate"], ["other", "Other"],
].map(([value, label]) => ({ value, label }))

/** Signal-tag strengths as stored (5 strong … 1 weak) */
export const TAG_STRENGTHS: Option[] = [
  { value: "5", label: "Strong" }, { value: "3", label: "Moderate" }, { value: "2", label: "Neutral" }, { value: "1", label: "Weak" },
]

/** The vocabulary a draft is checked against, loaded from the database */
export type ImportVocab = {
  layers: { id: string; slug: string; label: string; isActive: boolean }[]
  terms: { id: string; slug: string; label: string; facet: Facet; aliases: string[]; isActive: boolean }[]
  sectors: { id: string; name: string }[]
}

export type Issue = { path: string; message: string }

type Evidence = { evidence_status: EvidenceStatus; source_url: string | null; source_note: string | null }

/** Everything the importer will write, already in database form */
export type NormalizedDraft = {
  organization: {
    name: string
    slug: string
    city: string | null
    secondary_city: string | null
    country: string
    founded_date: string | null
    first_seen_at: string | null
    website: string | null
    linkedin_url: string | null
    email: string | null
    phone: string | null
    description: string | null
    total_raised_eur: number | null
    last_round: string | null
    fundraising_status: string
  }
  profile: Record<
    | "product_description" | "target_market" | "competitive_landscape" | "technical_thesis"
    | "current_strategy" | "business_model_hypothesis" | "est_next_raise" | "fundraising_signal_summary"
    | "entity_complexity" | "investor_brief" | "analyst_note" | "ai_product_role" | "technology_positioning"
    | "technology_maturity" | "technology_differentiation",
    string | null
  >
  tags: { tag: string; strength: number }[]
  primaryLayer: ({ layer_id: string; label: string } & Evidence) | null
  secondaryLayers: ({ layer_id: string; label: string } & Evidence)[]
  terms: ({ term_id: string; label: string; facet: Facet; relationship_kind: RelationshipKind; is_core: boolean } & Evidence)[]
  claims: ({ claim: string; label: string } & Evidence)[]
  founders: {
    full_name: string
    role: string | null
    person: Record<string, string | number | boolean | null>
  }[]
  signals: { signal_type: string; signal_date: string | null; strength: number | null; title: string; description: string | null; source_url: string | null; source_name: string | null }[]
  grants: { grant_name: string; granting_body: string | null; amount_eur: number | null; awarded_date: string | null; program: string | null; description: string | null; source_url: string | null }[]
  fundingRounds: { stage: string; amount_eur: number | null; announced_date: string | null; is_estimated: boolean; notes: string | null; source_url: string | null; source_name: string | null }[]
  programs: { program_name: string; program_type: string; edition_label: string | null; year: number | null; membership_role: string | null }[]
  legalEntities: { legal_name: string; legal_form: string | null; siren: string | null; siret: string | null; capital_eur: number | null; incorporation_date: string | null; registered_city: string | null; naf_code: string | null; naf_label: string | null }[]
  sectors: { sector_id: string; name: string; is_primary: boolean }[]
}

export type ValidationResult = { draft: NormalizedDraft | null; errors: Issue[]; warnings: Issue[] }

// ------------------------------------------------------------------
// Finding the JSON in a pasted Claude reply
// ------------------------------------------------------------------

/**
 * Accepts either the bare JSON or a whole Claude reply. In a reply, the
 * fenced block that names the draft schema wins; otherwise the last
 * fenced JSON block; otherwise the outermost {...} in the text.
 */
export function extractDraftJson(text: string): { value: unknown } | { error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { error: "Paste the import block from the Claude draft." }
  const blocks = [...trimmed.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map((m) => m[1])
  const candidates = [
    ...blocks.filter((b) => b.includes(DRAFT_SCHEMA)),
    ...blocks.reverse(),
    trimmed,
    trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1),
  ]
  let lastError = ""
  for (const c of candidates) {
    if (!c.trim().startsWith("{")) continue
    try {
      return { value: JSON.parse(c) }
    } catch (e) {
      lastError = (e as Error).message
    }
  }
  return { error: `No valid JSON import block found${lastError ? ` (${lastError})` : ""}. Copy the whole block that starts with \`\`\`json.` }
}

// ------------------------------------------------------------------
// Value helpers
// ------------------------------------------------------------------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_-]+/g, " ").trim()

const UNKNOWN = new Set(["", "unknown", "n/a", "na", "none", "null", "tbd", "inconnu", "not stated", "not disclosed"])

/** Generates the URL slug the same way the admin form does */
export function slugify(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

class Reader {
  errors: Issue[] = []
  warnings: Issue[] = []

  warn(path: string, message: string) { this.warnings.push({ path, message }) }
  fail(path: string, message: string) { this.errors.push({ path, message }) }

  /** Trimmed text, or null for empty / "Unknown" */
  text(v: unknown, path: string, max?: number): string | null {
    if (v === null || v === undefined) return null
    if (typeof v === "number" || typeof v === "boolean") v = String(v)
    if (typeof v !== "string") { this.warn(path, "Expected text; ignored."); return null }
    const s = v.trim()
    if (UNKNOWN.has(s.toLowerCase())) return null
    if (max && s.length > max) { this.warn(path, `Longer than ${max} characters; shortened.`); return s.slice(0, max) }
    return s
  }

  /** Matches a stored value or its label, ignoring case, accents and separators */
  option(v: unknown, options: Option[], path: string, what: string): string | null {
    const s = this.text(v, path)
    if (s === null) return null
    const f = fold(s)
    const hit = options.find((o) => fold(o.value) === f || fold(o.label) === f)
    if (!hit) { this.warn(path, `"${s}" is not a valid ${what}; left empty. Allowed: ${options.map((o) => o.label).join(", ")}.`); return null }
    return hit.value
  }

  /** YYYY-MM-DD; a bare year or year-month becomes the first day, with a warning */
  date(v: unknown, path: string): string | null {
    const s = this.text(v, path)
    if (s === null) return null
    const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/)
    if (!m) { this.warn(path, `"${s}" is not a YYYY-MM-DD date; left empty.`); return null }
    const [, y, mo = "01", d = "01"] = m
    const iso = `${y}-${mo}-${d}`
    const parsed = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
      this.warn(path, `"${s}" is not a real date; left empty.`)
      return null
    }
    if (!m[3]) this.warn(path, `Only ${m[2] ? "year and month" : "the year"} known; stored as ${iso}.`)
    return iso
  }

  /** Whole euros from a number or text like "€2.5M", "2 500 000", "1,2 M€" */
  money(v: unknown, path: string): number | null {
    if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : (this.warn(path, "Not a valid amount; left empty."), null)
    const s = this.text(v, path)
    if (s === null) return null
    const m = s.replace(/[€\s]|eur(os?)?/gi, "").match(/^(\d+(?:[.,]\d+)*)([kmb])?$/i)
    if (!m) { this.warn(path, `"${s}" is not an amount in euros; left empty.`); return null }
    let digits = m[1]
    // "2,500,000" / "2.500.000" are thousand separators; "1,5" / "2.5" are decimals
    if (/^\d{1,3}([.,]\d{3})+$/.test(digits) && !m[2]) digits = digits.replace(/[.,]/g, "")
    const n = Number(digits.replace(",", ".")) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1)
    if (!Number.isFinite(n)) { this.warn(path, `"${s}" is not an amount; left empty.`); return null }
    if (typeof v === "string" && !/^\d+$/.test(v.trim())) this.warn(path, `Read "${s}" as ${Math.round(n)} EUR.`)
    return Math.round(n)
  }

  int(v: unknown, path: string, min: number, max: number): number | null {
    const s = typeof v === "number" ? String(v) : this.text(v, path)
    if (s === null) return null
    const n = Number(s)
    if (!Number.isInteger(n) || n < min || n > max) { this.warn(path, `"${s}" must be a whole number from ${min} to ${max}; left empty.`); return null }
    return n
  }

  bool(v: unknown, path: string): boolean | null {
    if (typeof v === "boolean") return v
    const s = this.text(v, path)
    if (s === null) return null
    if (/^(yes|oui|true|y)$/i.test(s)) return true
    if (/^(no|non|false|n)$/i.test(s)) return false
    this.warn(path, `"${s}" is not Yes or No; left empty.`)
    return null
  }

  url(v: unknown, path: string): string | null {
    const s = this.text(v, path)
    if (s === null) return null
    if (/^https?:\/\/\S+$/i.test(s)) return s
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) { this.warn(path, `Added https:// to "${s}".`); return `https://${s}` }
    this.warn(path, `"${s}" is not a web address; left empty.`)
    return null
  }

  list(v: unknown, path: string): unknown[] {
    if (v === null || v === undefined) return []
    if (Array.isArray(v)) return v
    this.warn(path, "Expected a list; ignored.")
    return []
  }

  obj(v: unknown, path: string): Obj {
    if (v === null || v === undefined) return {}
    if (isObj(v)) return v
    this.warn(path, "Expected an object; ignored.")
    return {}
  }

  evidence(o: Obj, path: string): Evidence {
    return {
      evidence_status: (this.option(o.evidence_status, EVIDENCE_STATUSES, `${path}.evidence_status`, "evidence status") as EvidenceStatus | null) ?? "unverified",
      source_url: this.url(o.source_url, `${path}.source_url`),
      source_note: this.text(o.source_note, `${path}.source_note`),
    }
  }
}

/** Finds a layer or term by slug, label or alias; reports alias matches */
function lookup<T extends { slug: string; label: string; aliases?: string[]; isActive: boolean }>(
  r: Reader, items: T[], raw: string, path: string, what: string,
): T | null {
  const f = fold(raw)
  const exact = items.find((i) => fold(i.slug) === f || fold(i.label) === f)
  const viaAlias = exact ? null : items.find((i) => (i.aliases ?? []).some((a) => fold(a) === f))
  const hit = exact ?? viaAlias
  if (!hit) { r.warn(path, `"${raw}" is not in the ${what} list; not imported.`); return null }
  if (!hit.isActive) { r.warn(path, `"${hit.label}" is a retired ${what}; not imported.`); return null }
  if (viaAlias) r.warn(path, `"${raw}" matched ${what} "${hit.label}" through a synonym; check it is right.`)
  return hit
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

export function validateDraft(raw: unknown, vocab: ImportVocab): ValidationResult {
  const r = new Reader()
  if (!isObj(raw)) return { draft: null, errors: [{ path: "", message: "The import block must be a JSON object." }], warnings: [] }
  if (raw.schema !== DRAFT_SCHEMA) {
    if (raw.schema === undefined) r.warn("schema", `No "schema" field; reading it as ${DRAFT_SCHEMA}.`)
    else return { draft: null, errors: [{ path: "schema", message: `Unsupported schema "${String(raw.schema)}"; expected ${DRAFT_SCHEMA}.` }], warnings: [] }
  }

  const company = r.obj(raw.company, "company")
  const product = r.obj(raw.product, "product")
  const technical = r.obj(raw.technical, "technical")
  const strategy = r.obj(raw.strategy, "strategy")
  const fundraising = r.obj(raw.fundraising, "fundraising")
  const legal = r.obj(raw.legal, "legal")
  const brief = r.obj(raw.investor_brief, "investor_brief")

  const name = r.text(company.name, "company.name")
  if (!name) r.fail("company.name", "Company name is required.")
  let slug = r.text(company.slug, "company.slug")
  if (slug && slug !== slugify(slug)) { r.warn("company.slug", `Slug "${slug}" cleaned to "${slugify(slug)}".`); slug = slugify(slug) }
  if (!slug && name) slug = slugify(name)
  if (name && !slug) r.fail("company.slug", "Could not build a URL slug from the name; add one.")

  const organization: NormalizedDraft["organization"] = {
    name: name ?? "",
    slug: slug ?? "",
    city: r.text(company.primary_city, "company.primary_city"),
    secondary_city: r.text(company.secondary_city, "company.secondary_city"),
    country: r.text(company.country, "company.country") ?? "France",
    founded_date: r.date(company.founded_date, "company.founded_date"),
    first_seen_at: r.date(company.first_seen_at, "company.first_seen_at"),
    website: r.url(company.website, "company.website"),
    linkedin_url: r.url(company.linkedin_url, "company.linkedin_url"),
    email: r.text(company.email, "company.email"),
    phone: r.text(company.phone, "company.phone"),
    description: r.text(company.description, "company.description"),
    total_raised_eur: r.money(fundraising.total_raised_eur, "fundraising.total_raised_eur"),
    last_round: r.text(fundraising.last_round, "fundraising.last_round"),
    fundraising_status: r.option(fundraising.fundraising_status, FUNDRAISING_STATUSES, "fundraising.fundraising_status", "fundraising status") ?? "unknown",
  }
  if (organization.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.email)) {
    r.warn("company.email", `"${organization.email}" is not an email address; left empty.`)
    organization.email = null
  }

  const profile: NormalizedDraft["profile"] = {
    product_description: r.text(product.product_description, "product.product_description"),
    target_market: r.text(product.target_market, "product.target_market"),
    competitive_landscape: r.text(product.competitive_landscape, "product.competitive_landscape"),
    technical_thesis: r.text(product.technical_thesis, "product.technical_thesis"),
    current_strategy: r.text(strategy.current_strategy, "strategy.current_strategy"),
    business_model_hypothesis: r.text(strategy.business_model_hypothesis, "strategy.business_model_hypothesis"),
    est_next_raise: r.text(fundraising.est_next_raise, "fundraising.est_next_raise"),
    fundraising_signal_summary: r.text(fundraising.fundraising_signal_summary, "fundraising.fundraising_signal_summary"),
    entity_complexity: r.text(legal.entity_complexity, "legal.entity_complexity"),
    investor_brief: r.text(brief.investor_brief, "investor_brief.investor_brief"),
    analyst_note: r.text(brief.analyst_note, "investor_brief.analyst_note"),
    ai_product_role: r.option(technical.ai_product_role, PRODUCT_ROLES, "technical.ai_product_role", "AI product role"),
    technology_positioning: r.option(technical.technology_positioning, POSITIONINGS, "technical.technology_positioning", "technology positioning"),
    technology_maturity: r.option(technical.technology_maturity, MATURITIES, "technical.technology_maturity", "technology maturity"),
    technology_differentiation: r.text(technical.technology_differentiation, "technical.technology_differentiation", 1000),
  }

  // Signal tags
  const tags: NormalizedDraft["tags"] = []
  r.list(raw.signal_tags, "signal_tags").forEach((t, i) => {
    const o = isObj(t) ? t : { tag: t }
    const tag = r.text(o.tag, `signal_tags[${i}].tag`)
    if (!tag) return
    if (tags.some((x) => fold(x.tag) === fold(tag))) { r.warn(`signal_tags[${i}]`, `Duplicate tag "${tag}"; kept once.`); return }
    const strength = r.option(o.strength, TAG_STRENGTHS, `signal_tags[${i}].strength`, "tag strength")
    tags.push({ tag, strength: Number(strength ?? 2) })
  })

  // Technical layers
  const layer = (v: unknown, path: string) => {
    const o = isObj(v) ? v : { layer: v }
    const label = r.text(o.layer, `${path}.layer`)
    if (!label) return null
    const hit = lookup(r, vocab.layers, label, `${path}.layer`, "technical layer")
    return hit ? { layer_id: hit.id, label: hit.label, ...r.evidence(o, path) } : null
  }
  const primaryLayer = layer(technical.primary_layer, "technical.primary_layer")
  const secondaryLayers: NormalizedDraft["secondaryLayers"] = []
  r.list(technical.secondary_layers, "technical.secondary_layers").forEach((v, i) => {
    const l = layer(v, `technical.secondary_layers[${i}]`)
    if (!l) return
    if (l.layer_id === primaryLayer?.layer_id) { r.warn(`technical.secondary_layers[${i}]`, `"${l.label}" is already the primary layer; skipped.`); return }
    if (secondaryLayers.some((x) => x.layer_id === l.layer_id)) { r.warn(`technical.secondary_layers[${i}]`, `Duplicate layer "${l.label}"; kept once.`); return }
    secondaryLayers.push(l)
  })

  // Technical terms, one list per facet
  const FACET_KEYS: Record<Facet, string> = { specialization: "specializations", method: "methods", modality: "modalities", domain: "domains" }
  const terms: NormalizedDraft["terms"] = []
  for (const { value: facet, label: facetLabel } of FACETS) {
    const key = FACET_KEYS[facet]
    const inFacet = vocab.terms.filter((t) => t.facet === facet)
    r.list(technical[key], `technical.${key}`).forEach((v, i) => {
      const path = `technical.${key}[${i}]`
      const o = isObj(v) ? v : { term: v }
      const label = r.text(o.term, `${path}.term`)
      if (!label) return
      const hit = lookup(r, inFacet, label, `${path}.term`, facetLabel.toLowerCase().replace(/s$/, ""))
      if (!hit) {
        const elsewhere = vocab.terms.find((t) => t.facet !== facet && (fold(t.label) === fold(label) || fold(t.slug) === fold(label)))
        if (elsewhere) r.warn(`${path}.term`, `"${label}" exists under ${FACETS.find((f) => f.value === elsewhere.facet)?.label}; move it there if that is what you meant.`)
        return
      }
      const kind = (r.option(o.relationship, RELATIONSHIP_KINDS, `${path}.relationship`, "relationship") as RelationshipKind | null)
        ?? (facet === "method" || facet === "modality" ? "uses" : "develops")
      if (terms.some((t) => t.term_id === hit.id && t.relationship_kind === kind)) { r.warn(path, `Duplicate "${hit.label}"; kept once.`); return }
      terms.push({ term_id: hit.id, label: hit.label, facet, relationship_kind: kind, is_core: r.bool(o.core, `${path}.core`) ?? false, ...r.evidence(o, path) })
    })
  }

  // Proprietary technology claims
  const claims: NormalizedDraft["claims"] = []
  r.list(technical.proprietary_technology, "technical.proprietary_technology").forEach((v, i) => {
    const path = `technical.proprietary_technology[${i}]`
    const o = isObj(v) ? v : { claim: v }
    const claim = r.option(o.claim, CLAIMS, `${path}.claim`, "proprietary technology claim")
    if (!claim) return
    if (claims.some((c) => c.claim === claim)) { r.warn(path, "Duplicate claim; kept once."); return }
    claims.push({ claim, label: CLAIMS.find((c) => c.value === claim)!.label, ...r.evidence(o, path) })
  })

  // Founders
  const founders: NormalizedDraft["founders"] = []
  r.list(raw.founders, "founders").forEach((v, i) => {
    const path = `founders[${i}]`
    const o = r.obj(v, path)
    const full_name = r.text(o.full_name, `${path}.full_name`)
    if (!full_name) { r.warn(path, "Founder without a full name; skipped."); return }
    if (founders.some((f) => fold(f.full_name) === fold(full_name))) { r.warn(path, `Duplicate founder "${full_name}"; kept once.`); return }
    founders.push({
      full_name,
      role: r.text(o.role, `${path}.role`),
      person: {
        full_name,
        first_name: r.text(o.first_name, `${path}.first_name`),
        last_name: r.text(o.last_name, `${path}.last_name`),
        email: r.text(o.email, `${path}.email`),
        linkedin_url: r.url(o.linkedin_url, `${path}.linkedin_url`),
        twitter_url: r.url(o.twitter_url, `${path}.twitter_url`),
        github_url: r.url(o.github_url, `${path}.github_url`),
        google_scholar_url: r.url(o.google_scholar_url, `${path}.google_scholar_url`),
        personal_website_url: r.url(o.personal_website_url, `${path}.personal_website_url`),
        photo_url: r.url(o.photo_url, `${path}.photo_url`),
        short_bio: r.text(o.short_bio, `${path}.short_bio`),
        bio: r.text(o.bio, `${path}.bio`),
        notable_publications: r.text(o.notable_publications, `${path}.notable_publications`),
        big_tech_employer: r.text(o.big_tech_employer, `${path}.big_tech_employer`),
        academic_lab: r.text(o.academic_lab, `${path}.academic_lab`),
        previous_exits: r.int(o.previous_exits, `${path}.previous_exits`, 0, 50) ?? 0,
        has_phd: r.bool(o.has_phd, `${path}.has_phd`) ?? false,
        is_repeat_founder: r.bool(o.is_repeat_founder, `${path}.is_repeat_founder`) ?? false,
        has_big_tech_background: r.bool(o.has_big_tech_background, `${path}.has_big_tech_background`) ?? false,
      },
    })
  })

  // Signals
  const signals: NormalizedDraft["signals"] = []
  r.list(raw.signals, "signals").forEach((v, i) => {
    const path = `signals[${i}]`
    const o = r.obj(v, path)
    const title = r.text(o.title, `${path}.title`)
    const signal_type = r.option(o.signal_type, SIGNAL_TYPES, `${path}.signal_type`, "signal type")
    if (!title || !signal_type) { r.warn(path, "Signal needs a title and a valid type; skipped."); return }
    signals.push({
      signal_type, title,
      signal_date: r.date(o.signal_date, `${path}.signal_date`),
      strength: r.int(o.strength, `${path}.strength`, 1, 5),
      description: r.text(o.description, `${path}.description`),
      source_url: r.url(o.source_url, `${path}.source_url`),
      source_name: r.text(o.source_name, `${path}.source_name`),
    })
  })

  // Grants
  const grants: NormalizedDraft["grants"] = []
  r.list(raw.grants, "grants").forEach((v, i) => {
    const path = `grants[${i}]`
    const o = r.obj(v, path)
    const grant_name = r.text(o.grant_name, `${path}.grant_name`)
    if (!grant_name) { r.warn(path, "Grant without a name; skipped."); return }
    grants.push({
      grant_name,
      granting_body: r.text(o.granting_body, `${path}.granting_body`),
      amount_eur: r.money(o.amount_eur, `${path}.amount_eur`),
      awarded_date: r.date(o.awarded_date, `${path}.awarded_date`),
      program: r.text(o.program, `${path}.program`),
      description: r.text(o.description, `${path}.description`),
      source_url: r.url(o.source_url, `${path}.source_url`),
    })
  })

  // Funding rounds
  const fundingRounds: NormalizedDraft["fundingRounds"] = []
  r.list(raw.funding_rounds, "funding_rounds").forEach((v, i) => {
    const path = `funding_rounds[${i}]`
    const o = r.obj(v, path)
    const stage = r.option(o.stage, FUNDING_STAGES, `${path}.stage`, "funding stage")
    if (!stage) { r.warn(path, "Funding round without a valid stage; skipped."); return }
    fundingRounds.push({
      stage,
      amount_eur: r.money(o.amount_eur, `${path}.amount_eur`),
      announced_date: r.date(o.announced_date, `${path}.announced_date`),
      is_estimated: r.bool(o.is_estimated, `${path}.is_estimated`) ?? false,
      notes: r.text(o.notes, `${path}.notes`),
      source_url: r.url(o.source_url, `${path}.source_url`),
      source_name: r.text(o.source_name, `${path}.source_name`),
    })
  })

  // Programs
  const programs: NormalizedDraft["programs"] = []
  r.list(raw.programs, "programs").forEach((v, i) => {
    const path = `programs[${i}]`
    const o = r.obj(v, path)
    const program_name = r.text(o.program_name, `${path}.program_name`)
    if (!program_name) { r.warn(path, "Program without a name; skipped."); return }
    const edition_label = r.text(o.edition_label, `${path}.edition_label`)
    if (programs.some((x) => fold(x.program_name) === fold(program_name) && fold(x.edition_label ?? "") === fold(edition_label ?? ""))) {
      r.warn(path, `Duplicate program "${program_name}"; kept once.`)
      return
    }
    programs.push({
      program_name,
      program_type: r.option(o.program_type, PROGRAM_TYPES, `${path}.program_type`, "program type") ?? "other",
      edition_label,
      year: r.int(o.year, `${path}.year`, 1990, 2100),
      membership_role: r.text(o.role, `${path}.role`),
    })
  })

  // Legal entities
  const legalEntities: NormalizedDraft["legalEntities"] = []
  r.list(raw.legal_entities, "legal_entities").forEach((v, i) => {
    const path = `legal_entities[${i}]`
    const o = r.obj(v, path)
    const legal_name = r.text(o.legal_name, `${path}.legal_name`)
    if (!legal_name) { r.warn(path, "Legal entity without a legal name; skipped."); return }
    const digits = (val: unknown, n: number, field: string) => {
      const s = r.text(val, `${path}.${field}`)
      if (s === null) return null
      const d = s.replace(/\s/g, "")
      if (!new RegExp(`^\\d{${n}}$`).test(d)) { r.warn(`${path}.${field}`, `"${s}" is not ${n} digits; left empty.`); return null }
      return d
    }
    const siren = digits(o.siren, 9, "siren")
    const siret = digits(o.siret, 14, "siret")
    if (siren && siret && !siret.startsWith(siren)) r.warn(`${path}.siret`, "SIRET does not start with the SIREN; check both.")
    legalEntities.push({
      legal_name, siren, siret,
      legal_form: r.text(o.legal_form, `${path}.legal_form`),
      capital_eur: r.money(o.capital_eur, `${path}.capital_eur`),
      incorporation_date: r.date(o.incorporation_date, `${path}.incorporation_date`),
      registered_city: r.text(o.registered_city, `${path}.registered_city`),
      naf_code: r.text(o.naf_code, `${path}.naf_code`),
      naf_label: r.text(o.naf_label, `${path}.naf_label`),
    })
  })

  // Sectors
  const sectorsIn = r.obj(raw.sectors, "sectors")
  const sectors: NormalizedDraft["sectors"] = []
  const addSector = (v: unknown, path: string, is_primary: boolean) => {
    const s = r.text(v, path)
    if (!s) return
    const hit = vocab.sectors.find((x) => fold(x.name) === fold(s))
    if (!hit) { r.warn(path, `"${s}" is not an existing sector; not imported (add it in the editor if needed).`); return }
    if (sectors.some((x) => x.sector_id === hit.id)) return
    sectors.push({ sector_id: hit.id, name: hit.name, is_primary })
  }
  addSector(sectorsIn.primary, "sectors.primary", true)
  r.list(sectorsIn.others, "sectors.others").forEach((v, i) => addSector(v, `sectors.others[${i}]`, false))

  const draft: NormalizedDraft = {
    organization, profile, tags, primaryLayer, secondaryLayers, terms, claims,
    founders, signals, grants, fundingRounds, programs, legalEntities, sectors,
  }
  return { draft: r.errors.length ? null : draft, errors: r.errors, warnings: r.warnings }
}
