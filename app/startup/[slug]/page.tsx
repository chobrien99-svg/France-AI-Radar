import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canAccessFullProfile, canAccessPremiumFields, getProfileViewLimit, getExportLimit, canSaveAndList, canSetAlerts, SIGNAL_TYPE_LABELS } from "@/lib/subscription"
import { tagStrengthLabel, signalStrengthLabel } from "@/lib/types"
import type { OrganizationProfile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SaveButton } from "@/components/startup/save-button"
import { AlertButton } from "@/components/startup/alert-button"
import { AddToListButton } from "@/components/startup/add-to-list-button"
import { ExportCsvButton } from "@/components/startup/export-csv-button"
import { BlurredGate, BlurredText } from "@/components/blurred-gate"
import { AnalyticsPageTrack } from "@/components/analytics-page-track"
import { AnalyticsIdentifier } from "@/components/analytics-identifier"
import type { Venture, Profile } from "@/lib/types"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const BADGE_CLASS: Record<string, string> = {
  positive: "badge-signal badge-signal-positive",
  warning: "badge-signal badge-signal-warning",
  risk: "badge-signal badge-signal-risk",
  neutral: "badge-signal badge-signal-neutral",
}

const SIGNAL_DOT: Record<string, string> = {
  positive: "bg-accent-green",
  warning: "bg-[#8a6d00]",
  risk: "bg-destructive",
  neutral: "bg-[#72787e]",
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  })
}

function formatEur(amount: number | null): string {
  if (!amount) return "—"
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`
  return `€${amount}`
}

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
  const canPremium = canAccessPremiumFields(tier)
  const canSave = canSaveAndList(tier)
  const canAlert = canSetAlerts(tier)

  // Fetch venture first (needed for view tracking)
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Fetch venture — admins can see any status, others only active
  let ventureQuery = supabase
    .from("organizations")
    .select("*, cities(id, name), organization_tags(id, tag, strength), organization_profiles(*)")
    .eq("slug", slug)
    .eq("organization_type", "startup")

  if (!isAdmin) {
    ventureQuery = ventureQuery.eq("status", "active")
  }

  const { data: ventureRaw } = await ventureQuery.single()

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

  // Resolve profile fields from joined organization_profiles
  const profileData = Array.isArray(venture.organization_profiles)
    ? venture.organization_profiles[0] ?? null
    : venture.organization_profiles ?? null

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

  return (
    <main className="page-container py-8 pb-20">
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
      <div className="mx-auto max-w-[960px]">

        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/database"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            ← Back to Database
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-serif text-[26px] font-bold tracking-tight text-foreground">
              {venture.name}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {[
                venture.cities?.name,
                venture.founded_date
                  ? `Founded ${formatDateShort(venture.founded_date)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {venture.first_seen_at && (
              <p className="text-[12px] text-muted-foreground">
                First seen {formatDateShort(venture.first_seen_at)}
              </p>
            )}
            {venture.organization_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {venture.organization_tags.map((tag) => {
                  const strengthLabel = tagStrengthLabel(tag.strength)
                  return (
                    <span
                      key={tag.id}
                      className={BADGE_CLASS[strengthLabel] ?? BADGE_CLASS.neutral}
                    >
                      {tag.tag}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" className="text-[13px] border-primary text-primary" asChild>
                <Link href={`/admin/startups/${venture.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canSave && (
              <>
                <ExportCsvButton
                  slug={venture.slug}
                  isLoggedIn={!!user}
                  tier={tier}
                  remaining={exportRemaining}
                />
                <SaveButton
                  startupId={venture.id}
                  initialSaved={isBookmarked}
                  isLoggedIn={!!user}
                />
                <AddToListButton
                  startupId={venture.id}
                  isLoggedIn={!!user}
                />
              </>
            )}
            <Button variant="outline" size="sm" className="text-[13px]">
              Share
            </Button>
            {canAlert ? (
              <AlertButton
                startupId={venture.id}
                initialAlert={hasAlert}
                isLoggedIn={!!user}
              />
            ) : (
              <Button size="sm" className="text-[13px]" asChild>
                <Link href="/pricing">Set Alert</Link>
              </Button>
            )}
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Description (always visible) */}
        {venture.description && (
          <p className="mb-8 text-[15px] leading-relaxed text-foreground">
            {venture.description}
          </p>
        )}

        {/* Explorer view limit exceeded */}
        {canFull && !hasViewAccess && (
          <UpgradeGate tier={tier} viewsUsed={profileViewsUsed} viewLimit={viewLimit} />
        )}

        {/* Free tier — full upgrade gate */}
        {!canFull && (
          <UpgradeGate tier={tier} />
        )}

        {/* Explorer with views remaining — show content with blurred premium fields */}
        {canFull && hasViewAccess && !canPremium && (
          <PremiumContent
            venture={venture}
            signals={signals}
            founders={founders}
            programs={programs}
            profileData={profileData}
            blurPremium
          />
        )}

        {/* Professional+ — full access */}
        {canFull && hasViewAccess && canPremium && (
          <PremiumContent
            venture={venture}
            signals={signals}
            founders={founders}
            programs={programs}
            profileData={profileData}
          />
        )}
      </div>
    </main>
  )
}

// ------------------------------------------------------------------
// Upgrade gate
// ------------------------------------------------------------------

function UpgradeGate({ tier, viewsUsed, viewLimit }: { tier: string; viewsUsed?: number; viewLimit?: number | null }) {
  const isViewLimitHit = viewsUsed !== undefined && viewLimit !== undefined && viewLimit !== null

  return (
    <div className="border-l-2 border-l-primary bg-card px-8 py-10 text-center">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center bg-primary/10">
        <svg
          className="h-5 w-5 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <p className="mb-1 font-serif text-[15px] font-semibold text-foreground">
        {isViewLimitHit
          ? `You've viewed ${viewsUsed} of ${viewLimit} profiles this month`
          : "Full investor brief is Professional-only"}
      </p>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {isViewLimitHit
          ? "Upgrade to Professional for unlimited profile views, full signal timelines, founder analysis, and investor briefs."
          : "Upgrade to Professional for full signal timelines, founder analysis, and investor briefs."}
      </p>
      <Button size="sm" asChild>
        <Link href="/pricing">Upgrade to Professional</Link>
      </Button>
    </div>
  )
}

// ------------------------------------------------------------------
// Premium content (professional+)
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

function PremiumContent({
  venture,
  signals,
  founders,
  programs,
  profileData,
  blurPremium = false,
}: {
  venture: Venture
  signals: Signal[]
  founders: FounderLocal[]
  programs: ProgramLink[]
  profileData: OrganizationProfile | null
  blurPremium?: boolean
}) {
  const hasContact =
    venture.website || venture.linkedin_url || venture.email || venture.phone

  return (
    <div className="space-y-10">
      {/* Investor Brief */}
      {profileData?.investor_brief && (
        <section>
          <SectionHeader label="Investor Brief" />
          <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-foreground">
            {profileData.investor_brief.split(/\n\n+/).map((para, i) => (
              <p key={i}><BlurredText blur={blurPremium}>{para}</BlurredText></p>
            ))}
          </div>
          {profileData.analyst_note && (
            <div className="mt-4 border-l-2 border-l-accent-green bg-accent-green/5 px-4 py-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-accent-green">
                Why this matters
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                <BlurredText blur={blurPremium}>{profileData.analyst_note}</BlurredText>
              </p>
            </div>
          )}
        </section>
      )}

      {/* Key Signals Timeline */}
      {signals.length > 0 && (
        <section>
          <SectionHeader label="Key Signals" />
          <div className="mt-4 relative pl-4">
            {/* Timeline vertical line */}
            <div className="absolute left-0 top-2 bottom-2 w-px bg-border/40" />

            <div className="space-y-6">
              {signals.map((signal) => (
                <div key={signal.id} className="relative pl-6">
                  {/* Dot */}
                  <div
                    className={`absolute left-[-4.5px] top-[5px] h-[9px] w-[9px] rounded-full border-2 border-background ${SIGNAL_DOT[signalStrengthLabel(signal.strength)] ?? SIGNAL_DOT.neutral}`}
                  />
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {formatDate(signal.signal_date)}
                    {" · "}
                    {SIGNAL_TYPE_LABELS[signal.signal_type] ?? signal.signal_type}
                  </p>
                  <p className="mt-0.5 font-serif text-[14px] font-semibold text-foreground">
                    <BlurredText blur={blurPremium}>{signal.title}</BlurredText>
                  </p>
                  {signal.description && (
                    <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                      <BlurredText blur={blurPremium}>{signal.description}</BlurredText>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Founders */}
      {founders.length > 0 && (
        <section>
          <SectionHeader label="Founding Team" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {founders.map((founder) => (
              <div
                key={founder.id}
                className="border-l-2 border-l-primary bg-accent p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    {founder.slug && !blurPremium ? (
                      <Link
                        href={`/founder/${founder.slug}`}
                        className="font-serif text-[14px] font-bold text-foreground underline-offset-2 hover:underline"
                      >
                        {founder.full_name}
                      </Link>
                    ) : (
                      <p className="font-serif text-[14px] font-bold text-foreground">
                        <BlurredText blur={blurPremium}>{founder.full_name}</BlurredText>
                      </p>
                    )}
                    {founder.role && (
                      <p className="text-[12px] font-medium text-primary">
                        <BlurredText blur={blurPremium}>{founder.role}</BlurredText>
                      </p>
                    )}
                  </div>
                  {founder.linkedin_url && !blurPremium && (
                    <a
                      href={founder.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      LinkedIn
                    </a>
                  )}
                </div>

                {founder.short_bio && (
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    <BlurredText blur={blurPremium}>{founder.short_bio}</BlurredText>
                  </p>
                )}

                {/* Pedigree summary */}
                <div className="mt-3 space-y-1.5">
                  {founder.big_tech_employer && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">Big Tech: </span>
                      <BlurredText blur={blurPremium}>{founder.big_tech_employer}</BlurredText>
                    </p>
                  )}
                  {founder.academic_lab && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {founder.has_phd ? "PhD: " : "Lab: "}
                      </span>
                      <BlurredText blur={blurPremium}>{founder.academic_lab}</BlurredText>
                    </p>
                  )}
                  {founder.previous_exits > 0 && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">Exits: </span>
                      <BlurredText blur={blurPremium}>{founder.previous_exits}</BlurredText>
                    </p>
                  )}
                </div>

              </div>
            ))}
          </div>
        </section>
      )}

      {/* Programs & Affiliations */}
      {programs.length > 0 && (
        <section>
          <SectionHeader label="Programs & Affiliations" />
          <div className="mt-4 space-y-2">
            {programs.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-accent p-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    <BlurredText blur={blurPremium}>{p.program_name}</BlurredText>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <BlurredText blur={blurPremium}>
                      {[PROGRAM_TYPE_LABELS[p.program_type] ?? p.program_type, p.edition_label, p.year, p.membership_role].filter(Boolean).join(" · ")}
                    </BlurredText>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product & Market */}
      {(profileData?.product_description ||
        profileData?.target_market ||
        profileData?.competitive_landscape ||
        profileData?.technical_thesis) && (
        <section>
          <SectionHeader label="Product & Market" />
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed">
            {profileData.product_description && (
              <p>
                <strong className="font-semibold text-foreground">
                  What they&apos;re building:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.product_description}</BlurredText>
                </span>
              </p>
            )}
            {profileData.target_market && (
              <p>
                <strong className="font-semibold text-foreground">
                  Target market:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.target_market}</BlurredText>
                </span>
              </p>
            )}
            {profileData.competitive_landscape && (
              <p>
                <strong className="font-semibold text-foreground">
                  Competitive landscape:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.competitive_landscape}</BlurredText>
                </span>
              </p>
            )}
            {profileData.technical_thesis && (
              <p>
                <strong className="font-semibold text-foreground">
                  Technical thesis:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.technical_thesis}</BlurredText>
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Strategy */}
      {(profileData?.current_strategy ||
        profileData?.business_model_hypothesis) && (
        <section>
          <SectionHeader label="Strategy" />
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed">
            {profileData.current_strategy && (
              <p>
                <strong className="font-semibold text-foreground">
                  Current strategy:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.current_strategy}</BlurredText>
                </span>
              </p>
            )}
            {profileData.business_model_hypothesis && (
              <p>
                <strong className="font-semibold text-foreground">
                  Business model:{" "}
                </strong>
                <span className="text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.business_model_hypothesis}</BlurredText>
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Contact & Web Presence */}
      {hasContact && (
        <section>
          <SectionHeader label="Contact & Web Presence" />
          <div className="mt-4 flex flex-wrap gap-4">
            {venture.website && (
              <ContactItem
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5C8 1.5 5.5 4.5 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4.5 10.5 8S8 14.5 8 14.5M1.5 8h13"/></svg>
                }
                label="Website"
                href={venture.website}
                display={venture.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                blur={blurPremium}
              />
            )}
            {venture.linkedin_url && (
              <ContactItem
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 13.5 1h-11zm1.3 2.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm-1 3.5h2V12h-2V7zm3 0h2v.7c.3-.5 1-1 2-1 2 0 2.5 1.4 2.5 3.1V12h-2V10c0-.8 0-1.7-1-1.7s-1.5.8-1.5 1.7v2h-2V7z"/></svg>
                }
                label="LinkedIn"
                href={venture.linkedin_url}
                display="View profile"
                blur={blurPremium}
              />
            )}
            {venture.email && (
              <ContactItem
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="m1.5 4 6.5 5 6.5-5"/></svg>
                }
                label="Email"
                href={`mailto:${venture.email}`}
                display={venture.email}
                blur={blurPremium}
              />
            )}
            {venture.phone && (
              <ContactItem
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h1a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 11 2.5 1.5 1.5 0 0 1 12.5 1h1A1.5 1.5 0 0 1 15 2.5v1A12.5 12.5 0 0 1 2.5 16h-1A1.5 1.5 0 0 1 0 14.5v-1A1.5 1.5 0 0 1 1.5 12"/></svg>
                }
                label="Phone"
                href={`tel:${venture.phone}`}
                display={venture.phone}
                blur={blurPremium}
              />
            )}
          </div>
        </section>
      )}

      {/* Funding */}
      {(venture.total_raised_eur ||
        venture.last_round ||
        profileData?.est_next_raise ||
        profileData?.fundraising_signal_summary) && (
        <section>
          <SectionHeader label="Funding" />
          <div className="mt-4 data-card-compact bg-card p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="metric-label">Total Raised</p>
                <p className="metric-value mt-1 text-base">
                  <BlurredText blur={blurPremium}>{formatEur(venture.total_raised_eur)}</BlurredText>
                </p>
              </div>
              <div>
                <p className="metric-label">Last Round</p>
                <p className="metric-value mt-1 text-base">
                  <BlurredText blur={blurPremium}>{venture.last_round ?? "—"}</BlurredText>
                </p>
              </div>
              <div>
                <p className="metric-label">Est. Next Raise</p>
                <p className="metric-value mt-1 text-base">
                  <BlurredText blur={blurPremium}>{profileData?.est_next_raise ?? "—"}</BlurredText>
                </p>
              </div>
            </div>
            {profileData?.fundraising_signal_summary && (
              <>
                <Separator className="my-4" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  <BlurredText blur={blurPremium}>{profileData.fundraising_signal_summary}</BlurredText>
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* Legal */}
      {profileData?.entity_complexity && (
        <section>
          <SectionHeader label="Legal" />
          <div className="mt-4 text-[14px] leading-relaxed">
            <p>
              <strong className="font-semibold text-foreground">
                Entity complexity:{" "}
              </strong>
              <span className="text-muted-foreground">
                <BlurredText blur={blurPremium}>{profileData.entity_complexity}</BlurredText>
              </span>
            </p>
          </div>
        </section>
      )}

      {/* Upgrade banner for Explorer */}
      {blurPremium && (
        <div className="mt-6 border-l-2 border-l-primary bg-card px-6 py-5 text-center">
          <p className="mb-1 font-serif text-[14px] font-semibold text-foreground">
            Unlock the full intelligence brief
          </p>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Upgrade to Professional for unblurred investor briefs, signal timelines, founder analysis, and contact details.
          </p>
          <Button size="sm" asChild>
            <Link href="/pricing">Upgrade to Professional</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function ContactItem({
  icon,
  label,
  href,
  display,
  blur = false,
}: {
  icon: React.ReactNode
  label: string
  href: string
  display: string
  blur?: boolean
}) {
  const Wrapper = blur ? "div" : "a"
  const wrapperProps = blur
    ? {}
    : {
        href,
        target: href.startsWith("http") ? "_blank" as const : undefined,
        rel: href.startsWith("http") ? "noopener noreferrer" : undefined,
      }

  return (
    <Wrapper
      {...wrapperProps}
      className="flex items-center gap-2 border-l-2 border-l-border bg-card px-4 py-3 text-[13px] transition-colors duration-300 hover:bg-accent"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">
          <BlurredText blur={blur}>{display}</BlurredText>
        </p>
      </div>
    </Wrapper>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-border/40 pb-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
