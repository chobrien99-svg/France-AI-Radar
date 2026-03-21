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

  // Create startup
  const { data: startup, error } = await supabase
    .from("startups")
    .insert({
      name: fields.name,
      slug: fields.slug,
      city: fields.city || null,
      country: fields.country || "France",
      sector: fields.sector,
      stage: fields.stage,
      founded_date: fields.founded_date || null,
      first_seen_at: fields.first_seen_at || null,
      incorporation_date: fields.incorporation_date || null,
      signal_source: fields.signal_source || null,
      is_active: fields.is_active ?? true,
      website_url: fields.website_url || null,
      linkedin_url: fields.linkedin_url || null,
      contact_email: fields.contact_email || null,
      contact_phone: fields.contact_phone || null,
      description: fields.description || null,
      investor_brief: fields.investor_brief || null,
      analyst_note: fields.analyst_note || null,
      product_description: fields.product_description || null,
      target_market: fields.target_market || null,
      competitive_landscape: fields.competitive_landscape || null,
      technology_layer: fields.technology_layer || null,
      product_modality: fields.product_modality || "software",
      technical_thesis: fields.technical_thesis || null,
      technology_stage: fields.technology_stage || null,
      startup_origin_type: fields.startup_origin_type || "new_startup",
      company_origin: fields.company_origin || null,
      current_strategy: fields.current_strategy || null,
      business_model_hypothesis: fields.business_model_hypothesis || null,
      total_raised_eur: fields.total_raised_eur ?? null,
      last_round: fields.last_round || null,
      est_next_raise: fields.est_next_raise || null,
      fundraising_status: fields.fundraising_status || "unknown",
      fundraising_signal_summary: fields.fundraising_signal_summary || null,
      funding_notes: fields.funding_notes || null,
      entity_complexity: fields.entity_complexity || null,
    })
    .select("id, slug")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert tags
  if (tags.length > 0) {
    await supabase.from("startup_tags").insert(
      tags.map((t: { label: string; strength: string }) => ({
        startup_id: startup.id,
        label: t.label,
        strength: t.strength,
      }))
    )
  }

  return NextResponse.json(startup, { status: 201 })
}
