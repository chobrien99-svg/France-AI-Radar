import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Search } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getStartupLimit } from "@/lib/subscription"
import { FilterSidebar } from "@/components/database/filter-sidebar"
import { StartupCard } from "@/components/database/startup-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { Venture, Profile, OrganizationProfile } from "@/lib/types"
import { tagStrengthLabel } from "@/lib/types"
import { SortDropdown } from "@/components/database/sort-dropdown"
import { SearchInput } from "@/components/database/search-input"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function parseList(val: string | string[] | undefined): string[] {
  if (!val) return []
  const str = Array.isArray(val) ? val[0] : val
  return str.split(",").filter(Boolean)
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

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export const dynamic = "force-dynamic"

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Auth + subscription tier
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No free tier — redirect unauthenticated users to signup
  if (!user) redirect("/pricing")

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end, is_admin")
      .eq("id", user.id)
      .single()
    profile = data
  }

  // Require active subscription (admins always have access)
  const isAdmin = !!(profile as Record<string, unknown> | null)?.is_admin
  if (!isAdmin && profile?.subscription_status !== "active") {
    redirect("/pricing")
  }

  const tier = profile?.subscription_tier ?? "explorer"
  const limit = getStartupLimit(tier)

  // Parse filters
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? ""
  const locations = parseList(params.location)
  const sectors = parseList(params.sector)
  const times = parseList(params.time)
  const sort = (Array.isArray(params.sort) ? params.sort[0] : params.sort) ?? "newest"

  // Load filter options from the database (use service client to bypass RLS)
  const svc = await createServiceClient()

  // Get AI Radar org IDs for scoping filter options
  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const aiRadarOrgIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)

  // Load distinct cities from AI Radar orgs
  const { data: cityRows } = aiRadarOrgIds.length > 0
    ? await svc.from("organizations").select("city_id, cities!organizations_city_id_fkey(id, name)").in("id", aiRadarOrgIds).not("city_id", "is", null)
    : { data: [] }
  const cityMap = new Map<string, string>()
  for (const row of (cityRows ?? []) as Array<{ city_id: string; cities: { id: string; name: string } | { id: string; name: string }[] | null }>) {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities
    if (city && !cityMap.has(city.id)) cityMap.set(city.id, city.name)
  }
  const locationOptions = Array.from(cityMap.entries())
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Load sectors assigned to AI Radar orgs
  const { data: sectorRows } = aiRadarOrgIds.length > 0
    ? await svc.from("organization_sectors").select("sector_id, sectors(id, name)").in("organization_id", aiRadarOrgIds)
    : { data: [] }
  const sectorMap = new Map<string, string>()
  for (const row of (sectorRows ?? []) as Array<{ sector_id: string; sectors: { id: string; name: string } | { id: string; name: string }[] | null }>) {
    const sec = Array.isArray(row.sectors) ? row.sectors[0] : row.sectors
    if (sec && !sectorMap.has(sec.id)) sectorMap.set(sec.id, sec.name)
  }
  const sectorOptions = Array.from(sectorMap.entries())
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Build query — scoped to AI Radar product via product_organizations inner join
  let query = svc
    .from("organizations")
    .select(
      "*, cities!organizations_city_id_fkey(id, name), organization_tags(id, tag, strength)"
    )
    .eq("organization_type", "startup")
    .eq("status", "active")

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  // Location filter — values are city UUIDs now
  if (locations.length > 0) {
    query = query.in("city_id", locations)
  }

  // Sector filter — resolve matching org IDs for post-query filter
  let sectorFilterOrgIds: Set<string> | null = null
  if (sectors.length > 0) {
    const { data: sectorOrgRows } = await svc
      .from("organization_sectors")
      .select("organization_id")
      .in("sector_id", sectors)
    sectorFilterOrgIds = new Set((sectorOrgRows ?? []).map((r: { organization_id: string }) => r.organization_id))
  }

  // Time filter on first_seen_at (when the startup was added)
  const latestTime = times[times.length - 1]
  if (latestTime && latestTime !== "all") {
    const cutoff = cutoffDate(latestTime)
    if (cutoff) query = query.gte("first_seen_at", cutoff)
  }

  // Sort
  if (sort === "signals") {
    query = query.order("signal_count", { ascending: false })
  } else if (sort === "funding") {
    query = query.order("total_raised_eur", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const { data: allVentures, error: queryError } = await query
  if (queryError) {
    console.error("Database query error:", queryError.message, queryError.code)
  }
  console.log("Database query returned:", (allVentures ?? []).length, "results")
  let ventures = (allVentures ?? []) as Venture[]

  // Apply sector filter client-side (PostgREST .in() conflicts with inner join)
  if (sectorFilterOrgIds) {
    ventures = ventures.filter((v) => sectorFilterOrgIds!.has(v.id))
  }

  // Fetch sectors for each venture (separate query to avoid join issues)
  const ventureIds = ventures.map((v) => v.id)
  const { data: allOrgSectors } = ventureIds.length > 0
    ? await svc.from("organization_sectors").select("organization_id, sectors(name)").in("organization_id", ventureIds)
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

  const total = ventures.length
  const visible = limit !== null ? ventures.slice(0, limit) : ventures
  const isLimited = limit !== null && total > limit

  return (
    <div className="page-container">
      <div className="grid gap-6 py-6 pb-16 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — hidden on mobile, visible lg+ */}
        <div className="hidden lg:block">
          <Suspense fallback={<SidebarSkeleton />}>
            <FilterSidebar
              tier={tier}
              sectorOptions={sectorOptions}
              locationOptions={locationOptions}
            />
          </Suspense>
        </div>

        {/* Main content */}
        <div>
          {/* Toolbar — Suspense required because SearchInput and SortDropdown use useSearchParams() */}
          <Suspense fallback={<ToolbarSkeleton count={visible.length} total={total} />}>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative max-w-[400px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <SearchInput
                  defaultValue={q}
                  placeholder="Search startups, founders, sectors…"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-muted-foreground">
                  Showing{" "}
                  <strong className="text-foreground">{visible.length}</strong>{" "}
                  of{" "}
                  <strong className="text-foreground">{total}</strong> startups
                </span>
                <SortDropdown current={sort} />
                <Button variant="outline" size="sm" className="text-xs">
                  Export ↓
                </Button>
              </div>
            </div>
          </Suspense>

          {/* Card grid */}
          <div
            className="grid gap-[14px]"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {visible.map((startup) => {
              const sectors = sectorsByOrgId.get(startup.id) ?? []
              return (
                <StartupCard
                  key={startup.id}
                  venture={startup}
                  sectors={sectors}
                />
              )
            })}
          </div>

          {/* Upgrade gate */}
          {isLimited && (
            <div className="mt-8 border-l-2 border-l-primary bg-card px-6 py-8 text-center">
              <p className="mb-1 text-[15px] font-semibold text-foreground">
                {total - visible.length} more startup
                {total - visible.length !== 1 ? "s" : ""} in the database
              </p>
              <p className="mb-4 text-[13px] text-muted-foreground">
                Upgrade to Professional for unlimited access to all startups and signals.
              </p>
              <Button size="sm" asChild>
                <a href="/pricing">Upgrade Plan →</a>
              </Button>
            </div>
          )}

          {/* Empty state */}
          {visible.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-[15px] font-medium text-foreground">
                No startups match these filters
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Try adjusting or resetting your filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}

function ToolbarSkeleton({ count, total }: { count: number; total: number }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <Skeleton className="h-9 max-w-[400px] flex-1" />
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-muted-foreground">
          Showing <strong className="text-foreground">{count}</strong> of{" "}
          <strong className="text-foreground">{total}</strong> startups
        </span>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}
