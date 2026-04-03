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
    supabase.from("organizations").select("*, organization_tags(tag, strength), organization_profiles(*)").eq("id", id).single(),
    supabase.from("organization_people").select("role, people(id, full_name, slug)").eq("organization_id", id),
    supabase.from("people").select("id, full_name, slug, role").order("full_name"),
  ])

  if (!startup) notFound()

  const linkedFounders = (linkedRaw ?? []).map((row: { role: string | null; people: unknown }) => {
    const f = row.people as { id: string; full_name: string; slug: string | null }
    return { id: f.id, name: f.full_name, slug: f.slug, role: row.role }
  })

  const allFounders = (allFoundersRaw ?? []).map((f: { id: string; full_name: string; slug: string | null; role: string | null }) => ({
    id: f.id, name: f.full_name, slug: f.slug, role: f.role,
  }))

  const tags: TagRow[] = (startup.organization_tags ?? []).map(
    (t: { tag: string; strength: number }) => ({
      tag: t.tag,
      strength: t.strength,
    })
  )

  const profile = Array.isArray(startup.organization_profiles)
    ? startup.organization_profiles[0]
    : startup.organization_profiles

  const initialValues: Partial<StartupFormValues> = {
    name: startup.name ?? "",
    slug: startup.slug ?? "",
    city: startup.city ?? "",
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
        startupId={id}
        linkedFounders={linkedFounders}
        allFounders={allFounders}
      />
    </div>
  )
}
