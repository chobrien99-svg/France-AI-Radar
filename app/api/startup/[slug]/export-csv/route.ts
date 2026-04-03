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
    .from("organizations")
    .select(`
      *,
      organization_tags(tag, strength),
      organization_people(
        people(full_name, role, linkedin_url, has_phd, is_repeat_founder, has_big_tech_background, big_tech_employer, previous_exits)
      )
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("organization_type", "startup")
    .single()

  if (!startup) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 })
  }

  // Atomically increment usage (after we've confirmed the startup exists)
  const svc = await createServiceClient()
  await svc.rpc("increment_export_usage", { p_user_id: user.id, p_period: period })

  // Build CSV
  const tags = (startup.organization_tags as Array<{ tag: string; strength: number }> ?? [])
    .map((t) => t.tag)

  const founders = (
    startup.organization_people as Array<{ people: { full_name: string; role: string | null } | null }> ?? []
  )
    .map((sf) => sf.people)
    .filter(Boolean)
    .map((f) => [f!.full_name, f!.role].filter(Boolean).join(" – "))

  const headers = [
    "name", "slug", "website", "linkedin_url",
    "email", "phone",
    "country",
    "founded_date",
    "description",
    "technology_layer",
    "total_raised_eur", "last_round",
    "fundraising_status",
    "signal_count", "last_signal_date",
    "tags", "founders",
  ]

  const humanHeaders: Record<string, string> = {
    name: "Name", slug: "Slug", website: "Website", linkedin_url: "LinkedIn",
    email: "Contact Email", phone: "Contact Phone",
    country: "Country",
    founded_date: "Founded",
    description: "Description",
    technology_layer: "Technology Layer",
    total_raised_eur: "Total Raised (EUR)", last_round: "Last Round",
    fundraising_status: "Fundraising Status",
    signal_count: "Signal Count", last_signal_date: "Last Signal Date",
    tags: "Tags", founders: "Founders",
  }

  const values: Record<string, unknown> = {
    ...startup,
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
