import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = "force-dynamic"

type SubEvent = {
  id: string
  user_id: string
  event_type: string
  from_tier: string | null
  to_tier: string | null
  amount_eur: number | null
  created_at: string
}

type ProfileView = {
  organization_id: string
  viewed_at: string
  period: string
}

type StartupRow = {
  id: string
  name: string
  slug: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export default async function AdminMetricsPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: recentEventsRaw },
    { data: monthEventsRaw },
    { data: viewsRaw },
    { data: startupsRaw },
  ] = await Promise.all([
    supabase
      .from("subscription_events")
      .select("id, user_id, event_type, from_tier, to_tier, amount_eur, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("subscription_events")
      .select("event_type, to_tier, amount_eur, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase
      .from("profile_views")
      .select("organization_id, viewed_at, period")
      .eq("period", currentPeriod),
    supabase
      .from("organizations")
      .select("id, name, slug, product_organizations!inner(product_catalog!inner(slug))")
      .eq("product_organizations.product_catalog.slug", "ai-radar"),
  ])

  const recentEvents = (recentEventsRaw ?? []) as SubEvent[]
  const monthEvents = (monthEventsRaw ?? []) as Array<{
    event_type: string; to_tier: string | null; amount_eur: number | null; created_at: string
  }>
  const views = (viewsRaw ?? []) as ProfileView[]
  const startups = ((startupsRaw ?? []) as StartupRow[])
  const startupNameBySlug = new Map<string, string>()
  const startupNameById = new Map<string, string>()
  for (const s of startups) {
    startupNameById.set(s.id, s.name)
    startupNameBySlug.set(s.slug, s.name)
  }

  const activations30d = monthEvents.filter((e) => e.event_type === "subscription_activated").length
  const cancellations30d = monthEvents.filter((e) => e.event_type === "subscription_canceled").length
  const paymentFailures30d = monthEvents.filter((e) => e.event_type === "payment_failed").length

  // Views by org this month
  const viewsByOrg = new Map<string, number>()
  for (const v of views) {
    viewsByOrg.set(v.organization_id, (viewsByOrg.get(v.organization_id) ?? 0) + 1)
  }
  const topViewed = Array.from(viewsByOrg.entries())
    .map(([id, count]) => ({ id, count, name: startupNameById.get(id) ?? "Unknown" }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Link to the PostHog app (not the ingestion host)
  const posthogAppUrl = "https://eu.posthog.com"

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Metrics</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Subscription events and engagement from your database. For pageviews, session replays, and funnels, see PostHog.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={posthogAppUrl} target="_blank">Open PostHog →</Link>
        </Button>
      </div>

      {/* 30-day summary */}
      <p className="section-kicker mb-3">Last 30 days</p>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Activations" value={activations30d} accent="positive" />
        <StatCard label="Cancellations" value={cancellations30d} accent="risk" />
        <StatCard label="Payment failures" value={paymentFailures30d} accent="warning" />
      </div>

      {/* Top viewed startups this month */}
      <p className="section-kicker mb-3">Top viewed startups (this month)</p>
      <div className="mb-8 overflow-hidden border border-border/40">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Startup</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Unique viewers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topViewed.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold text-foreground">{row.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
              </tr>
            ))}
            {topViewed.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No views yet this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent subscription events */}
      <p className="section-kicker mb-3">Recent subscription events</p>
      <div className="overflow-hidden border border-border/40">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Event</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">From</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">To</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentEvents.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-medium text-foreground">{e.event_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.from_tier ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.to_tier ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.amount_eur ? `€${e.amount_eur}` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
              </tr>
            ))}
            {recentEvents.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent = "primary" }: { label: string; value: number | string; accent?: "primary" | "positive" | "risk" | "warning" }) {
  const borderClass = {
    primary: "border-l-primary",
    positive: "border-l-accent-green",
    risk: "border-l-destructive",
    warning: "border-l-[#8a6d00]",
  }[accent]

  return (
    <div className={`${borderClass} border-l-2 bg-card p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-[24px] font-bold text-foreground">{value}</p>
    </div>
  )
}
