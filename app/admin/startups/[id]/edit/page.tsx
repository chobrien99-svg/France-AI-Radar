import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { StartupForm, type StartupFormValues, type TagRow } from "@/components/admin/startup-form"
import { Button } from "@/components/ui/button"
import { DeleteStartupButton } from "@/components/admin/delete-startup-button"
import { LinkedFounders } from "@/components/admin/linked-founders"

export default async function EditStartupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createServiceClient()

  const [{ data: startup }, { data: linkedRaw }, { data: allFoundersRaw }] = await Promise.all([
    supabase.from("startups").select("*, startup_tags(label, strength)").eq("id", id).single(),
    supabase.from("startup_founders").select("role, founders(id, name, slug)").eq("startup_id", id),
    supabase.from("founders").select("id, name, slug, role").order("name"),
  ])

  if (!startup) notFound()

  const linkedFounders = (linkedRaw ?? []).map((row: { role: string | null; founders: unknown }) => {
    const f = row.founders as { id: string; name: string; slug: string | null }
    return { id: f.id, name: f.name, slug: f.slug, role: row.role }
  })

  const allFounders = (allFoundersRaw ?? []) as { id: string; name: string; slug: string | null; role: string | null }[]

  const tags: TagRow[] = (startup.startup_tags ?? []).map(
    (t: { label: string; strength: string }) => ({
      label: t.label,
      strength: t.strength as TagRow["strength"],
    })
  )

  const initialValues: Partial<StartupFormValues> = {
    name: startup.name ?? "",
    slug: startup.slug ?? "",
    city: startup.city ?? "",
    country: startup.country ?? "France",
    sector: startup.sector ?? "ai_agents",
    stage: startup.stage ?? "unknown",
    founded_date: startup.founded_date ?? "",
    first_seen_at: startup.first_seen_at ?? "",
    incorporation_date: startup.incorporation_date ?? "",
    signal_source: startup.signal_source ?? "",
    is_active: startup.is_active ?? true,
    website_url: startup.website_url ?? "",
    linkedin_url: startup.linkedin_url ?? "",
    contact_email: startup.contact_email ?? "",
    contact_phone: startup.contact_phone ?? "",
    description: startup.description ?? "",
    investor_brief: startup.investor_brief ?? "",
    analyst_note: startup.analyst_note ?? "",
    product_description: startup.product_description ?? "",
    target_market: startup.target_market ?? "",
    competitive_landscape: startup.competitive_landscape ?? "",
    technology_layer: startup.technology_layer ?? "",
    product_modality: startup.product_modality ?? "software",
    technical_thesis: startup.technical_thesis ?? "",
    technology_stage: startup.technology_stage ?? "",
    startup_origin_type: startup.startup_origin_type ?? "new_startup",
    company_origin: startup.company_origin ?? "",
    current_strategy: startup.current_strategy ?? "",
    business_model_hypothesis: startup.business_model_hypothesis ?? "",
    total_raised_eur: startup.total_raised_eur != null ? String(startup.total_raised_eur) : "",
    last_round: startup.last_round ?? "",
    est_next_raise: startup.est_next_raise ?? "",
    fundraising_status: startup.fundraising_status ?? "unknown",
    fundraising_signal_summary: startup.fundraising_signal_summary ?? "",
    funding_notes: startup.funding_notes ?? "",
    entity_complexity: startup.entity_complexity ?? "",
    siren: startup.siren ?? "",
    siret: startup.siret ?? "",
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Admin › Startups
          </p>
          <h1 className="mt-0.5 text-[24px] font-bold text-foreground">{startup.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`badge-signal ${startup.is_active ? "badge-signal-positive" : "badge-signal-neutral"}`}>
              {startup.is_active ? "Active" : "Hidden"}
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
        startupId={id}
        linkedFounders={linkedFounders}
        allFounders={allFounders}
      />
    </div>
  )
}
