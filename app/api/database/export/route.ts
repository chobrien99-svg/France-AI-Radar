import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getExportLimit, canUseAdvancedFilters, canSaveAndList, canAccessPremiumFields } from "@/lib/subscription"
import { parseDatabaseQuery, loadRadarDataset, filterStartups } from "@/lib/radar-dataset"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_status, is_admin")
    .eq("id", user.id)
    .single()

  const isAdmin = !!(profile as Record<string, unknown> | null)?.is_admin
  const tier = profile?.subscription_tier ?? "explorer"
  const limit = getExportLimit(tier)

  if (!isAdmin && (profile?.subscription_status !== "active" || limit === 0)) {
    return NextResponse.json(
      { error: "Export requires an active Professional or Enterprise subscription." },
      { status: 403 }
    )
  }

  // Same filters, search and order as the /database page the user is looking at
  const params: Record<string, string[]> = {}
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    params[key] = request.nextUrl.searchParams.getAll(key)
  }
  delete params.tab // the export is always the Startups tab
  const query = parseDatabaseQuery(params, {
    advanced: isAdmin || canUseAdvancedFilters(tier),
    canShortlist: isAdmin || canSaveAndList(tier),
    premium: isAdmin || canAccessPremiumFields(tier),
  })

  const svc = await createServiceClient()
  const ds = await loadRadarDataset(svc, supabase, user.id)
  const matched = filterStartups(ds, query)
  const order = new Map(matched.map((s, i) => [s.id, i]))

  // Full CSV columns for the matched startups
  const { data: rows, error } = matched.length > 0
    ? await svc
        .from("organizations")
        .select(
          "id, name, slug, description, founded_date, first_seen_at, technology_layer, total_raised_eur, last_round, fundraising_status, website, linkedin_url, signal_count, last_signal_date, updated_at, cities!organizations_city_id_fkey(name, country)"
        )
        .in("id", matched.map((s) => s.id))
    : { data: [], error: null }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ventures = ((rows ?? []) as Array<{ id: string }>).filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  const ventureIds = ventures.map((v: { id: string }) => v.id)
  const { data: allOrgSectors } = ventureIds.length > 0
    ? await svc
        .from("organization_sectors")
        .select("organization_id, sectors(name)")
        .in("organization_id", ventureIds)
    : { data: [] }
  const sectorsByOrgId = new Map<string, string[]>()
  for (const row of (allOrgSectors ?? []) as Array<{ organization_id: string; sectors: { name: string } | { name: string }[] | null }>) {
    const sec = Array.isArray(row.sectors) ? row.sectors[0] : row.sectors
    if (sec) {
      const existing = sectorsByOrgId.get(row.organization_id) ?? []
      existing.push(sec.name)
      sectorsByOrgId.set(row.organization_id, existing)
    }
  }

  const headers = [
    "Name",
    "City",
    "Country",
    "Founded",
    "First Seen",
    "Sectors",
    "Technology Layer",
    "Fundraising Status",
    "Total Raised (EUR)",
    "Last Round",
    "Website",
    "LinkedIn",
    "Signals",
    "Last Signal",
    "Profile Updated",
    "Description",
    "Profile URL",
  ]

  const origin = request.nextUrl.origin
  const lines = [headers.map(csvEscape).join(",")]

  for (const v of ventures as Array<{
    id: string
    name: string
    slug: string
    description: string | null
    founded_date: string | null
    first_seen_at: string | null
    technology_layer: string | null
    total_raised_eur: number | null
    last_round: string | null
    fundraising_status: string | null
    website: string | null
    linkedin_url: string | null
    signal_count: number
    last_signal_date: string | null
    updated_at: string | null
    cities: { name: string; country: string } | { name: string; country: string }[] | null
  }>) {
    const city = Array.isArray(v.cities) ? v.cities[0] : v.cities
    const row = [
      v.name,
      city?.name ?? "",
      city?.country ?? "",
      v.founded_date ?? "",
      v.first_seen_at ? v.first_seen_at.slice(0, 10) : "",
      (sectorsByOrgId.get(v.id) ?? []).join("; "),
      v.technology_layer ?? "",
      v.fundraising_status ?? "",
      v.total_raised_eur ?? "",
      v.last_round ?? "",
      v.website ?? "",
      v.linkedin_url ?? "",
      v.signal_count,
      v.last_signal_date ?? "",
      v.updated_at ? v.updated_at.slice(0, 10) : "",
      v.description ?? "",
      `${origin}/startup/${v.slug}`,
    ]
    lines.push(row.map(csvEscape).join(","))
  }

  const csv = lines.join("\n")
  const filename = `france-ai-radar-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
