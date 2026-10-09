import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getStartupLimit, getExportLimit, canUseAdvancedFilters, canSaveAndList, canAccessPremiumFields } from "@/lib/subscription"
import { paramOne, signalLabel } from "@/lib/radar"
import { TIME_OPTIONS, withinTime, parseDatabaseQuery, loadRadarDataset, filterStartups, filterFounders } from "@/lib/radar-dataset"
import { FilterSidebarV2, type FilterGroupDef } from "@/components/radar/filter-sidebar"
import { DatabaseSearch, DatabaseToolbar } from "@/components/radar/database-toolbar"
import { StartupCardV2, StartupRowV2, FounderCardV2, FounderRowV2 } from "@/components/radar/cards"
import type { Profile } from "@/lib/types"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Tally values for filter counts, most common first */
function tally<T>(items: T[], pick: (x: T) => Array<{ value: string; label: string }>) {
  const m = new Map<string, { value: string; label: string; n: number }>()
  for (const it of items) {
    for (const o of pick(it)) {
      const cur = m.get(o.value)
      if (cur) cur.n++
      else m.set(o.value, { ...o, n: 1 })
    }
  }
  return Array.from(m.values()).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No free tier — redirect unauthenticated users to signup
  if (!user) redirect("/pricing")

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end, is_admin")
    .eq("id", user.id)
    .single()
  const profile = profileRow as (Profile & { is_admin?: boolean }) | null

  // Require active subscription (admins always have access)
  const isAdmin = !!profile?.is_admin
  if (!isAdmin && profile?.subscription_status !== "active") redirect("/pricing")

  const tier = profile?.subscription_tier ?? "explorer"
  const limit = isAdmin ? null : getStartupLimit(tier)
  const exportLimit = getExportLimit(tier)
  const canExport = isAdmin || exportLimit !== 0
  const advanced = isAdmin || canUseAdvancedFilters(tier)
  const canShortlist = isAdmin || canSaveAndList(tier)
  const canPremium = isAdmin || canAccessPremiumFields(tier)

  // URL state → filters, then the shared dataset (same semantics as the CSV export)
  const query = parseDatabaseQuery(params, { advanced, canShortlist, premium: canPremium })
  const { tab, sort, shortlistOnly } = query
  const view = paramOne(params.view) === "list" ? "list" : "grid"

  const svc = await createServiceClient()
  const ds = await loadRadarDataset(svc, supabase, user.id)
  const { startups: allStartups, founders: allFounders, saved } = ds
  const startups = filterStartups(ds, query)
  // Founder roles, bios and background are Professional intelligence: never send them otherwise
  const founders = filterFounders(ds, query).map((f) => (canPremium ? f : { ...f, role: null, bio: null, tags: [] }))

  const visibleStartups = limit !== null ? startups.slice(0, limit) : startups
  const hiddenCount = startups.length - visibleStartups.length

  // ---------------- Filter groups (counts over the whole Radar) ----------------
  const idOpt = (id: string | null, name: string | null) => (id && name ? [{ value: id, label: name }] : [])
  const groups: FilterGroupDef[] =
    tab === "startups"
      ? [
          { key: "sector", label: "Sector", locked: !advanced, options: tally(allStartups, (s) => idOpt(s.sectorId, s.sector)) },
          { key: "stage", label: "Stage", locked: !advanced, options: tally(allStartups, (s) => [{ value: s.stage, label: s.stage }]) },
          {
            key: "signal",
            label: "Latest signal",
            locked: !advanced,
            options: tally(allStartups, (s) => (s.latestSignal ? [{ value: s.latestSignal.type, label: signalLabel(s.latestSignal.type) }] : [])),
          },
          { key: "location", label: "City", locked: !advanced, options: tally(allStartups, (s) => idOpt(s.cityId, s.city)) },
          {
            key: "time",
            label: "Added to the Radar",
            options: TIME_OPTIONS.map((t) => ({ value: t.value, label: t.label, n: allStartups.filter((s) => withinTime(s.firstSeen, t.days)).length })),
          },
        ]
      : [
          { key: "bg", label: "Background", locked: !advanced, options: tally(allFounders, (f) => f.tags.map((t) => ({ value: t, label: t }))) },
          { key: "sector", label: "Company sector", locked: !advanced, options: tally(allFounders, (f) => idOpt(f.sectorId, f.company?.sector ?? null)) },
          { key: "location", label: "City", locked: !advanced, options: tally(allFounders, (f) => idOpt(f.cityId, f.company?.city ?? null)) },
        ]

  const sectorCount = new Set(allStartups.map((s) => s.sectorId).filter(Boolean)).size
  const signalTotal = ds.signalTotal
  const shown = tab === "startups" ? visibleStartups.length : founders.length
  const total = tab === "startups" ? allStartups.length : allFounders.length
  const isEmpty = tab === "startups" ? startups.length === 0 : founders.length === 0

  return (
    <div>
      {/* ---------------- Header band ---------------- */}
      <div className="r2-hero">
        <div className="page-container r2-hero-in">
          <div className="r2-eyebrow"><span className="bk" />The Radar · Database</div>
          <h1 className="r2-h1">The Database</h1>
          <p className="r2-lede">
            Every French AI startup we&apos;ve picked up at its earliest signal, and the founders behind it.
            {canShortlist ? " Shortlist the ones you want to follow." : ""}
          </p>
          <div className="r2-stats">
            <div className="r2-stat"><b>{allStartups.length}</b><span>Startups</span></div>
            <div className="r2-stat"><b>{allFounders.length}</b><span>Founders</span></div>
            <div className="r2-stat"><b>{sectorCount}</b><span>Sectors</span></div>
            <div className="r2-stat"><b>{signalTotal}</b><span>Signals logged</span></div>
          </div>
          <nav className="r2-tabs" aria-label="Database sections">
            <Link href="/database" className="r2-tab" aria-current={tab === "startups" ? "page" : undefined}>
              Startups <span className="n">{allStartups.length}</span>
            </Link>
            <Link href="/database?tab=founders" className="r2-tab" aria-current={tab === "founders" ? "page" : undefined}>
              Founders <span className="n">{allFounders.length}</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="page-container r2-body">
        <Suspense>
          <FilterSidebarV2 groups={groups} />
        </Suspense>

        <div style={{ minWidth: 0 }}>
          <Suspense>
            <DatabaseSearch key={tab} tab={tab} defaultValue={paramOne(params.q)} />
            <DatabaseToolbar
              tab={tab}
              shown={shown}
              total={total}
              sort={sort}
              view={view}
              shortlist={shortlistOnly}
              savedCount={saved.size}
              canShortlist={canShortlist}
              canExport={canExport}
            />
          </Suspense>

          {isEmpty ? (
            <div className="r2-empty">
              {shortlistOnly && saved.size === 0
                ? "Your shortlist is empty. Star a startup to add it."
                : "Nothing matches these filters."}
            </div>
          ) : tab === "startups" ? (
            view === "grid" ? (
              <div className="r2-grid">
                {visibleStartups.map((s) => (
                  <StartupCardV2 key={s.id} s={s} saved={saved.has(s.id)} canShortlist={canShortlist} showSignalTitle={canPremium} />
                ))}
              </div>
            ) : (
              <div className="r2-list">
                {visibleStartups.map((s) => (
                  <StartupRowV2 key={s.id} s={s} saved={saved.has(s.id)} canShortlist={canShortlist} />
                ))}
              </div>
            )
          ) : view === "grid" ? (
            <div className="r2-grid">{founders.map((f) => <FounderCardV2 key={f.id} f={f} redacted={!canPremium} />)}</div>
          ) : (
            <div className="r2-list">{founders.map((f) => <FounderRowV2 key={f.id} f={f} redacted={!canPremium} />)}</div>
          )}

          {tab === "startups" && hiddenCount > 0 && (
            <div className="r2-upsell">
              <h5>
                {hiddenCount} more startup{hiddenCount !== 1 ? "s" : ""} in the database
              </h5>
              <p>Upgrade to Professional for unlimited access to all startups and signals.</p>
              <Link href="/pricing" className="r2-btn p">See plans</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
