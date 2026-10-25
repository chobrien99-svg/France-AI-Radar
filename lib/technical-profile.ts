import type { SupabaseClient } from "@supabase/supabase-js"
import type { EvidenceStatus, Facet, RelationshipKind, TechLayer, TechTerm } from "@/lib/taxonomy"

// ------------------------------------------------------------------
// Loading the technical taxonomy and one organization's classification.
// Shared by the startup page, the admin editor and the CSV export.
// ------------------------------------------------------------------

type Row = Record<string, unknown>

export type Evidence = {
  evidenceStatus: EvidenceStatus
  sourceUrl: string | null
  sourceNote: string | null
}

export type LayerLink = Evidence & { id: string; isPrimary: boolean; layer: TechLayer }
export type TermLink = Evidence & { id: string; kind: RelationshipKind; isCore: boolean; term: TechTerm }
export type ClaimLink = Evidence & { id: string; claim: string }

export type TechnicalProfile = {
  primary: LayerLink | null
  secondary: LayerLink[]
  terms: TermLink[]
  claims: ClaimLink[]
}

export type Vocabulary = { layers: TechLayer[]; terms: TechTerm[] }

function toLayer(r: Row): TechLayer {
  return {
    id: r.id as string,
    slug: r.slug as string,
    label: r.label as string,
    description: (r.description as string | null) ?? null,
    isActive: (r.is_active as boolean | null) ?? true,
  }
}

function toEvidence(r: Row): Evidence {
  return {
    evidenceStatus: (r.evidence_status as EvidenceStatus | null) ?? "unverified",
    sourceUrl: (r.source_url as string | null) ?? null,
    sourceNote: (r.source_note as string | null) ?? null,
  }
}

/** Every layer and term (retired ones included, flagged), in display order, with aliases */
export async function loadVocabulary(svc: SupabaseClient): Promise<Vocabulary> {
  const [{ data: layerRows }, { data: termRows }, { data: aliasRows }] = await Promise.all([
    svc.from("technical_layers").select("id, slug, label, description, is_active").order("display_order"),
    svc.from("technical_terms").select("id, slug, label, definition, facet, family, parent_term_id, is_active").order("display_order"),
    svc.from("technical_term_aliases").select("term_id, alias"),
  ])
  const aliases = new Map<string, string[]>()
  for (const a of (aliasRows ?? []) as Row[]) {
    const id = a.term_id as string
    aliases.set(id, [...(aliases.get(id) ?? []), a.alias as string])
  }
  const slugById = new Map(((termRows ?? []) as Row[]).map((t) => [t.id as string, t.slug as string]))
  const terms: TechTerm[] = ((termRows ?? []) as Row[]).map((t) => ({
    id: t.id as string,
    slug: t.slug as string,
    label: t.label as string,
    definition: (t.definition as string | null) ?? null,
    facet: t.facet as Facet,
    family: (t.family as string | null) ?? null,
    parentSlug: t.parent_term_id ? slugById.get(t.parent_term_id as string) ?? null : null,
    isActive: (t.is_active as boolean | null) ?? true,
    aliases: aliases.get(t.id as string) ?? [],
  }))
  return { layers: ((layerRows ?? []) as Row[]).map(toLayer), terms }
}

/** One organization's layers, terms and claims. Missing tables or rows give an empty profile. */
export async function loadTechnicalProfile(svc: SupabaseClient, organizationId: string, vocab?: Vocabulary): Promise<TechnicalProfile> {
  const [v, { data: layerRows }, { data: termRows }, { data: claimRows }] = await Promise.all([
    vocab ?? loadVocabulary(svc),
    svc.from("organization_technical_layers").select("id, layer_id, is_primary, evidence_status, source_url, source_note").eq("organization_id", organizationId),
    svc.from("organization_technical_terms").select("id, term_id, relationship_kind, is_core, evidence_status, source_url, source_note").eq("organization_id", organizationId),
    svc.from("organization_technology_claims").select("id, claim, evidence_status, source_url, source_note").eq("organization_id", organizationId),
  ])
  const layerById = new Map(v.layers.map((l) => [l.id, l]))
  const termById = new Map(v.terms.map((t) => [t.id, t]))
  const order = new Map(v.terms.map((t, i) => [t.id, i]))

  const layers: LayerLink[] = []
  for (const r of (layerRows ?? []) as Row[]) {
    const layer = layerById.get(r.layer_id as string)
    if (layer) layers.push({ id: r.id as string, isPrimary: !!r.is_primary, layer, ...toEvidence(r) })
  }
  const layerOrder = new Map(v.layers.map((l, i) => [l.id, i]))
  layers.sort((a, b) => layerOrder.get(a.layer.id)! - layerOrder.get(b.layer.id)!)

  const terms: TermLink[] = []
  for (const r of (termRows ?? []) as Row[]) {
    const term = termById.get(r.term_id as string)
    if (term) terms.push({ id: r.id as string, kind: r.relationship_kind as RelationshipKind, isCore: !!r.is_core, term, ...toEvidence(r) })
  }
  terms.sort((a, b) => order.get(a.term.id)! - order.get(b.term.id)!)

  return {
    primary: layers.find((l) => l.isPrimary) ?? null,
    secondary: layers.filter((l) => !l.isPrimary),
    terms,
    claims: ((claimRows ?? []) as Row[]).map((r) => ({ id: r.id as string, claim: r.claim as string, ...toEvidence(r) })),
  }
}

/** Labels of a profile's terms in one facet, e.g. for chips or a CSV cell */
export function termLabels(profile: TechnicalProfile, facet: Facet): string[] {
  return profile.terms.filter((t) => t.term.facet === facet).map((t) => t.term.label)
}

export type TechnicalIndex = {
  vocab: Vocabulary
  /** Per organization: primary layer, secondary layers and terms */
  byOrg: Map<string, { primary: TechLayer | null; secondary: TechLayer[]; terms: { term: TechTerm; kind: RelationshipKind }[] }>
}

/** For the Database: the vocabulary plus every listed organization's classification, in one pass */
export async function loadTechnicalIndex(svc: SupabaseClient, organizationIds: string[]): Promise<TechnicalIndex> {
  const [vocab, { data: layerRows }, { data: termRows }] = await Promise.all([
    loadVocabulary(svc),
    svc.from("organization_technical_layers").select("organization_id, layer_id, is_primary").in("organization_id", organizationIds),
    svc.from("organization_technical_terms").select("organization_id, term_id, relationship_kind").in("organization_id", organizationIds),
  ])
  const layerById = new Map(vocab.layers.map((l) => [l.id, l]))
  const termById = new Map(vocab.terms.map((t) => [t.id, t]))
  const byOrg: TechnicalIndex["byOrg"] = new Map()
  const entry = (orgId: string) => {
    let e = byOrg.get(orgId)
    if (!e) byOrg.set(orgId, (e = { primary: null, secondary: [], terms: [] }))
    return e
  }
  for (const r of (layerRows ?? []) as Row[]) {
    const layer = layerById.get(r.layer_id as string)
    if (!layer) continue
    const e = entry(r.organization_id as string)
    if (r.is_primary) e.primary = layer
    else e.secondary.push(layer)
  }
  for (const r of (termRows ?? []) as Row[]) {
    const term = termById.get(r.term_id as string)
    if (term) entry(r.organization_id as string).terms.push({ term, kind: r.relationship_kind as RelationshipKind })
  }
  return { vocab, byOrg }
}
