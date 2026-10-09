import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getStartupLimit, getExportLimit, canUseAdvancedFilters, canSaveAndList, canAccessPremiumFields } from "@/lib/subscription"
import { SORTS, founderTags, paramList, paramOne, signalLabel, stageFrom } from "@/lib/radar"
import { FilterSidebarV2, type FilterGroupDef } from "@/components/radar/filter-sidebar"
import { DatabaseSearch, DatabaseToolbar } from "@/components/radar/database-toolbar"
import { StartupCardV2, StartupRowV2, FounderCardV2, FounderRowV2, type CardStartup, type CardFounder } from "@/components/radar/cards"
import type { Profile } from "@/lib/types"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const TIME_OPTIONS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "12m", label: "Last 12 months", days: 365 },
]

type Row = Record<string, unknown>
type Named = { id: string; name: string }

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null
}

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

/** Was `iso` within the last `days` days? */
function withinTime(iso: string | null, days: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() <= days * 86_400_000
}

const matches = (selected: string[], values: Array<string | null | undefined>) =>
  selected.length === 0 || values.some((v) => v != null && selected.includes(v))

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

  // Parse URL state
  const tab = paramOne(params.tab) === "founders" ? "founders" : "startups"
  const q = paramOne(params.q).trim().toLowerCase()
  const view = paramOne(params.view) === "list" ? "list" : "grid"
  const sortParam = paramOne(params.sort)
  const sort = SORTS[tab].some((o) => o.value === sortParam) ? sortParam : "latest"
  const shortlistOnly = tab === "startups" && canShortlist && paramOne(params.shortlist) === "1"
  const sel = {
    sector: advanced ? paramList(params.sector) : [],
    stage: advanced ? paramList(params.stage) : [],
    signal: advanced ? paramList(params.signal) : [],
    location: advanced ? paramList(params.location) : [],
    bg: advanced ? paramList(params.bg) : [],
    time: paramList(params.time),
  }

  // ---------------- Load (service client; access already checked above) ----------------
  const svc = await createServiceClient()

  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const orgIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)
  const idFilter = orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"]

  const [{ data: orgRows, error: orgError }, { data: sectorRows }, { data: signalRows }, { data: founderRows }, { data: watchRows }] =
    await Promise.all([
      svc
        .from("organizations")
        .select("id, name, slug, description, short_description, logo_url, last_round, signal_count, last_signal_date, first_seen_at, created_at, cities!organizations_city_id_fkey(id, name)")
        .in("id", idFilter)
        .eq("status", "active"),
      svc.from("organization_sectors").select("organization_id, is_primary, sectors(id, name)").in("organization_id", idFilter),
      svc
        .from("signals")
        .select("organization_id, signal_type, title, signal_date")
        .in("organization_id", idFilter)
        .order("signal_date", { ascending: false, nullsFirst: false }),
      svc
        .from("organization_people")
        .select("organization_id, role, people(id, full_name, slug, short_bio, bio, photo_url, has_phd, is_repeat_founder, has_big_tech_background, previous_exits, academic_lab)")
        .in("organization_id", idFilter)
        .eq("is_founder", true),
      supabase.from("watchlist").select("organization_id").eq("user_id", user.id),
    ])
  if (orgError) console.error("Database query error:", orgError.message, orgError.code)

  // Primary sector per startup
  const sectorByOrg = new Map<string, Named>()
  for (const r of (sectorRows ?? []) as Row[]) {
    const s = one(r.sectors as Named | Named[] | null)
    const orgId = r.organization_id as string
    if (s && (!sectorByOrg.has(orgId) || r.is_primary)) sectorByOrg.set(orgId, s)
  }

  // Latest signal per startup (rows are newest first)
  const latestByOrg = new Map<string, { type: string; title: string; date: string | null }>()
  for (const r of (signalRows ?? []) as Row[]) {
    const orgId = r.organization_id as string
    if (!latestByOrg.has(orgId)) {
      latestByOrg.set(orgId, { type: r.signal_type as string, title: r.title as string, date: (r.signal_date as string | null) ?? null })
    }
  }

  const founderNamesByOrg = new Map<string, string[]>()
  for (const r of (founderRows ?? []) as Row[]) {
    const p = one(r.people as Row | Row[] | null)
    if (!p) continue
    const list = founderNamesByOrg.get(r.organization_id as string) ?? []
    list.push(p.full_name as string)
    founderNamesByOrg.set(r.organization_id as string, list)
  }

  const saved = new Set(((watchRows ?? []) as Row[]).map((r) => r.organization_id as string))

  type StartupItem = CardStartup & { sectorId: string | null; cityId: string | null; firstSeen: string | null; activity: number; search: string }
  const allStartups: StartupItem[] = ((orgRows ?? []) as Row[]).map((o) => {
    const id = o.id as string
    const city = one(o.cities as Named | Named[] | null)
    const sector = sectorByOrg.get(id) ?? null
    const latest = latestByOrg.get(id) ?? null
    const latestDate = latest?.date ?? (o.last_signal_date as string | null) ?? (o.created_at as string)
    const item: StartupItem = {
      id,
      slug: o.slug as string,
      name: o.name as string,
      description: (o.short_description as string | null) || (o.description as string | null),
      logoUrl: (o.logo_url as string | null) ?? null,
      sector: sector?.name ?? null,
      sectorId: sector?.id ?? null,
      stage: stageFrom(o.last_round as string | null),
      city: city?.name ?? null,
      cityId: city?.id ?? null,
      signalCount: (o.signal_count as number | null) ?? 0,
      latestSignal: latest,
      firstSeen: (o.first_seen_at as string | null) ?? null,
      activity: latestDate ? new Date(latestDate).getTime() : 0,
      search: "",
    }
    item.search = [item.name, o.description, item.sector, item.city, ...(founderNamesByOrg.get(id) ?? [])].join(" ").toLowerCase()
    return item
  })
  const startupById = new Map(allStartups.map((s) => [s.id, s]))

  // One entry per person; first linked Radar startup is their company
  const founderMap = new Map<string, CardFounder & { sectorId: string | null; cityId: string | null; activity: number; search: string }>()
  for (const r of (founderRows ?? []) as Row[]) {
    const p = one(r.people as Row | Row[] | null)
    const company = startupById.get(r.organization_id as string)
    if (!p || !company || founderMap.has(p.id as string)) continue
    const f = {
      id: p.id as string,
      slug: (p.slug as string | null) ?? null,
      name: p.full_name as string,
      role: (r.role as string | null) ?? null,
      photoUrl: (p.photo_url as string | null) ?? null,
      bio: (p.short_bio as string | null) || (p.bio as string | null),
      tags: founderTags({
        has_big_tech_background: !!p.has_big_tech_background,
        has_phd: !!p.has_phd,
        is_repeat_founder: !!p.is_repeat_founder,
        previous_exits: (p.previous_exits as number | null) ?? 0,
        academic_lab: (p.academic_lab as string | null) ?? null,
      }),
      company: { name: company.name, slug: company.slug, sector: company.sector, city: company.city },
      sectorId: company.sectorId,
      cityId: company.cityId,
      activity: company.activity,
      search: "",
    }
    f.search = [f.name, f.role, company.name, f.bio].join(" ").toLowerCase()
    founderMap.set(f.id, f)
  }
  const allFounders = Array.from(founderMap.values())

  // ---------------- Filter + sort ----------------
  const timeOpt = TIME_OPTIONS.find((t) => t.value === sel.time[sel.time.length - 1])

  const startups = allStartups.filter(
    (s) =>
      matches(sel.sector, [s.sectorId]) &&
      matches(sel.stage, [s.stage]) &&
      matches(sel.signal, [s.latestSignal?.type]) &&
      matches(sel.location, [s.cityId]) &&
      (!timeOpt || withinTime(s.firstSeen, timeOpt.days)) &&
      (!shortlistOnly || saved.has(s.id)) &&
      (!q || s.search.includes(q))
  )
  if (sort === "az") startups.sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === "signals") startups.sort((a, b) => b.signalCount - a.signalCount || b.activity - a.activity)
  else startups.sort((a, b) => b.activity - a.activity)

  const founders = allFounders.filter(
    (f) =>
      matches(sel.bg, f.tags) &&
      matches(sel.sector, [f.sectorId]) &&
      matches(sel.location, [f.cityId]) &&
      (!q || f.search.includes(q))
  )
  const bareName = (n: string) => n.replace(/^Dr\.?\s*/i, "")
  if (sort === "az") founders.sort((a, b) => bareName(a.name).localeCompare(bareName(b.name)))
  else founders.sort((a, b) => b.activity - a.activity)

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
  const signalTotal = (signalRows ?? []).length
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
            <div className="r2-grid">{founders.map((f) => <FounderCardV2 key={f.id} f={f} />)}</div>
          ) : (
            <div className="r2-list">{founders.map((f) => <FounderRowV2 key={f.id} f={f} />)}</div>
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
