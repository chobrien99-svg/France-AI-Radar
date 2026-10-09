import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { canAccessFullProfile, canAccessPremiumFields, getProfileViewLimit, getExportLimit, canSaveAndList, canSetAlerts } from "@/lib/subscription"
import type { OrganizationProfile } from "@/lib/types"
import { AddToListButton } from "@/components/startup/add-to-list-button"
import { ExportCsvButton } from "@/components/startup/export-csv-button"
import { BlurredText } from "@/components/blurred-gate"
import { Icon } from "@/components/radar/icons"
import { Monogram } from "@/components/radar/monogram"
import { StartupCardV2 } from "@/components/radar/cards"
import { ShortlistButton, AlertToggle, ShareButtonV2 } from "@/components/radar/profile-actions"
import { formatDate, formatEur, founderTags, relativeDate, signalColor, signalLabel, stageFrom, toneFor } from "@/lib/radar"
import { loadRelatedStartups } from "@/lib/radar-data"
import { AnalyticsPageTrack } from "@/components/analytics-page-track"
import { AnalyticsIdentifier } from "@/components/analytics-identifier"
import type { Venture, Profile } from "@/lib/types"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

// Force dynamic rendering — data changes frequently via admin
export const dynamic = "force-dynamic"

export default async function StartupProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Auth + profile
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end, is_admin")
      .eq("id", user.id)
      .single()
    profile = data
  }

  const isAdmin = !!(profile as Record<string, unknown> | null)?.is_admin
  const hasActiveSub = isAdmin || profile?.subscription_status === "active"
  const tier = hasActiveSub ? (profile?.subscription_tier ?? "explorer") : "none"
  const canFull = hasActiveSub && canAccessFullProfile(tier)
  const canPremium = isAdmin || canAccessPremiumFields(tier)
  const canSave = canSaveAndList(tier)
  const canAlert = canSetAlerts(tier)

  // Fetch venture first (needed for view tracking)
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Fetch venture — admins can see any status, others only active
  const svcForRead = await createServiceClient()
  let ventureQuery = svcForRead
    .from("organizations")
    .select("*, cities!organizations_city_id_fkey(id, name), secondary_city:cities!organizations_secondary_city_id_fkey(id, name), organization_tags(id, tag, strength)")
    .eq("slug", slug)
    .eq("organization_type", "startup")

  if (!isAdmin) {
    ventureQuery = ventureQuery.eq("status", "active")
  }

  const { data: ventureRaw, error: ventureError } = await ventureQuery.single()

  if (ventureError) {
    console.error("Venture query error:", ventureError.message, ventureError.code)
  }

  if (!ventureRaw) notFound()
  const venture = ventureRaw as Venture

  // Profile view tracking for Explorer tier
  const viewLimit = getProfileViewLimit(tier)
  let profileViewsUsed = 0
  let hasViewAccess = canFull

  if (user && viewLimit !== null && viewLimit > 0) {
    const { data: viewCount } = await supabase
      .rpc("record_profile_view", {
        p_user_id: user.id,
        p_organization_id: venture.id,
        p_period: period,
      })
    profileViewsUsed = viewCount ?? 0
    hasViewAccess = profileViewsUsed <= viewLimit
  } else if (viewLimit === null) {
    hasViewAccess = true
  } else {
    hasViewAccess = false
  }

  // Export quota
  const exportLimit = getExportLimit(tier)
  let exportRemaining: number | null = null
  if (user && exportLimit !== null && exportLimit > 0) {
    const { data: usage } = await supabase
      .from("export_usage")
      .select("export_count")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle()
    exportRemaining = exportLimit - (usage?.export_count ?? 0)
  } else if (exportLimit === null) {
    exportRemaining = null
  }

  // Fetch signals (auth-gated at RLS level)
  const { data: signalsRaw } = await supabase
    .from("signals")
    .select("id, organization_id, signal_date, signal_type, strength, title, description")
    .eq("organization_id", venture.id)
    .order("signal_date", { ascending: false })

  const signals = signalsRaw ?? []

  // Fetch founders via junction table
  const { data: foundersRaw } = await supabase
    .from("organization_people")
    .select("role, people(*)")
    .eq("organization_id", venture.id)
    .eq("is_founder", true)

  // Fetch programs
  const { data: programsRaw } = await supabase
    .from("program_organizations")
    .select("id, membership_role, notes, program_editions(name, cohort_label, year, programs(name, program_type))")
    .eq("organization_id", venture.id)

  const programs = (programsRaw ?? []).map((row: Record<string, unknown>) => {
    const ed = Array.isArray(row.program_editions)
      ? (row.program_editions as Record<string, unknown>[])[0]
      : (row.program_editions as Record<string, unknown> | null)
    const prog = ed
      ? (Array.isArray(ed.programs) ? (ed.programs as Record<string, unknown>[])[0] : ed.programs as Record<string, unknown> | null)
      : null
    return {
      id: row.id as string,
      program_name: (prog?.name as string) ?? "Unknown",
      program_type: (prog?.program_type as string) ?? "other",
      edition_label: (ed?.cohort_label as string) ?? (ed?.name as string) ?? null,
      year: (ed?.year as number) ?? null,
      membership_role: row.membership_role as string | null,
    }
  })

  // Check watchlist status
  let isBookmarked = false
  let hasAlert = false
  if (user) {
    const [{ data: wl }, { data: al }] = await Promise.all([
      supabase.from("watchlist").select("id").eq("user_id", user.id).eq("organization_id", venture.id).maybeSingle(),
      supabase.from("alerts").select("id").eq("user_id", user.id).eq("organization_id", venture.id).maybeSingle(),
    ])
    isBookmarked = !!wl
    hasAlert = !!al
  }

  // Fetch profile data separately
  const { data: profileDataRaw } = await svcForRead
    .from("organization_profiles")
    .select("*")
    .eq("organization_id", venture.id)
    .maybeSingle()

  const profileData = profileDataRaw as OrganizationProfile | null

  const founders = (foundersRaw ?? []).map((row: Record<string, unknown>) => {
    const p = (Array.isArray(row.people) ? row.people[0] : row.people) as Record<string, unknown> | null
    if (!p) return null
    return {
      id: p.id as string,
      full_name: p.full_name as string,
      slug: (p.slug as string | null) ?? null,
      role: (row.role as string | null) ?? null,
      short_bio: (p.short_bio as string | null) ?? null,
      bio: (p.bio as string | null) ?? null,
      linkedin_url: (p.linkedin_url as string | null) ?? null,
      previous_exits: (p.previous_exits as number) ?? 0,
      big_tech_employer: (p.big_tech_employer as string | null) ?? null,
      academic_lab: (p.academic_lab as string | null) ?? null,
      has_phd: !!p.has_phd,
      is_repeat_founder: !!p.is_repeat_founder,
      has_big_tech_background: !!p.has_big_tech_background,
    }
  }).filter(Boolean) as Array<{
    id: string
    full_name: string
    slug: string | null
    role: string | null
    short_bio: string | null
    bio: string | null
    linkedin_url: string | null
    previous_exits: number
    big_tech_employer: string | null
    academic_lab: string | null
    has_phd: boolean
    is_repeat_founder: boolean
    has_big_tech_background: boolean
  }>

  // Primary sector + related startups
  const [{ data: sectorRows }, related] = await Promise.all([
    svcForRead.from("organization_sectors").select("is_primary, sectors(name)").eq("organization_id", venture.id),
    loadRelatedStartups(svcForRead, venture.id, venture.city_id),
  ])
  const sectorNames = ((sectorRows ?? []) as Array<{ is_primary: boolean; sectors: { name: string } | { name: string }[] | null }>)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((r) => (Array.isArray(r.sectors) ? r.sectors[0] : r.sectors)?.name)
    .filter(Boolean) as string[]

  const secondaryCity = (venture as unknown as { secondary_city?: { name: string } | null }).secondary_city?.name
  const place = [venture.cities?.name, secondaryCity].filter(Boolean).join(" & ")
  const lastSignal = signals[0]?.signal_date ?? venture.last_signal_date
  const blurPremium = !canFull || !canPremium
  const limitHit = canFull && !hasViewAccess
  const bodyProps = { venture, signals, founders, programs, profileData, blurPremium, isAuthenticated: !!user }

  return (
    <main>
      {user && profile && (
        <AnalyticsIdentifier
          userId={user.id}
          email={profile.email ?? null}
          tier={tier}
          isAdmin={isAdmin}
        />
      )}
      <AnalyticsPageTrack
        event={hasViewAccess ? "profile_viewed" : "profile_view_limit_hit"}
        slug={venture.slug}
        tier={tier}
      />

      {/* ---------------- Header band ---------------- */}
      <div className="r2-hero">
        <div className="page-container r2-hero-in">
          <Link href="/database" className="r2-back"><Icon name="back" size={13} /> Database</Link>
          <div className="r2-ph">
            <Monogram name={venture.name} tone={toneFor(venture.slug)} size="xl" imageUrl={(venture as unknown as { logo_url?: string | null }).logo_url} />
            <div style={{ minWidth: 0 }}>
              <div className="r2-eyebrow"><span className="bk" />{[sectorNames[0], place].filter(Boolean).join(" · ") || "AI Radar file"}</div>
              <h1 className="r2-h1">{venture.name}</h1>
              {venture.description && <p className="r2-lede">{venture.description}</p>}
              {venture.organization_tags.length > 0 && (
                <div className="r2-tags" style={{ paddingTop: 18 }}>
                  {venture.organization_tags.map((t) => <span key={t.id} className="r2-tag">{t.tag}</span>)}
                </div>
              )}
            </div>
            <div className="r2-ph-acts">
              {isAdmin && (
                <Link href={`/admin/startups/${venture.id}/edit`} className="r2-btn s">Edit</Link>
              )}
              {canSave && <ShortlistButton startupId={venture.id} initialSaved={isBookmarked} isLoggedIn={!!user} />}
              {canAlert ? (
                <AlertToggle startupId={venture.id} initialAlert={hasAlert} isLoggedIn={!!user} />
              ) : (
                <Link href="/pricing" className="r2-btn s"><Icon name="bell" size={14} />Alert</Link>
              )}
              <ShareButtonV2 slug={venture.slug} name={venture.name} />
            </div>
          </div>
          <div className="r2-stats sm">
            <div className="r2-stat"><b>{stageFrom(venture.last_round)}</b><span>Stage</span></div>
            <div className="r2-stat"><b>{formatDate(venture.founded_date, { month: "short", year: "numeric" })}</b><span>Founded</span></div>
            <div className="r2-stat"><b>{signals.length || venture.signal_count}</b><span>Signals</span></div>
            <div className="r2-stat"><b>{relativeDate(lastSignal)}</b><span>Last signal</span></div>
            {profileData?.est_next_raise && (
              <div className="r2-stat"><b><BlurredText blur={blurPremium}>{profileData.est_next_raise}</BlurredText></b><span>Est. next raise</span></div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="page-container r2-pbody">
        <div style={{ minWidth: 0 }}>
          {limitHit ? (
            <UpgradeGate viewsUsed={profileViewsUsed} viewLimit={viewLimit} />
          ) : (
            <MainColumn {...bodyProps} />
          )}
        </div>

        <aside className="r2-rail">
          {!limitHit && <Rail {...bodyProps} sectorNames={sectorNames} place={place} />}
          {canSave && (
            <>
              <ExportCsvButton slug={venture.slug} isLoggedIn={!!user} tier={tier} remaining={exportRemaining} className="r2-btn o w-full" />
              <AddToListButton startupId={venture.id} isLoggedIn={!!user} className="r2-btn o w-full" />
            </>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <div className="page-container r2-more">
          <div className="r2-more-h">
            <h3>More on the Radar</h3>
            <Link href="/database" className="r2-f-reset">All startups →</Link>
          </div>
          <div className="r2-grid">
            {related.map((r) => (
              <StartupCardV2 key={r.id} s={r} saved={false} canShortlist={false} showSignalTitle={canPremium} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

// ------------------------------------------------------------------
// Upgrade gate (Explorer monthly view limit reached)
// ------------------------------------------------------------------

function UpgradeGate({ viewsUsed, viewLimit }: { viewsUsed: number; viewLimit: number | null }) {
  return (
    <div className="r2-upsell" style={{ marginTop: 0 }}>
      <h5>
        {viewLimit !== null
          ? `You've viewed ${viewsUsed} of ${viewLimit} profiles this month`
          : "Full investor brief is Professional-only"}
      </h5>
      <p>Upgrade to Professional for unlimited profile views, full signal timelines, founder analysis, and investor briefs.</p>
      <Link href="/pricing" className="r2-btn p">Upgrade to Professional</Link>
    </div>
  )
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type Signal = {
  id: string
  organization_id: string
  signal_date: string
  signal_type: string
  strength: number
  title: string
  description: string | null
}

type FounderLocal = {
  id: string
  full_name: string
  slug: string | null
  role: string | null
  short_bio: string | null
  bio: string | null
  linkedin_url: string | null
  previous_exits: number
  big_tech_employer: string | null
  academic_lab: string | null
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
}

type ProgramLink = {
  id: string
  program_name: string
  program_type: string
  edition_label: string | null
  year: number | null
  membership_role: string | null
}

type BodyProps = {
  venture: Venture
  signals: Signal[]
  founders: FounderLocal[]
  programs: ProgramLink[]
  profileData: OrganizationProfile | null
  blurPremium: boolean
  isAuthenticated: boolean
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  accelerator: "Accelerator",
  incubator: "Incubator",
  france_2030: "France 2030",
  competition: "Competition",
  grant_program: "Grant Program",
  government: "Government",
  university: "University",
  corporate: "Corporate",
  other: "Program",
}

/** Signals shown before the timeline is blurred for non-Professional readers (0 = whole timeline) */
const FREE_SIGNALS = 0

// ------------------------------------------------------------------
// Main column: brief, timeline, product & market, strategy, legal
// ------------------------------------------------------------------

function MainColumn({ signals, profileData, blurPremium, isAuthenticated }: BodyProps) {
  const pm = [
    ["What they're building", profileData?.product_description],
    ["Target market", profileData?.target_market],
    ["Competitive landscape", profileData?.competitive_landscape],
  ].filter(([, v]) => v) as [string, string][]
  const strategy = [
    ["Technical thesis", profileData?.technical_thesis],
    ["Current strategy", profileData?.current_strategy],
    ["Business model", profileData?.business_model_hypothesis],
  ].filter(([, v]) => v) as [string, string][]
  const gated = blurPremium && signals.length > FREE_SIGNALS

  return (
    <>
      {profileData?.investor_brief && (
        <section className="r2-sec">
          <div className="r2-sec-h">Investor brief</div>
          <div className="r2-prose">
            {profileData.investor_brief.split(/\n\n+/).map((para, i) => (
              <p key={i}><BlurredText blur={blurPremium}>{para}</BlurredText></p>
            ))}
          </div>
          {profileData.analyst_note && (
            <div className="r2-why">
              <div className="k">Why this matters</div>
              <p><BlurredText blur={blurPremium}>{profileData.analyst_note}</BlurredText></p>
            </div>
          )}
        </section>
      )}

      {signals.length > 0 && (
        <section className="r2-sec">
          <div className="r2-sec-h">Signal timeline</div>
          <div className="r2-tl" style={gated ? { minHeight: 300 } : undefined}>
            {signals.map((g, i) => {
              const hidden = gated && i >= FREE_SIGNALS
              return (
                <div key={g.id} className={"r2-tl-row" + (hidden ? " r2-blur" : "")} aria-hidden={hidden || undefined}>
                  <div className="dt">{formatDate(g.signal_date)}</div>
                  <div className="r2-cat" style={{ color: signalColor(g.signal_type) }}>{signalLabel(g.signal_type)}</div>
                  <div>
                    <h4>{g.title}</h4>
                    {g.description && <p>{g.description}</p>}
                  </div>
                </div>
              )
            })}
            {gated && (
              <div className="r2-gate">
                <h5>
                  {signals.length - FREE_SIGNALS}{FREE_SIGNALS > 0 ? " more" : ""} signal{signals.length - FREE_SIGNALS !== 1 ? "s" : ""} on file
                </h5>
                <p>Full timelines are part of the Professional plan.</p>
                <Link href="/pricing" className="r2-btn p">See plans</Link>
              </div>
            )}
          </div>
        </section>
      )}

      {pm.length > 0 && (
        <section className="r2-sec">
          <div className="r2-sec-h">Product &amp; market</div>
          <div className={"r2-pm" + (pm.length === 2 ? " two" : "")}>
            {pm.map(([k, v]) => (
              <div key={k}><div className="r2-lbl">{k}</div><p><BlurredText blur={blurPremium}>{v}</BlurredText></p></div>
            ))}
          </div>
        </section>
      )}

      {strategy.length > 0 && (
        <section className="r2-sec">
          <div className="r2-sec-h">Strategy</div>
          <div className={"r2-pm" + (strategy.length === 2 ? " two" : "")}>
            {strategy.map(([k, v]) => (
              <div key={k}><div className="r2-lbl">{k}</div><p><BlurredText blur={blurPremium}>{v}</BlurredText></p></div>
            ))}
          </div>
        </section>
      )}

      {profileData?.entity_complexity && (
        <section className="r2-sec">
          <div className="r2-sec-h">Legal</div>
          <div className="r2-prose"><p><BlurredText blur={blurPremium}>{profileData.entity_complexity}</BlurredText></p></div>
        </section>
      )}

      {blurPremium && !gated && (
        <div className="r2-upsell">
          {isAuthenticated ? (
            <>
              <h5>Unlock the full intelligence brief</h5>
              <p>Upgrade to Professional for unblurred investor briefs, signal timelines, founder analysis, and contact details.</p>
              <Link href="/pricing" className="r2-btn p">Upgrade to Professional</Link>
            </>
          ) : (
            <>
              <h5>Get the full picture on this startup</h5>
              <p>Sign up for AI Radar to access investor briefs, signal timelines, founder intelligence, funding data, and more.</p>
              <div className="flex items-center justify-center gap-2">
                <Link href="/pricing" className="r2-btn p">View plans</Link>
                <Link href="/auth/signup" className="r2-btn o">Create account</Link>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------
// Right rail: founders, funding, programmes, facts on file
// ------------------------------------------------------------------

function Rail({ venture, founders, programs, profileData, blurPremium, sectorNames, place }: BodyProps & { sectorNames: string[]; place: string }) {
  const hasFunding = venture.total_raised_eur || venture.last_round || profileData?.est_next_raise || profileData?.fundraising_signal_summary
  const website = venture.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")

  return (
    <>
      {founders.length > 0 && (
        <div className="r2-box">
          <div className="r2-box-h"><span className="r2-lbl">Founding team</span><span className="r2-mono-sm">{founders.length}</span></div>
          <div className="r2-box-b">
            {founders.map((f) => {
              const tags = founderTags(f)
              const inner = (
                <>
                  <Monogram name={f.full_name} tone="light" size="sm" round />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="nm"><BlurredText blur={blurPremium}>{f.full_name}</BlurredText></div>
                    {f.role && <div className="rl"><BlurredText blur={blurPremium}>{f.role}</BlurredText></div>}
                    {!blurPremium && tags.length > 0 && <div className="tg">{tags.map((t) => <span key={t} className="r2-tag">{t}</span>)}</div>}
                  </div>
                </>
              )
              return f.slug && !blurPremium ? (
                <Link key={f.id} href={`/founder/${f.slug}`} className="r2-person">
                  {inner}
                  <span style={{ color: "var(--muted-foreground)", paddingTop: 4 }}><Icon name="arrow" size={13} /></span>
                </Link>
              ) : (
                <div key={f.id} className="r2-person">{inner}</div>
              )
            })}
          </div>
        </div>
      )}

      {hasFunding && (
        <div className="r2-box">
          <div className="r2-box-h"><span className="r2-lbl">Funding</span></div>
          <div className="r2-box-b">
            <div className="r2-kv"><span className="k">Total raised</span><span className="v"><BlurredText blur={blurPremium}>{formatEur(venture.total_raised_eur)}</BlurredText></span></div>
            <div className="r2-kv"><span className="k">Last round</span><span className="v"><BlurredText blur={blurPremium}>{venture.last_round ?? "—"}</BlurredText></span></div>
            {profileData?.est_next_raise && (
              <div className="r2-kv"><span className="k">Est. next raise</span><span className="v" style={{ color: "var(--clay-ink)" }}><BlurredText blur={blurPremium}>{profileData.est_next_raise}</BlurredText></span></div>
            )}
            {profileData?.fundraising_signal_summary && (
              <p className="r2-note"><BlurredText blur={blurPremium}>{profileData.fundraising_signal_summary}</BlurredText></p>
            )}
          </div>
        </div>
      )}

      {programs.length > 0 && (
        <div className="r2-box">
          <div className="r2-box-h"><span className="r2-lbl">Programs &amp; affiliations</span></div>
          <div className="r2-box-b">
            {programs.map((p) => (
              <div key={p.id} className="r2-related">
                <div className="r2-lbl" style={{ marginBottom: 0 }}>{PROGRAM_TYPE_LABELS[p.program_type] ?? p.program_type}</div>
                <div className="ttl"><BlurredText blur={blurPremium}>{p.program_name}</BlurredText></div>
                {(p.edition_label || p.year || p.membership_role) && (
                  <div className="r2-mono-sm" style={{ marginTop: 2 }}>{[p.edition_label, p.year, p.membership_role].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="r2-box">
        <div className="r2-box-h"><span className="r2-lbl">On file</span></div>
        <div className="r2-box-b">
          {place && <div className="r2-kv"><span className="k">Headquarters</span><span className="v">{place}, {venture.country}</span></div>}
          {venture.first_seen_at && <div className="r2-kv"><span className="k">First seen</span><span className="v">{formatDate(venture.first_seen_at)}</span></div>}
          {sectorNames.length > 0 && <div className="r2-kv"><span className="k">Sector</span><span className="v">{sectorNames.join(", ")}</span></div>}
          {website && (
            blurPremium
              ? <div className="r2-kv"><span className="k">Website</span><span className="v"><BlurredText blur>{website}</BlurredText></span></div>
              : <div className="r2-kv"><span className="k">Website</span><a className="v" href={venture.website!} target="_blank" rel="noopener noreferrer">{website}</a></div>
          )}
          {venture.linkedin_url && !blurPremium && (
            <div className="r2-kv"><span className="k">LinkedIn</span><a className="v" href={venture.linkedin_url} target="_blank" rel="noopener noreferrer">View profile</a></div>
          )}
          {venture.email && (
            <div className="r2-kv"><span className="k">Email</span>{blurPremium ? <span className="v"><BlurredText blur>{venture.email}</BlurredText></span> : <a className="v" href={`mailto:${venture.email}`}>{venture.email}</a>}</div>
          )}
          {venture.phone && (
            <div className="r2-kv"><span className="k">Phone</span>{blurPremium ? <span className="v"><BlurredText blur>{venture.phone}</BlurredText></span> : <a className="v" href={`tel:${venture.phone}`}>{venture.phone}</a>}</div>
          )}
        </div>
      </div>
    </>
  )
}
