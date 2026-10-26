// ------------------------------------------------------------------
// Technical taxonomy: labels for the controlled values stored in the
// database, and the filter semantics used by the Database page and
// the CSV export. Spec: docs/technical-taxonomy.md
//
// Kept free of "@/..." imports so `npm test` can run it with plain Node.
// ------------------------------------------------------------------

export type Facet = "specialization" | "method" | "modality" | "domain"
export type RelationshipKind = "develops" | "uses" | "researches"
export type EvidenceStatus = "verified" | "reported" | "inferred" | "unverified"

/** Facets in display order, with their UI labels and URL filter keys */
export const FACETS: { value: Facet; label: string; param: string }[] = [
  { value: "specialization", label: "Technical specializations", param: "spec" },
  { value: "method", label: "Core AI methods", param: "method" },
  { value: "modality", label: "Data modalities", param: "modality" },
  { value: "domain", label: "Target domains", param: "domain" },
]

/** Specialization families, in display order. Unknown families fall back to their slug. */
export const FAMILIES: { value: string; label: string }[] = [
  { value: "foundation_models", label: "Foundation models & architectures" },
  { value: "agents", label: "Agents & agentic systems" },
  { value: "data_knowledge_reasoning", label: "Data, knowledge & reasoning" },
  { value: "infrastructure_optimization", label: "Infrastructure & optimization" },
  { value: "science_biology_healthcare", label: "Science, biology & healthcare" },
  { value: "physical_ai_industrial", label: "Physical AI & industrial intelligence" },
]

export function familyLabel(family: string | null): string {
  if (!family) return "Other"
  return FAMILIES.find((f) => f.value === family)?.label ?? family.replace(/_/g, " ")
}

export const RELATIONSHIP_KINDS: { value: RelationshipKind; label: string }[] = [
  { value: "develops", label: "Develops" },
  { value: "uses", label: "Uses" },
  { value: "researches", label: "Researches" },
]

export const EVIDENCE_STATUSES: { value: EvidenceStatus; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "reported", label: "Reported" },
  { value: "inferred", label: "Inferred" },
  { value: "unverified", label: "Unverified" },
]

export const PRODUCT_ROLES = [
  { value: "infrastructure", label: "Infrastructure" },
  { value: "platform", label: "Platform" },
  { value: "application", label: "Application" },
]

export const POSITIONINGS = [
  { value: "frontier_technology_developer", label: "Frontier technology developer" },
  { value: "enabling_infrastructure", label: "Enabling infrastructure" },
  { value: "ai_native_platform", label: "AI-native platform" },
  { value: "vertical_ai_application", label: "Vertical AI application" },
  { value: "ai_enabled_software", label: "AI-enabled software" },
  { value: "research_commercialization", label: "Research commercialization" },
]

export const MATURITIES = [
  { value: "research", label: "Research" },
  { value: "prototype", label: "Prototype" },
  { value: "beta", label: "Beta" },
  { value: "commercial", label: "Commercial" },
]

export const CLAIMS = [
  { value: "own_model", label: "Own model" },
  { value: "proprietary_dataset", label: "Proprietary dataset" },
  { value: "proprietary_algorithm", label: "Proprietary algorithm" },
  { value: "patented_technology", label: "Patented technology" },
  { value: "proprietary_hardware", label: "Proprietary hardware" },
  { value: "open_source_core", label: "Open-source core" },
  { value: "third_party_models_only", label: "Third-party models only" },
]

/** Label for a stored value, or null when unset/unknown */
export function labelFor(options: { value: string; label: string }[], value: string | null | undefined): string | null {
  if (!value) return null
  return options.find((o) => o.value === value)?.label ?? value
}

// ------------------------------------------------------------------
// Vocabulary as loaded from the database
// ------------------------------------------------------------------

export type TechLayer = {
  id: string
  slug: string
  label: string
  description: string | null
  isActive: boolean
}

export type TechTerm = {
  id: string
  slug: string
  label: string
  definition: string | null
  facet: Facet
  family: string | null
  parentSlug: string | null
  isActive: boolean
  aliases: string[]
}

// ------------------------------------------------------------------
// Filtering
// ------------------------------------------------------------------

/** Filter value meaning "nothing recorded for this dimension" */
export const UNCLASSIFIED = "none"

/** A startup's technical classification, reduced to what filters need */
export type StartupTech = {
  primaryLayer: string | null
  secondaryLayers: string[]
  terms: { slug: string; facet: Facet; kind: RelationshipKind }[]
}

export type TechSelection = {
  layer: string[]
  /** Also match secondary layers, not just the primary one */
  includeSecondary: boolean
  /** Specializations and methods only match when developed or researched, not merely used */
  developsOnly: boolean
  spec: string[]
  method: string[]
  modality: string[]
  domain: string[]
}

export const EMPTY_TECH_SELECTION: TechSelection = {
  layer: [], includeSecondary: false, developsOnly: false, spec: [], method: [], modality: [], domain: [],
}

/** Map of term slug → slugs of its direct children */
export function childrenIndex(terms: Pick<TechTerm, "slug" | "parentSlug">[]): Map<string, string[]> {
  const kids = new Map<string, string[]>()
  for (const t of terms) {
    if (!t.parentSlug) continue
    kids.set(t.parentSlug, [...(kids.get(t.parentSlug) ?? []), t.slug])
  }
  return kids
}

/** Selected slugs plus every narrower term beneath them (AI Agents → Coding Agents, …) */
export function withDescendants(selected: string[], kids: Map<string, string[]>): Set<string> {
  const out = new Set<string>()
  const queue = [...selected]
  while (queue.length) {
    const slug = queue.pop()!
    if (out.has(slug)) continue
    out.add(slug)
    queue.push(...(kids.get(slug) ?? []))
  }
  return out
}

function layerMatches(tech: StartupTech, selected: string[], includeSecondary: boolean): boolean {
  if (selected.length === 0) return true
  const layers = includeSecondary
    ? [tech.primaryLayer, ...tech.secondaryLayers].filter((l): l is string => !!l)
    : tech.primaryLayer ? [tech.primaryLayer] : []
  if (selected.includes(UNCLASSIFIED) && layers.length === 0) return true
  return layers.some((l) => selected.includes(l))
}

/** Does one facet match? Within a facet, any selected value matches (OR). */
export function facetMatches(
  tech: StartupTech,
  facet: Facet,
  selected: string[],
  kids: Map<string, string[]>,
  developsOnly = false,
): boolean {
  if (selected.length === 0) return true
  const inFacet = tech.terms.filter((t) => t.facet === facet)
  if (selected.includes(UNCLASSIFIED) && inFacet.length === 0) return true
  const strict = developsOnly && (facet === "specialization" || facet === "method")
  const wanted = withDescendants(selected.filter((s) => s !== UNCLASSIFIED), kids)
  return inFacet.some((t) => wanted.has(t.slug) && (!strict || t.kind !== "uses"))
}

/** Every technical filter at once. Across facets, all must match (AND). */
export function techMatches(tech: StartupTech, sel: TechSelection, kids: Map<string, string[]>): boolean {
  return (
    layerMatches(tech, sel.layer, sel.includeSecondary) &&
    facetMatches(tech, "specialization", sel.spec, kids, sel.developsOnly) &&
    facetMatches(tech, "method", sel.method, kids, sel.developsOnly) &&
    facetMatches(tech, "modality", sel.modality, kids) &&
    facetMatches(tech, "domain", sel.domain, kids)
  )
}
