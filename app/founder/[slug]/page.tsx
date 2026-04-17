import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canAccessFullProfile, canAccessPremiumFields } from "@/lib/subscription"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BlurredText } from "@/components/blurred-gate"
import type { Profile } from "@/lib/types"

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default async function FounderProfilePage({
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

  const tier = profile?.subscription_tier ?? "explorer"
  const canFull = canAccessFullProfile(tier)

  // Fetch founder by slug
  const { data: founderRaw } = await supabase
    .from("people")
    .select("*")
    .eq("slug", slug)
    .single()

  if (!founderRaw) notFound()

  const founder = founderRaw as {
    id: string
    full_name: string
    slug: string
    bio: string | null
    email: string | null
    linkedin_url: string | null
    twitter_url: string | null
    google_scholar_url: string | null
    github_url: string | null
    personal_website_url: string | null
    previous_exits: number
    big_tech_employer: string | null
    academic_lab: string | null
    has_phd: boolean
    is_repeat_founder: boolean
    has_big_tech_background: boolean
  }

  const canPremium = canAccessPremiumFields(tier)

  // Fetch the startups this founder is associated with
  const { data: ventureLinksRaw } = await supabase
    .from("organization_people")
    .select("role, organizations(id, name, slug)")
    .eq("person_id", founder.id)
    .eq("is_founder", true)

  const ventures = (ventureLinksRaw ?? []).map((row: { role: string | null; organizations: unknown }) => ({
    role: row.role,
    ...(row.organizations as { id: string; name: string; slug: string }),
  }))

  // Get primary role from first venture link
  const primaryRole = ventures[0]?.role ?? null

  return (
    <main className="page-container py-8 pb-20">
      <div className="mx-auto max-w-[860px]">

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
              {founder.full_name}
            </h1>
            {primaryRole && (
              <p className="text-[14px] font-medium text-primary">{primaryRole}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {founder.linkedin_url && (
              <a
                href={founder.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors duration-300 hover:bg-accent"
              >
                LinkedIn ↗
              </a>
            )}
            {founder.github_url && (
              <a
                href={founder.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors duration-300 hover:bg-accent"
              >
                GitHub ↗
              </a>
            )}
            {founder.google_scholar_url && (
              <a
                href={founder.google_scholar_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors duration-300 hover:bg-accent"
              >
                Google Scholar ↗
              </a>
            )}
          </div>
        </div>

        {/* Contact — visible to pro, blurred for explorer */}
        {founder.email && (
          <div className="mb-4 text-[13px] text-muted-foreground">
            <BlurredText blur={!canPremium}>{founder.email}</BlurredText>
          </div>
        )}

        <Separator className="mb-8" />

        {/* Bio (always visible) */}
        {founder.bio && (
          <p className="mb-8 text-[15px] leading-relaxed text-foreground">
            {founder.bio}
          </p>
        )}

        {/* Premium content gate */}
        {!canFull ? (
          <UpgradeGate tier={tier} />
        ) : (
          <PremiumContent founder={founder} ventures={ventures} />
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
        Full founder profile is Professional-only
      </p>
      <p className="mb-5 text-[13px] text-muted-foreground">
        Upgrade to Professional for full founder backgrounds, exit history, and pedigree analysis.
      </p>
      <Button size="sm" asChild>
        <Link href="/pricing">Upgrade to Professional</Link>
      </Button>
    </div>
  )
}

// ------------------------------------------------------------------
// Premium content
// ------------------------------------------------------------------

type FounderDetail = {
  id: string
  full_name: string
  slug: string
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

type VentureLink = {
  id: string
  name: string
  slug: string
  role: string | null
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
      {label}
    </p>
  )
}

function PremiumContent({
  founder,
  ventures,
}: {
  founder: FounderDetail
  ventures: VentureLink[]
}) {
  const hasPedigreeDetails =
    founder.big_tech_employer ||
    founder.academic_lab ||
    founder.previous_exits > 0

  return (
    <div className="space-y-10">

      {/* Pedigree */}
      {hasPedigreeDetails && (
        <section>
          <SectionHeader label="Pedigree" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">

            {founder.big_tech_employer && (
              <div className="border-l-2 border-l-primary bg-accent p-4">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Big Tech Background
                </p>
                <p className="font-serif text-[14px] font-semibold text-foreground">
                  {founder.big_tech_employer}
                </p>
              </div>
            )}

            {founder.academic_lab && (
              <div className="border-l-2 border-l-primary bg-accent p-4">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {founder.has_phd ? "PhD / Academic Lab" : "Academic Lab"}
                </p>
                <p className="font-serif text-[14px] font-semibold text-foreground">
                  {founder.academic_lab}
                </p>
              </div>
            )}

            {founder.previous_exits > 0 && (
              <div className="border-l-2 border-l-primary bg-accent p-4 sm:col-span-2">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Previous Exits
                </p>
                <p className="font-serif text-[14px] font-semibold text-foreground">
                  {founder.previous_exits} exit{founder.previous_exits !== 1 ? "s" : ""}
                </p>
              </div>
            )}

          </div>
        </section>
      )}

      {/* Current / associated ventures */}
      {ventures.length > 0 && (
        <section>
          <SectionHeader label="Associated Ventures" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ventures.map((v) => (
              <Link
                key={v.id}
                href={`/startup/${v.slug}`}
                className="block border-l-2 border-l-border bg-accent p-4 transition-colors duration-300 hover:border-l-primary hover:bg-secondary"
              >
                <p className="font-serif text-[14px] font-bold text-foreground">{v.name}</p>
                {v.role && (
                  <p className="mt-0.5 text-[12px] font-medium text-primary">{v.role}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
