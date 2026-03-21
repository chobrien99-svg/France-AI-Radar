import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getExportLimit, sectorLabel, stageLabel, SIGNAL_SOURCE_LABELS } from "@/lib/subscription"

export const runtime = "nodejs"

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = Array.isArray(value) ? value.join("; ") : String(value)
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvRow(headers: string[], values: Record<string, unknown>): string {
  return headers.map((h) => csvEscape(values[h])).join(",")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch profile for tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single()

  const tier = profile?.subscription_tier ?? "free"
  const limit = getExportLimit(tier)

  if (limit === 0) {
    return NextResponse.json(
      { error: "CSV export is not available on the Free plan. Upgrade to Explorer or Professional." },
      { status: 403 }
    )
  }

  // Check current period usage before incrementing
  const period = currentPeriod()
  if (limit !== null) {
    const { data: usage } = await supabase
      .from("export_usage")
      .select("export_count")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle()

    const used = usage?.export_count ?? 0
    if (used >= limit) {
      return NextResponse.json(
        { error: `Monthly export limit reached (${limit}/${limit}). Resets next month.`, limit, used },
        { status: 429 }
      )
    }
  }

  // Fetch startup with all related data
  const { data: startup } = await supabase
    .from("startups")
    .select(`
      *,
      startup_tags(label, strength),
      startup_founders(
        founders(name, role, linkedin_url, has_phd, is_repeat_founder, has_big_tech_background, big_tech_employer, previous_companies, previous_exits)
      )
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .single()

  if (!startup) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 })
  }

  // Atomically increment usage (after we've confirmed the startup exists)
  const svc = await createServiceClient()
  await svc.rpc("increment_export_usage", { p_user_id: user.id, p_period: period })

  // Build CSV
  const tags = (startup.startup_tags as Array<{ label: string; strength: string }> ?? [])
    .map((t) => t.label)

  const founders = (
    startup.startup_founders as Array<{ founders: { name: string; role: string | null } | null }> ?? []
  )
    .map((sf) => sf.founders)
    .filter(Boolean)
    .map((f) => [f!.name, f!.role].filter(Boolean).join(" – "))

  const headers = [
    "name", "slug", "website_url", "linkedin_url",
    "contact_email", "contact_phone",
    "city", "country", "sector", "stage",
    "founded_date", "first_seen_at", "signal_source",
    "description",
    "investor_brief", "analyst_note",
    "product_description", "target_market", "competitive_landscape",
    "company_origin", "current_strategy", "business_model_hypothesis",
    "technology_layer", "product_modality", "technical_thesis", "technology_stage",
    "startup_origin_type",
    "total_raised_eur", "last_round", "est_next_raise",
    "fundraising_status", "fundraising_signal_summary", "funding_notes",
    "signal_count", "last_signal_date",
    "entity_complexity",
    "tags", "founders",
  ]

  const humanHeaders: Record<string, string> = {
    name: "Name", slug: "Slug", website_url: "Website", linkedin_url: "LinkedIn",
    contact_email: "Contact Email", contact_phone: "Contact Phone",
    city: "City", country: "Country",
    sector: "Sector", stage: "Stage",
    founded_date: "Founded", first_seen_at: "First Seen", signal_source: "Signal Source",
    description: "Description",
    investor_brief: "Investor Brief", analyst_note: "Analyst Note",
    product_description: "Product Description", target_market: "Target Market",
    competitive_landscape: "Competitive Landscape",
    company_origin: "Company Origin", current_strategy: "Current Strategy",
    business_model_hypothesis: "Business Model Hypothesis",
    technology_layer: "Technology Layer", product_modality: "Product Modality",
    technical_thesis: "Technical Thesis", technology_stage: "Technology Stage",
    startup_origin_type: "Origin Type",
    total_raised_eur: "Total Raised (EUR)", last_round: "Last Round",
    est_next_raise: "Est. Next Raise",
    fundraising_status: "Fundraising Status",
    fundraising_signal_summary: "Fundraising Signal Summary", funding_notes: "Funding Notes",
    signal_count: "Signal Count", last_signal_date: "Last Signal Date",
    entity_complexity: "Entity Complexity",
    tags: "Tags", founders: "Founders",
  }

  const values: Record<string, unknown> = {
    ...startup,
    sector: sectorLabel(startup.sector),
    stage: stageLabel(startup.stage),
    signal_source: startup.signal_source ? (SIGNAL_SOURCE_LABELS[startup.signal_source] ?? startup.signal_source) : null,
    tags: tags.join("; "),
    founders: founders.join("; "),
  }

  const headerRow = headers.map((h) => csvEscape(humanHeaders[h] ?? h)).join(",")
  const dataRow = buildCsvRow(headers, values)
  const csv = `${headerRow}\n${dataRow}\n`

  const filename = `${startup.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-france-ai-radar.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
