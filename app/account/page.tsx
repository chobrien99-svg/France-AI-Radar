import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AppNav } from "@/components/app-nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  explorer: "Explorer",
  professional: "Professional",
  enterprise: "Enterprise",
}

const TIER_CLASS: Record<string, string> = {
  free: "badge-signal badge-signal-neutral",
  explorer: "badge-signal badge-signal-neutral",
  professional: "badge-signal badge-signal-positive",
  enterprise: "badge-signal badge-signal-positive",
}

const STATUS_CLASS: Record<string, string> = {
  active: "badge-signal badge-signal-positive",
  past_due: "badge-signal badge-signal-warning",
  canceled: "badge-signal badge-signal-risk",
  inactive: "badge-signal badge-signal-neutral",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function buildFilterUrl(filters: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `/database?${qs}` : "/database"
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, subscription_tier, subscription_status, subscription_period_end, stripe_customer_id"
    )
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const tier = profile.subscription_tier ?? "free"
  const isPaid = tier !== "free"
  const canUpgrade = tier === "free" || tier === "explorer"
  const canManageBilling = !!profile.stripe_customer_id

  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("id, name, filters, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: watchlistItems } = await supabase
    .from("watchlist")
    .select("id, created_at, startups(id, name, slug, sector, stage, city)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: userLists } = await supabase
    .from("lists")
    .select("id, name, description, is_public, created_at, list_items(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: userAlerts } = await supabase
    .from("alerts")
    .select("id, is_active, created_at, startups(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <>
      <AppNav activePage="account" />
      <div className="page-container py-8 pb-20">

        {/* Page header */}
        <div className="mb-8">
          <p className="section-kicker">Account</p>
          <h1 className="section-title mt-1">
            {profile.full_name || profile.email}
          </h1>
          {profile.full_name && (
            <p className="mt-1 text-[13px] text-muted-foreground">{profile.email}</p>
          )}
        </div>

        {/* Subscription card */}
        <div className="data-card mb-10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="metric-label mb-2">Subscription</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-bold text-foreground">
                  {TIER_LABEL[tier] ?? tier} Plan
                </h2>
                <span
                  className={
                    STATUS_CLASS[profile.subscription_status ?? "inactive"] ??
                    STATUS_CLASS.inactive
                  }
                >
                  {profile.subscription_status ?? "inactive"}
                </span>
              </div>
              {profile.subscription_period_end && isPaid && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  Renews {formatDate(profile.subscription_period_end)}
                </p>
              )}
              {!isPaid && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  Upgrade for full database access, investor briefs, saved searches, and more.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {canManageBilling && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/api/stripe/portal">Manage Billing</Link>
                </Button>
              )}
              {canUpgrade && (
                <Button size="sm" asChild>
                  <Link href="/pricing">
                    {tier === "explorer" ? "Upgrade to Pro →" : "Upgrade Plan →"}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-5" />

          {/* Feature summary for current tier */}
          <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            <FeatureStat
              label="Startup profiles"
              value={tier === "free" ? "10" : tier === "explorer" ? "50" : "Unlimited"}
            />
            <FeatureStat
              label="Investor briefs"
              value={tier === "professional" || tier === "enterprise" ? "Included" : "—"}
            />
            <FeatureStat
              label="Saved searches"
              value={tier === "professional" || tier === "enterprise" ? "Unlimited" : "—"}
            />
            <FeatureStat
              label="Watchlist & lists"
              value={tier !== "free" ? "Included" : "—"}
            />
          </div>
        </div>

        {/* Feature tabs */}
        <Tabs defaultValue="watchlist">
          <TabsList className="mb-6 w-full justify-start">
            <TabsTrigger value="watchlist">
              Watchlist
              {watchlistItems && watchlistItems.length > 0 && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                  {watchlistItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="searches">
              Saved Searches
              {savedSearches && savedSearches.length > 0 && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                  {savedSearches.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="lists">
              Lists
              {userLists && userLists.length > 0 && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                  {userLists.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* ── Watchlist ── */}
          <TabsContent value="watchlist">
            {watchlistItems && watchlistItems.length > 0 ? (
              <div className="space-y-2">
                {watchlistItems.map((item) => {
                  const s = item.startups as unknown as {
                    id: string
                    name: string
                    slug: string
                    sector: string
                    stage: string
                    city: string | null
                  } | null
                  if (!s) return null
                  return (
                    <div
                      key={item.id}
                      className="data-card flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">{s.name}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {[s.city, s.sector, s.stage].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/startup/${s.slug}`}>View →</Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Your watchlist is empty"
                description="Save startups from their profile page to track them here."
                action={
                  <Button size="sm" asChild>
                    <Link href="/database">Browse Startups →</Link>
                  </Button>
                }
              />
            )}
          </TabsContent>

          {/* ── Saved Searches ── */}
          <TabsContent value="searches">
            {savedSearches && savedSearches.length > 0 ? (
              <div className="space-y-2">
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="data-card flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{s.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Saved {formatDate(s.created_at)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={buildFilterUrl(s.filters as Record<string, unknown>)}>
                        Open →
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No saved searches yet"
                description="Filter the database and save your view to quickly return to it."
                action={
                  <Button size="sm" asChild>
                    <Link href="/database">Go to Database →</Link>
                  </Button>
                }
              />
            )}
          </TabsContent>

          {/* ── Lists ── */}
          <TabsContent value="lists">
            {userLists && userLists.length > 0 ? (
              <div className="space-y-2">
                {userLists.map((list) => {
                  const itemCount =
                    (list.list_items as unknown as { count: number }[])?.[0]?.count ?? 0
                  return (
                    <div
                      key={list.id}
                      className="data-card flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-foreground">{list.name}</p>
                          {list.is_public && (
                            <span className="badge-signal badge-signal-neutral text-[10px]">
                              Public
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {itemCount} startup{itemCount !== 1 ? "s" : ""}
                          {list.description ? ` · ${list.description}` : ""}
                        </p>
                      </div>
                      <span className="badge-signal badge-signal-neutral text-[10px]">
                        Coming soon
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Lists coming soon"
                description="Create curated lists of startups to organise your deal flow and share with your team."
                comingSoon
              />
            )}
          </TabsContent>

          {/* ── Alerts ── */}
          <TabsContent value="alerts">
            {userAlerts && userAlerts.length > 0 ? (
              <div className="space-y-2">
                {userAlerts.map((alert) => {
                  const s = alert.startups as unknown as {
                    id: string
                    name: string
                    slug: string
                  } | null
                  if (!s) return null
                  return (
                    <div
                      key={alert.id}
                      className="data-card flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">{s.name}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          All signals · {alert.is_active ? "Active" : "Paused"}
                        </p>
                      </div>
                      <span className="badge-signal badge-signal-neutral text-[10px]">
                        Coming soon
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Alerts coming soon"
                description="Get notified when a tracked startup raises funding, makes a key hire, or has new signals."
                comingSoon
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function FeatureStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="metric-label">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-foreground">{value}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
  comingSoon = false,
}: {
  title: string
  description: string
  action?: React.ReactNode
  comingSoon?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
      {comingSoon && (
        <span className="badge-signal badge-signal-neutral mb-4 inline-block text-[11px]">
          Coming Soon
        </span>
      )}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
