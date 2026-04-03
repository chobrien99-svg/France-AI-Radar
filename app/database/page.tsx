import { Suspense } from "react"
import { Search } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
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

function cityForLocation(loc: string): string[] {
  const map: Record<string, string[]> = {
    paris: ["Paris"],
    lyon: ["Lyon"],
    toulouse: ["Toulouse"],
    grenoble: ["Grenoble"],
  }
  return map[loc] ?? []
}

function cutoffDate(time: string): string | null {
  const now = new Date()
  if (time === "30d") {
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  if (time === "90d") {
    now.setDate(now.getDate() - 90)
    return now.toISOString()
  }
  if (time === "12m") {
    now.setFullYear(now.getFullYear() - 1)
    return now.toISOString()
  }
  return null
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

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

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end")
      .eq("id", user.id)
      .single()
    profile = data
  }

  const tier = profile?.subscription_tier ?? "free"
  const limit = getStartupLimit(tier)

  // Parse filters
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? ""
  const locations = parseList(params.location)
  const times = parseList(params.time)
  const founderSignals = parseList(params.founderSignal)
  const signalTypes = parseList(params.signalType)
  const sort = (Array.isArray(params.sort) ? params.sort[0] : params.sort) ?? "newest"

  // Build query
  let query = supabase
    .from("organizations")
    .select(
      "*, organization_tags(id, tag, strength), organization_people(people(id, full_name, slug, big_tech_employer, has_phd, is_repeat_founder, has_big_tech_background))"
    )
    .eq("organization_type", "startup")
    .eq("status", "active")

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }
  // Location: map values to actual city names
  if (locations.length > 0) {
    const cities: string[] = []
    let includeOther = false
    for (const loc of locations) {
      if (loc === "other") {
        includeOther = true
      } else {
        cities.push(...cityForLocation(loc))
      }
    }
    if (cities.length > 0 && !includeOther) {
      query = query.in("city", cities)
    } else if (cities.length > 0 && includeOther) {
      query = query.or(
        `city.in.(${cities.map((c) => `"${c}"`).join(",")}),city.not.in.(Paris,Lyon,Toulouse,Grenoble)`
      )
    } else if (includeOther) {
      query = query.not("city", "in", '("Paris","Lyon","Toulouse","Grenoble")')
    }
  }

  // Time filter on last_signal_date
  const latestTime = times[times.length - 1]
  if (latestTime && latestTime !== "all") {
    const cutoff = cutoffDate(latestTime)
    if (cutoff) query = query.gte("last_signal_date", cutoff)
  }

  // Founder signal filter (array overlap)
  if (founderSignals.length > 0) {
    // Join with founders table via subquery isn't directly supported in PostgREST
    // so we skip server-side founder_signal filtering for now and note it's a UI-only hint
  }

  // Signal type filter — similarly needs a subquery; deferred
  if (signalTypes.length > 0) {
    // Deferred: requires subquery on signals table
  }

  // Sort
  if (sort === "signals") {
    query = query.order("signal_count", { ascending: false })
  } else if (sort === "funding") {
    query = query.order("total_raised_eur", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("last_signal_date", { ascending: false, nullsFirst: false })
  }

  const { data: allVentures } = await query
  const ventures = (allVentures ?? []) as Venture[]

  const total = ventures.length
  const visible = limit !== null ? ventures.slice(0, limit) : ventures
  const isLimited = limit !== null && total > limit

  return (
    <div className="page-container">
      <div className="grid gap-6 py-6 pb-16 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — hidden on mobile, visible lg+ */}
        <div className="hidden lg:block">
          <Suspense fallback={<SidebarSkeleton />}>
            <FilterSidebar />
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
              const raw = startup as Venture & {
                organization_people?: Array<{
                  people: {
                    id: string
                    full_name: string
                    slug: string | null
                    big_tech_employer: string | null
                    has_phd: boolean
                    is_repeat_founder: boolean
                    has_big_tech_background: boolean
                  } | null
                }>
              }
              const founders = (raw.organization_people ?? [])
                .map((op) => op.people)
                .filter(Boolean) as Array<{
                  id: string
                  full_name: string
                  slug: string | null
                  big_tech_employer: string | null
                  has_phd: boolean
                  is_repeat_founder: boolean
                  has_big_tech_background: boolean
                }>
              return (
                <StartupCard
                  key={startup.id}
                  venture={startup}
                  founders={founders}
                  showContact={tier === "professional" || tier === "enterprise"}
                />
              )
            })}
          </div>

          {/* Upgrade gate */}
          {isLimited && (
            <div className="mt-8 rounded-xl border border-border bg-card px-6 py-8 text-center shadow-xs">
              <p className="mb-1 text-[15px] font-semibold text-foreground">
                {total - visible.length} more startup
                {total - visible.length !== 1 ? "s" : ""} in the database
              </p>
              <p className="mb-4 text-[13px] text-muted-foreground">
                {tier === "free"
                  ? "You're on the free plan — upgrade to Explorer to see 50 startups per month, or Professional for unlimited access."
                  : "Upgrade to Professional for unlimited access to all startups and signals."}
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
