import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getExportLimit } from "@/lib/subscription"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseList(val: string | null): string[] {
  if (!val) return []
  return val.split(",").filter(Boolean)
}

function cutoffDate(time: string): string | null {
  const now = new Date()
  if (time === "7d") { now.setDate(now.getDate() - 7); return now.toISOString() }
  if (time === "14d") { now.setDate(now.getDate() - 14); return now.toISOString() }
  if (time === "30d") { now.setDate(now.getDate() - 30); return now.toISOString() }
  if (time === "90d") { now.setDate(now.getDate() - 90); return now.toISOString() }
  if (time === "12m") { now.setFullYear(now.getFullYear() - 1); return now.toISOString() }
  return null
}

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

  const svc = await createServiceClient()

  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const orgIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)

  if (orgIds.length === 0) {
    return NextResponse.json({ error: "No startups found." }, { status: 404 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get("q") ?? ""
  const locations = parseList(searchParams.get("location"))
  const sectors = parseList(searchParams.get("sector"))
  const times = parseList(searchParams.get("time"))

  let query = svc
    .from("organizations")
    .select(
      "id, name, slug, description, founded_date, first_seen_at, technology_layer, total_raised_eur, last_round, fundraising_status, website, linkedin_url, signal_count, last_signal_date, updated_at, cities!organizations_city_id_fkey(name, country)"
    )
    .in("id", orgIds)
    .eq("status", "active")

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  if (locations.length > 0) {
    query = query.in("city_id", locations)
  }

  let sectorFilterOrgIds: Set<string> | null = null
  if (sectors.length > 0) {
    const { data: sectorOrgRows } = await svc
      .from("organization_sectors")
      .select("organization_id")
      .in("sector_id", sectors)
    sectorFilterOrgIds = new Set((sectorOrgRows ?? []).map((r: { organization_id: string }) => r.organization_id))
  }

  const latestTime = times[times.length - 1]
  if (latestTime && latestTime !== "all") {
    const cutoff = cutoffDate(latestTime)
    if (cutoff) query = query.gte("first_seen_at", cutoff)
  }

  query = query.order("updated_at", { ascending: false })

  const { data: rows, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let ventures = rows ?? []
  if (sectorFilterOrgIds) {
    ventures = ventures.filter((v: { id: string }) => sectorFilterOrgIds!.has(v.id))
  }

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
