import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canAccessFullProfile, getExportLimit, SIGNAL_TYPE_LABELS } from "@/lib/subscription"
import { tagStrengthLabel } from "@/lib/types"
import type { OrganizationProfile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SaveButton } from "@/components/startup/save-button"
import { ExportCsvButton } from "@/components/startup/export-csv-button"
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
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  risk: "bg-rose-500",
  neutral: "bg-zinc-400",
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
      .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end")
      .eq("id", user.id)
      .single()
    profile = data
  }

  const tier = profile?.subscription_tier ?? "free"
  const canFull = canAccessFullProfile(tier)

  // Export quota
  const exportLimit = getExportLimit(tier)
  let exportRemaining: number | null = null
  if (user && exportLimit !== null && exportLimit > 0) {
    const period = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: usage } = await supabase
      .from("export_usage")
      .select("export_count")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle()
    exportRemaining = exportLimit - (usage?.export_count ?? 0)
  } else if (exportLimit === null) {
    exportRemaining = null // unlimited
  }

  // Fetch venture
  const { data: ventureRaw } = await supabase
    .from("organizations")
    .select("*, organization_tags(id, tag, strength), organization_profiles(*)")
    .eq("slug", slug)
    .eq("organization_type", "startup")
    .eq("status", "active")
    .single()

  if (!ventureRaw) notFound()
  const venture = ventureRaw as Venture

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
    .select("people(*)")
    .eq("organization_id", venture.id)
    .eq("is_founder", true)

  // Check watchlist status
  let isBookmarked = false
  if (user) {
    const { data: wl } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", venture.id)
      .maybeSingle()
    isBookmarked = !!wl
  }

  // Resolve profile fields from joined organization_profiles
  const profileData = Array.isArray(venture.organization_profiles)
    ? venture.organization_profiles[0] ?? null
    : venture.organization_profiles ?? null

  const founders = (foundersRaw ?? []).map(
    (row: { people: unknown }) => row.people
  ) as {
    id: string
    full_name: string
    slug: string | null
    role: string | null
    bio: string | null
    linkedin_url: string | null
    previous_exits: number
    big_tech_employer: string | null
    academic_lab: string | null
    has_phd: boolean
    is_repeat_founder: boolean
    has_big_tech_background: boolean
  }[]

  return (
    <main className="page-container py-8 pb-20">
      <div className="mx-auto max-w-[960px]">

        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/database"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to Database
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">
              {venture.name}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {[
                venture.city,
                venture.founded_date
                  ? `Founded ${formatDateShort(venture.founded_date)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
            <Button variant="outline" size="sm" className="text-[13px]">
              Share
            </Button>
            <Button size="sm" className="text-[13px]">
              Set Alert
            </Button>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Description (always visible) */}
        {venture.description && (
          <p className="mb-8 text-[15px] leading-relaxed text-foreground">
            {venture.description}
          </p>
        )}

        {/* Premium content gate */}
        {!canFull ? (
          <UpgradeGate tier={tier} />
        ) : (
          <PremiumContent
            venture={venture}
            signals={signals}
            founders={founders}
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

function UpgradeGate({ tier }: { tier: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-8 py-10 text-center shadow-xs">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
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
      <p className="mb-1 text-[15px] font-semibold text-foreground">
        Full investor brief is Professional-only
      </p>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {tier === "free"
          ? "Upgrade to Explorer to browse more startups, or Professional for full signal timelines, founder analysis, and investor briefs."
          : "Upgrade to Professional for full signal timelines, founder analysis, and investor briefs."}
      </p>
      <Button size="sm" asChild>
        <Link href="/pricing">Upgrade to Professional →</Link>
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
  strength: string
  title: string
  description: string | null
}

type FounderLocal = {
  id: string
  full_name: string
  slug: string | null
  role: string | null
  bio: string | null
  linkedin_url: string | null
  previous_exits: number
  big_tech_employer: string | null
  academic_lab: string | null
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
}

function PremiumContent({
  venture,
  signals,
  founders,
  profileData,
}: {
  venture: Venture
  signals: Signal[]
  founders: FounderLocal[]
  profileData: OrganizationProfile | null
}) {
  const hasContact =
    venture.website || venture.linkedin_url || venture.email || venture.phone

  return (
    <div className="space-y-10">
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
              />
            )}
          </div>
        </section>
      )}

      {/* Investor Brief */}
      {profileData?.investor_brief && (
        <section>
          <SectionHeader label="Investor Brief" />
          <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-foreground">
            {profileData.investor_brief.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {profileData.analyst_note && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">
                Why this matters
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                {profileData.analyst_note}
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
            <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-6">
              {signals.map((signal) => (
                <div key={signal.id} className="relative pl-6">
                  {/* Dot */}
                  <div
                    className={`absolute left-[-4.5px] top-[5px] h-[9px] w-[9px] rounded-full border-2 border-background ${SIGNAL_DOT[signal.strength] ?? SIGNAL_DOT.neutral}`}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {formatDate(signal.signal_date)}
                    {" · "}
                    {SIGNAL_TYPE_LABELS[signal.signal_type] ?? signal.signal_type}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-foreground">
                    {signal.title}
                  </p>
                  {signal.description && (
                    <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                      {signal.description}
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
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    {founder.slug ? (
                      <Link
                        href={`/founder/${founder.slug}`}
                        className="text-[14px] font-bold text-foreground underline-offset-2 hover:underline"
                      >
                        {founder.full_name}
                      </Link>
                    ) : (
                      <p className="text-[14px] font-bold text-foreground">
                        {founder.full_name}
                      </p>
                    )}
                    {founder.role && (
                      <p className="text-[12px] font-medium text-primary">
                        {founder.role}
                      </p>
                    )}
                  </div>
                  {founder.linkedin_url && (
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

                {founder.bio && (
                  <p className="text-[13px] leading-snug text-muted-foreground">
                    {founder.bio}
                  </p>
                )}

                {/* Pedigree summary */}
                <div className="mt-3 space-y-1.5">
                  {founder.big_tech_employer && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">Big Tech: </span>
                      {founder.big_tech_employer}
                    </p>
                  )}
                  {founder.academic_lab && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {founder.has_phd ? "PhD: " : "Lab: "}
                      </span>
                      {founder.academic_lab}
                    </p>
                  )}
                  {founder.previous_exits > 0 && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">Exits: </span>
                      {founder.previous_exits}
                    </p>
                  )}
                </div>

              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product & Market */}
      {(profileData?.product_description ||
        profileData?.target_market ||
        profileData?.competitive_landscape) && (
        <section>
          <SectionHeader label="Product & Market" />
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed">
            {profileData.product_description && (
              <p>
                <strong className="font-semibold text-foreground">
                  What they&apos;re building:{" "}
                </strong>
                <span className="text-muted-foreground">
                  {profileData.product_description}
                </span>
              </p>
            )}
            {profileData.target_market && (
              <p>
                <strong className="font-semibold text-foreground">
                  Target market:{" "}
                </strong>
                <span className="text-muted-foreground">
                  {profileData.target_market}
                </span>
              </p>
            )}
            {profileData.competitive_landscape && (
              <p>
                <strong className="font-semibold text-foreground">
                  Competitive landscape:{" "}
                </strong>
                <span className="text-muted-foreground">
                  {profileData.competitive_landscape}
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Funding */}
      {(venture.total_raised_eur ||
        venture.last_round ||
        profileData?.est_next_raise) && (
        <section>
          <SectionHeader label="Funding" />
          <div className="mt-4 data-card-compact p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="metric-label">Total Raised</p>
                <p className="metric-value mt-1 text-base">
                  {formatEur(venture.total_raised_eur)}
                </p>
              </div>
              <div>
                <p className="metric-label">Last Round</p>
                <p className="metric-value mt-1 text-base">
                  {venture.last_round ?? "—"}
                </p>
              </div>
              <div>
                <p className="metric-label">Est. Next Raise</p>
                <p className="metric-value mt-1 text-base">
                  {profileData?.est_next_raise ?? "—"}
                </p>
              </div>
            </div>
            {profileData?.fundraising_signal_summary && (
              <>
                <Separator className="my-4" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {profileData.fundraising_signal_summary}
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ContactItem({
  icon,
  label,
  href,
  display,
}: {
  icon: React.ReactNode
  label: string
  href: string
  display: string
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-[13px] transition-colors hover:bg-accent"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{display}</p>
      </div>
    </a>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-border pb-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
