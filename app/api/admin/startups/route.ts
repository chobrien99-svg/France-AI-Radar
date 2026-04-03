import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { tags = [], ...fields } = body

  const supabase = await createServiceClient()

  // Create organization
  const { data: startup, error } = await supabase
    .from("organizations")
    .insert({
      organization_type: "startup",
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
    })
    .select("id, slug")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert profile fields to organization_profiles
  const profileFields = {
    organization_id: startup.id,
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

  // Insert tags
  if (tags.length > 0) {
    await supabase.from("organization_tags").insert(
      tags.map((t: { label: string; strength: string }) => ({
        organization_id: startup.id,
        tag: t.label,
        strength: t.strength === "strong" ? 5 : t.strength === "moderate" ? 3 : t.strength === "weak" ? 1 : 2,
      }))
    )
  }

  // Assign to AI Radar product
  const { data: product } = await supabase
    .from("product_catalog")
    .select("id")
    .eq("slug", "ai-radar")
    .single()

  if (product) {
    await supabase
      .from("product_organizations")
      .insert({ product_id: product.id, organization_id: startup.id })
  }

  return NextResponse.json(startup, { status: 201 })
}
