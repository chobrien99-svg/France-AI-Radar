import type { SupabaseClient } from "@supabase/supabase-js"
import { loadVocabulary } from "@/lib/technical-profile"
import type { ImportVocab, Issue, NormalizedDraft } from "@/lib/startup-import"

// ------------------------------------------------------------------
// Database side of the draft import: vocabulary, duplicate checks and
// the write itself. Validation lives in lib/startup-import.ts.
// ------------------------------------------------------------------

type Row = Record<string, unknown>

/** funding_rounds.amount_eur is stored in millions (see the funding-rounds admin route) */
const FUNDING_AMOUNT_UNIT = 1_000_000

export async function loadImportVocab(svc: SupabaseClient): Promise<ImportVocab> {
  const [vocab, { data: sectorRows }] = await Promise.all([
    loadVocabulary(svc),
    svc.from("sectors").select("id, name").order("name"),
  ])
  return {
    layers: vocab.layers.map((l) => ({ id: l.id, slug: l.slug, label: l.label, isActive: l.isActive })),
    terms: vocab.terms.map((t) => ({ id: t.id, slug: t.slug, label: t.label, facet: t.facet, aliases: t.aliases, isActive: t.isActive })),
    sectors: ((sectorRows ?? []) as Row[]).map((s) => ({ id: s.id as string, name: s.name as string })),
  }
}

export type ExistingCheck = {
  errors: Issue[]
  warnings: Issue[]
  /** Founder index → existing person id (matched by LinkedIn URL) */
  founderMatches: Record<number, { id: string; slug: string | null }>
}

const domainOf = (url: string | null) => {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

/** Duplicates against what is already in the database */
export async function checkExisting(svc: SupabaseClient, draft: NormalizedDraft): Promise<ExistingCheck> {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const founderMatches: ExistingCheck["founderMatches"] = {}
  const { organization: org } = draft
  const domain = domainOf(org.website)
  const sirens = draft.legalEntities.map((e) => e.siren).filter((s): s is string => !!s)

  const [{ data: bySlug }, { data: byName }, { data: byDomain }, { data: bySiren }] = await Promise.all([
    svc.from("organizations").select("id, name, slug").eq("slug", org.slug).maybeSingle(),
    svc.from("organizations").select("id, name, slug").ilike("name", org.name).limit(3),
    domain ? svc.from("organizations").select("id, name, slug, website").ilike("website", `%${domain}%`).limit(3) : Promise.resolve({ data: [] }),
    sirens.length ? svc.from("legal_entities").select("siren, organizations(id, name, slug)").in("siren", sirens).limit(3) : Promise.resolve({ data: [] }),
  ])

  if (bySlug) errors.push({ path: "company.slug", message: `The slug "${org.slug}" is already used by ${bySlug.name} (/startup/${bySlug.slug}). Change the slug, or update that startup instead.` })
  for (const o of (byName ?? []) as Row[]) {
    if (o.id !== bySlug?.id) warnings.push({ path: "company.name", message: `A company named "${o.name}" already exists (/startup/${o.slug}). Make sure this is not a duplicate.` })
  }
  for (const o of (byDomain ?? []) as Row[]) {
    if (domainOf(o.website as string) === domain && o.id !== bySlug?.id) warnings.push({ path: "company.website", message: `${o.name} (/startup/${o.slug}) has the same website domain (${domain}).` })
  }
  for (const r of (bySiren ?? []) as Row[]) {
    const o = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as Row | null
    if (o) warnings.push({ path: "legal_entities", message: `SIREN ${r.siren} is already linked to ${o.name} (/startup/${o.slug}).` })
  }

  // Founders: reuse a profile with the same LinkedIn URL; warn on same name
  await Promise.all(draft.founders.map(async (f, i) => {
    const linkedin = f.person.linkedin_url as string | null
    if (linkedin) {
      const { data } = await svc.from("people").select("id, slug, full_name").eq("linkedin_url", linkedin).limit(1).maybeSingle()
      if (data) {
        founderMatches[i] = { id: data.id, slug: data.slug }
        warnings.push({ path: `founders[${i}]`, message: `${f.full_name} matches the existing profile "${data.full_name}" by LinkedIn URL; that profile will be linked, not duplicated or changed.` })
        return
      }
    }
    const { data: sameName } = await svc.from("people").select("id, slug").ilike("full_name", f.full_name).limit(1).maybeSingle()
    if (sameName) warnings.push({ path: `founders[${i}]`, message: `A person named ${f.full_name} already exists (/founder/${sameName.slug}). A new profile will be created; if it is the same person, link the existing one in the editor instead.` })
  }))

  return { errors, warnings, founderMatches }
}

/** Same slug rule as the admin startup routes; an existing slug (e.g. a differently accented spelling) is reused */
async function findOrCreateCity(svc: SupabaseClient, name: string, country: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const { data: existing } = await svc.from("cities").select("id").eq("name", name).limit(1).maybeSingle()
  if (existing) return existing.id
  const { data: sameSlug } = await svc.from("cities").select("id").eq("slug", slug).maybeSingle()
  if (sameSlug) return sameSlug.id
  const { data } = await svc.from("cities").insert({ name, slug, country }).select("id").single()
  return data?.id ?? null
}

async function uniquePersonSlug(svc: SupabaseClient, name: string): Promise<string> {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  for (let n = 0; ; n++) {
    const slug = n ? `${base}-${n}` : base
    const { data } = await svc.from("people").select("id").eq("slug", slug).maybeSingle()
    if (!data) return slug
  }
}

async function linkProgram(svc: SupabaseClient, organizationId: string, p: NormalizedDraft["programs"][number]) {
  const slug = p.program_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const { data: existing } = await svc.from("programs").select("id").eq("name", p.program_name).maybeSingle()
  const { data: sameSlug } = existing ? { data: null } : await svc.from("programs").select("id").eq("slug", slug).maybeSingle()
  let programId = (existing?.id ?? sameSlug?.id) as string | undefined
  if (!programId) {
    const { data, error } = await svc.from("programs").insert({ name: p.program_name, slug, program_type: p.program_type }).select("id").single()
    if (error) throw new Error(`Program "${p.program_name}": ${error.message}`)
    programId = data.id
  }
  const label = p.edition_label || p.program_name
  const { data: edition } = await svc.from("program_editions").select("id").eq("program_id", programId).eq("cohort_label", label).maybeSingle()
  let editionId = edition?.id as string | undefined
  if (!editionId) {
    const { data, error } = await svc.from("program_editions").insert({ program_id: programId, name: label, cohort_label: label, year: p.year }).select("id").single()
    if (error) throw new Error(`Program edition "${label}": ${error.message}`)
    editionId = data.id
  }
  const { error } = await svc.from("program_organizations").insert({ program_edition_id: editionId, organization_id: organizationId, membership_role: p.membership_role })
  if (error) throw new Error(`Program link "${p.program_name}": ${error.message}`)
}

export type WriteResult = { ok: true; id: string; slug: string } | { ok: false; error: string }

/**
 * Creates the startup as a Draft with everything in the import. All-or-
 * nothing: if any step fails, the new organization is deleted (its links
 * cascade) along with any founder profiles this import created.
 */
export async function writeDraft(svc: SupabaseClient, draft: NormalizedDraft, founderMatches: ExistingCheck["founderMatches"]): Promise<WriteResult> {
  const { organization: org } = draft
  const createdPeople: string[] = []
  let orgId: string | null = null

  const must = <T>(res: { data: T; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`)
    return res.data
  }

  try {
    const [cityId, secondaryCityId] = await Promise.all([
      org.city ? findOrCreateCity(svc, org.city, org.country) : null,
      org.secondary_city ? findOrCreateCity(svc, org.secondary_city, org.country) : null,
    ])

    const created = must(
      await svc
        .from("organizations")
        .insert({
          organization_type: "startup",
          status: "draft",
          name: org.name,
          slug: org.slug,
          country: org.country,
          city_id: cityId,
          secondary_city_id: secondaryCityId,
          founded_date: org.founded_date,
          first_seen_at: new Date(`${org.first_seen_at}T00:00:00Z`).toISOString(),
          website: org.website,
          linkedin_url: org.linkedin_url,
          email: org.email,
          phone: org.phone,
          description: org.description,
          total_raised_eur: org.total_raised_eur,
          last_round: org.last_round,
          fundraising_status: org.fundraising_status,
        })
        .select("id, slug")
        .single(),
      "Startup",
    ) as { id: string; slug: string }
    orgId = created.id
    const organization_id = orgId

    must(await svc.from("organization_profiles").upsert({ organization_id, ...draft.profile }, { onConflict: "organization_id" }), "Profile")

    const { data: product } = await svc.from("product_catalog").select("id").eq("slug", "ai-radar").maybeSingle()
    if (product) must(await svc.from("product_organizations").insert({ product_id: product.id, organization_id }), "AI Radar membership")

    if (draft.tags.length) must(await svc.from("organization_tags").insert(draft.tags.map((t) => ({ organization_id, ...t }))), "Signal tags")
    if (draft.sectors.length) must(await svc.from("organization_sectors").insert(draft.sectors.map((s) => ({ organization_id, sector_id: s.sector_id, is_primary: s.is_primary }))), "Sectors")

    // Technical classification
    const evidence = (e: { evidence_status: string; source_url: string | null; source_note: string | null }) =>
      ({ evidence_status: e.evidence_status, source_url: e.source_url, source_note: e.source_note })
    const layers = [
      ...(draft.primaryLayer ? [{ ...draft.primaryLayer, is_primary: true }] : []),
      ...draft.secondaryLayers.map((l) => ({ ...l, is_primary: false })),
    ].map((l) => ({ organization_id, layer_id: l.layer_id, is_primary: l.is_primary, ...evidence(l) }))
    if (layers.length) must(await svc.from("organization_technical_layers").insert(layers), "Technical layers")
    if (draft.terms.length) {
      must(
        await svc.from("organization_technical_terms").insert(draft.terms.map((t) => ({
          organization_id, term_id: t.term_id, relationship_kind: t.relationship_kind, is_core: t.is_core, ...evidence(t),
        }))),
        "Technical terms",
      )
    }
    if (draft.claims.length) must(await svc.from("organization_technology_claims").insert(draft.claims.map((c) => ({ organization_id, claim: c.claim, ...evidence(c) }))), "Proprietary technology")

    // Founders
    for (const [i, f] of draft.founders.entries()) {
      let personId = founderMatches[i]?.id
      if (!personId) {
        const slug = await uniquePersonSlug(svc, f.full_name)
        const person = must(await svc.from("people").insert({ ...f.person, slug }).select("id").single(), `Founder ${f.full_name}`) as { id: string }
        personId = person.id
        createdPeople.push(personId)
      }
      must(
        await svc.from("organization_people").insert({ organization_id, person_id: personId, role: f.role, is_founder: true, is_current: true }),
        `Founder link ${f.full_name}`,
      )
    }

    if (draft.signals.length) {
      must(await svc.from("signals").insert(draft.signals.map((s) => ({ organization_id, ...s }))), "Signals")
      const latest = draft.signals.map((s) => s.signal_date).filter(Boolean).sort().at(-1) ?? null
      must(await svc.from("organizations").update({ signal_count: draft.signals.length, last_signal_date: latest }).eq("id", organization_id), "Signal count")
    }
    if (draft.grants.length) must(await svc.from("grants").insert(draft.grants.map((g) => ({ organization_id, ...g }))), "Grants")
    if (draft.fundingRounds.length) {
      must(
        await svc.from("funding_rounds").insert(draft.fundingRounds.map((r) => ({
          organization_id, ...r, amount_eur: r.amount_eur === null ? null : r.amount_eur / FUNDING_AMOUNT_UNIT,
        }))),
        "Funding rounds",
      )
    }
    for (const p of draft.programs) await linkProgram(svc, organization_id, p)
    if (draft.legalEntities.length) must(await svc.from("legal_entities").insert(draft.legalEntities.map((e) => ({ organization_id, ...e }))), "Legal entities")

    return { ok: true, id: created.id, slug: created.slug }
  } catch (e) {
    // Undo: the organization's links cascade; founder profiles created here are removed too
    if (orgId) await svc.from("organizations").delete().eq("id", orgId)
    if (createdPeople.length) await svc.from("people").delete().in("id", createdPeople)
    return { ok: false, error: `${(e as Error).message}. Nothing was saved.` }
  }
}
