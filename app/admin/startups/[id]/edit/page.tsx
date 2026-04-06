import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { StartupForm, type StartupFormValues, type TagRow } from "@/components/admin/startup-form"
import { Button } from "@/components/ui/button"
import { DeleteStartupButton } from "@/components/admin/delete-startup-button"
import { LinkedFounders } from "@/components/admin/linked-founders"
import { LinkedGrants } from "@/components/admin/linked-grants"
import { LinkedFundingRounds } from "@/components/admin/linked-funding-rounds"
import { LinkedPrograms } from "@/components/admin/linked-programs"
import { LinkedLegalEntities } from "@/components/admin/linked-legal-entities"
import { LinkedSectors } from "@/components/admin/linked-sectors"

export default async function EditStartupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createServiceClient()

  const [
    { data: startup },
    { data: linkedRaw },
    { data: allFoundersRaw },
    { data: grantsRaw },
    { data: fundingRoundsRaw },
    { data: programLinksRaw },
    { data: legalEntitiesRaw },
    { data: sectorLinksRaw },
    { data: allSectorsRaw },
  ] = await Promise.all([
    supabase.from("organizations").select("*, cities(name), organization_tags(tag, strength), organization_profiles(*)").eq("id", id).single(),
    supabase.from("organization_people").select("role, people(id, full_name, slug)").eq("organization_id", id),
    supabase.from("people").select("id, full_name, slug, role").order("full_name"),
    supabase.from("grants").select("*").eq("organization_id", id).order("awarded_date", { ascending: false }),
    supabase.from("funding_rounds").select("*").eq("organization_id", id).order("announced_date", { ascending: false }),
    supabase.from("program_organizations").select("id, membership_role, program_editions(name, cohort_label, year, programs(name, program_type))").eq("organization_id", id),
    supabase.from("legal_entities").select("*").eq("organization_id", id),
    supabase.from("organization_sectors").select("id, is_primary, sectors(name)").eq("organization_id", id),
    supabase.from("sectors").select("id, name").order("name"),
  ])

  if (!startup) notFound()

  const linkedFounders = (linkedRaw ?? []).map((row: { role: string | null; people: unknown }) => {
    const f = row.people as { id: string; full_name: string; slug: string | null }
    return { id: f.id, full_name: f.full_name, slug: f.slug, role: row.role }
  })

  const allFounders = (allFoundersRaw ?? []).map((f: { id: string; full_name: string; slug: string | null; role: string | null }) => ({
    id: f.id, full_name: f.full_name, slug: f.slug, role: f.role,
  }))

  const tags: TagRow[] = (startup.organization_tags ?? []).map(
    (t: { tag: string; strength: number }) => ({ tag: t.tag, strength: t.strength })
  )

  const grants = (grantsRaw ?? []) as Array<{
    id: string; grant_name: string; granting_body: string | null;
    amount_eur: number | null; awarded_date: string | null;
    program: string | null; description: string | null; source_url: string | null
  }>

  const fundingRounds = (fundingRoundsRaw ?? []) as Array<{
    id: string; stage: string; amount_eur: number | null;
    announced_date: string | null; source_url: string | null;
    source_name: string | null; notes: string | null; is_estimated: boolean
  }>

  const programLinks = (programLinksRaw ?? []).map((row: {
    id: string; membership_role: string | null;
    program_editions: { name: string | null; cohort_label: string | null; year: number | null; programs: { name: string; program_type: string } | null } | null
  }) => ({
    id: row.id,
    program_name: row.program_editions?.programs?.name ?? "Unknown",
    program_type: row.program_editions?.programs?.program_type ?? "other",
    edition_label: row.program_editions?.cohort_label ?? row.program_editions?.name ?? null,
    year: row.program_editions?.year ?? null,
    membership_role: row.membership_role,
  }))

  const legalEntities = (legalEntitiesRaw ?? []) as Array<{
    id: string; legal_name: string; legal_form: string | null;
    siren: string | null; siret: string | null; capital_eur: number | null;
    incorporation_date: string | null; registered_city: string | null;
    naf_code: string | null; naf_label: string | null
  }>

  const sectorLinks = (sectorLinksRaw ?? []).map((row: {
    id: string; is_primary: boolean; sectors: { name: string } | null
  }) => ({
    id: row.id,
    sector_name: row.sectors?.name ?? "Unknown",
    is_primary: row.is_primary,
  }))

  const allSectors = (allSectorsRaw ?? []) as Array<{ id: string; name: string }>

  const profile = Array.isArray(startup.organization_profiles)
    ? startup.organization_profiles[0]
    : startup.organization_profiles

  const initialValues: Partial<StartupFormValues> = {
    name: startup.name ?? "",
    slug: startup.slug ?? "",
    city: (startup.cities as { name: string } | null)?.name ?? "",
    country: startup.country ?? "France",
    founded_date: startup.founded_date ?? "",
    first_seen_at: startup.first_seen_at ?? "",
    status: startup.status ?? "active",
    website: startup.website ?? "",
    linkedin_url: startup.linkedin_url ?? "",
    email: startup.email ?? "",
    phone: startup.phone ?? "",
    description: startup.description ?? "",
    product_description: profile?.product_description ?? "",
    target_market: profile?.target_market ?? "",
    competitive_landscape: profile?.competitive_landscape ?? "",
    technology_layer: startup.technology_layer ?? "",
    technical_thesis: profile?.technical_thesis ?? "",
    current_strategy: profile?.current_strategy ?? "",
    business_model_hypothesis: profile?.business_model_hypothesis ?? "",
    total_raised_eur: startup.total_raised_eur != null ? String(startup.total_raised_eur) : "",
    last_round: startup.last_round ?? "",
    est_next_raise: profile?.est_next_raise ?? "",
    fundraising_status: startup.fundraising_status ?? "unknown",
    fundraising_signal_summary: profile?.fundraising_signal_summary ?? "",
    entity_complexity: profile?.entity_complexity ?? "",
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Admin › Startups
          </p>
          <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">{startup.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`badge-signal ${startup.status === "active" ? "badge-signal-positive" : "badge-signal-neutral"}`}>
              {startup.status === "active" ? "Active" : "Hidden"}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/startup/${startup.slug}`} target="_blank">
                View live →
              </Link>
            </Button>
          </div>
        </div>
        <DeleteStartupButton startupId={id} startupName={startup.name} />
      </div>

      <StartupForm
        initialValues={initialValues}
        initialTags={tags}
        startupId={id}
      />

      <LinkedFounders
        organizationId={id}
        linkedPeople={linkedFounders}
        allPeople={allFounders}
      />

      <LinkedGrants
        organizationId={id}
        grants={grants}
      />

      <LinkedFundingRounds
        organizationId={id}
        rounds={fundingRounds}
      />

      <LinkedPrograms
        organizationId={id}
        programs={programLinks}
      />

      <LinkedLegalEntities
        organizationId={id}
        entities={legalEntities}
      />

      <LinkedSectors
        organizationId={id}
        sectors={sectorLinks}
        allSectors={allSectors}
      />
    </div>
  )
}
