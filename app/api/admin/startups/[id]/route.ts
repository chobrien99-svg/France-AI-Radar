import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { tags = [], ...fields } = body

  const supabase = await createServiceClient()

  const { data: startup, error } = await supabase
    .from("organizations")
    .update({
      name: fields.name,
      slug: fields.slug,
      country: fields.country || "France",
      status: fields.is_active !== false ? "active" : "inactive",
      website: fields.website_url || null,
      linkedin_url: fields.linkedin_url || null,
      email: fields.contact_email || null,
      phone: fields.contact_phone || null,
      description: fields.description || null,
      technology_layer: fields.technology_layer || null,
      total_raised_eur: fields.total_raised_eur ?? null,
      last_round: fields.last_round || null,
      fundraising_status: fields.fundraising_status || "unknown",
      founded_date: fields.founded_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, slug")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert profile fields to organization_profiles
  const profileFields = {
    organization_id: id,
    investor_brief: fields.investor_brief || null,
    analyst_note: fields.analyst_note || null,
    product_description: fields.product_description || null,
    target_market: fields.target_market || null,
    competitive_landscape: fields.competitive_landscape || null,
    current_strategy: fields.current_strategy || null,
    business_model_hypothesis: fields.business_model_hypothesis || null,
    technical_thesis: fields.technical_thesis || null,
    fundraising_signal_summary: fields.fundraising_signal_summary || null,
    est_next_raise: fields.est_next_raise || null,
    entity_complexity: fields.entity_complexity || null,
  }

  await supabase
    .from("organization_profiles")
    .upsert(profileFields, { onConflict: "organization_id" })

  // Re-sync tags: delete all, re-insert
  await supabase.from("organization_tags").delete().eq("organization_id", id)
  if (tags.length > 0) {
    await supabase.from("organization_tags").insert(
      tags.map((t: { label: string; strength: string }) => ({
        organization_id: id,
        tag: t.label,
        strength: t.strength === "strong" ? 5 : t.strength === "moderate" ? 3 : t.strength === "weak" ? 1 : 2,
      }))
    )
  }

  return NextResponse.json(startup)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("organizations")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ hidden: true })
}
