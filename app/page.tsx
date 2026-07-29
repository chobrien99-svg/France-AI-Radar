import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createServiceClient } from "@/lib/supabase/server"
import { tagStrengthLabel } from "@/lib/types"

type SampleCard = {
  id: string
  meta: string
  sector: string | null
  badges: { label: string; strength: string }[]
  description: string | null
  signalCount: number
  signalDot: "green" | "amber" | "red"
}

const signalDotClass: Record<string, string> = {
  green: "bg-accent-green",
  amber: "bg-[#8a6d00]",
  red: "bg-destructive",
}

const badgeClass: Record<string, string> = {
  positive: "badge-signal badge-signal-positive",
  warning: "badge-signal badge-signal-warning",
  risk: "badge-signal badge-signal-risk",
  neutral: "badge-signal badge-signal-neutral",
}

function foundedLabel(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `Founded ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
}

function signalDotFor(count: number): SampleCard["signalDot"] {
  if (count >= 3) return "green"
  if (count >= 1) return "amber"
  return "red"
}

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const svc = await createServiceClient()

  // Fetch live stats
  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const orgIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)

  const { count: startupCount } = await svc
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .in("id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "active")

  const { count: signalCount } = await svc
    .from("signals")
    .select("id", { count: "exact", head: true })
    .in("organization_id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"])

  const { data: sectorRows } = await svc
    .from("organization_sectors")
    .select("sector_id")
    .in("organization_id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"])
  const uniqueSectors = new Set((sectorRows ?? []).map((r: { sector_id: string }) => r.sector_id))

  // Sample cards: 3 recent active AI Radar startups, name hidden, no link
  const { data: sampleRows } = orgIds.length > 0
    ? await svc
        .from("organizations")
        .select(
          "id, description, founded_date, signal_count, cities!organizations_city_id_fkey(name), organization_tags(id, tag, strength)"
        )
        .in("id", orgIds)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(3)
    : { data: [] }

  const sampleIds = (sampleRows ?? []).map((r: { id: string }) => r.id)
  const { data: sampleSectorRows } = sampleIds.length > 0
    ? await svc
        .from("organization_sectors")
        .select("organization_id, sectors(name)")
        .in("organization_id", sampleIds)
    : { data: [] }
  const sectorByOrg = new Map<string, string>()
  for (const row of (sampleSectorRows ?? []) as Array<{ organization_id: string; sectors: { name: string } | { name: string }[] | null }>) {
    const sec = Array.isArray(row.sectors) ? row.sectors[0] : row.sectors
    if (sec && !sectorByOrg.has(row.organization_id)) sectorByOrg.set(row.organization_id, sec.name)
  }

  const sampleCards: SampleCard[] = (sampleRows ?? []).map((row: {
    id: string
    description: string | null
    founded_date: string | null
    signal_count: number
    cities: { name: string } | { name: string }[] | null
    organization_tags: { id: string; tag: string; strength: number }[]
  }) => {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities
    const meta = [city?.name, foundedLabel(row.founded_date)].filter(Boolean).join(" · ")
    const badges = row.organization_tags.slice(0, 2).map((t) => ({
      label: t.tag,
      strength: tagStrengthLabel(t.strength),
    }))
    return {
      id: row.id,
      meta: meta || "France",
      sector: sectorByOrg.get(row.id) ?? null,
      badges,
      description: row.description,
      signalCount: row.signal_count ?? 0,
      signalDot: signalDotFor(row.signal_count ?? 0),
    }
  })

  return (
    <div className="min-h-screen bg-background">
      {/* -- NAV -- */}
      <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md" style={{ borderBottom: '1px solid rgba(193, 199, 206, 0.25)' }}>
        <div className="page-container flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-primary text-[12px] font-extrabold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
              AR
            </div>
            <span className="font-serif text-[15px] font-bold tracking-tight text-foreground">
              AI Radar
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="px-3.5 py-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/database"
              className="px-3.5 py-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              Database
            </Link>
            <Link
              href="/pricing"
              className="px-3.5 py-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              Pricing
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/pricing">Get Access</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="page-container">
        {/* -- HERO -- */}
        <section className="py-20 text-center md:py-24">
          {/* Kicker */}
          <div className="mb-6 inline-flex items-center gap-2 border-l-2 border-l-primary bg-primary/10 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-primary">
            Investor Intelligence Platform
          </div>

          <h1 className="mb-4 font-serif text-[clamp(32px,5vw,52px)] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
            The France AI Radar
            <br />
            <span className="text-primary">Discover AI startups before the market.</span>
          </h1>

          <p className="mx-auto mb-8 max-w-[560px] text-[17px] leading-[1.65] text-muted-foreground">
            We detect AI startups across France at their earliest signal - when they are incorporated, still in stealth, or just beginning to leave a public trace. Structured intelligence built from administrative filings, founder activity, and ecosystem signals, designed for VCs, corporate strategists, and LPs.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/database">Explore the Radar</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </section>

        {/* -- PROOF BAR -- */}
        <section className="mb-[72px]">
          <div className="mx-auto grid max-w-[720px] grid-cols-4 overflow-hidden bg-card">
            {[
              { num: String(startupCount ?? 0), label: "Startups Tracked" },
              { num: String(signalCount ?? 0), label: "Signals Detected" },
              { num: String(uniqueSectors.size), label: "Sectors Covered" },
              { num: "Weekly", label: "Updated" },
            ].map((item, idx) => (
              <div
                key={item.label}
                className={`px-4 py-5 text-center ${idx > 0 ? "border-l border-border/40" : ""}`}
              >
                <div className="font-serif text-[22px] font-bold tracking-tight text-foreground">
                  {item.num}
                </div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -- VALUE PROPS -- */}
        <section className="py-[72px]">
          <p className="section-kicker mb-2 text-center">Why France AI Radar</p>
          <h2 className="mb-2 text-center font-serif text-2xl font-bold tracking-[-0.02em] text-foreground">
            Intelligence, Not Noise
          </h2>
          <p className="mb-12 text-center text-[15px] text-muted-foreground">
            What separates France AI Radar from startup directories and news feeds.
          </p>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                icon: "⚡",
                title: "Signal Detection",
                body: "Fundraising moves, corporate restructuring, key hires, and pivots — detected and surfaced before they hit the press. Know what's happening, not what happened.",
              },
              {
                icon: "👤",
                title: "Founder Intelligence",
                body: "Big Tech alumni, repeat founders, academic spinouts, and corporate reboots — every founder's background mapped and scored for signal strength.",
              },
              {
                icon: "◎",
                title: "Sector Mapping",
                body: "AI Agents, Robotics, BioAI, DeepTech, and 44 more sectors — filterable, exportable, and always current. See the full landscape, not just the loudest startups.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="border-l-2 border-l-primary bg-card p-7 transition-colors duration-300 hover:bg-accent"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center bg-primary/10 text-[18px]">
                  {card.icon}
                </div>
                <h3 className="mb-2 font-serif text-[15px] font-bold tracking-tight text-foreground">
                  {card.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* -- SAMPLE CARDS -- */}
        <section className="pb-[72px]">
          <p className="section-kicker mb-2 text-center">Live from the database</p>
          <h2 className="mb-2 text-center font-serif text-xl font-bold tracking-[-0.02em] text-foreground">
            See What&apos;s Inside
          </h2>
          <p className="mb-8 text-center text-[14px] text-muted-foreground">
            Real intelligence cards from this week&apos;s updates.
          </p>

          <div className="mx-auto grid max-w-[960px] grid-cols-1 gap-4 md:grid-cols-3">
            {sampleCards.map((card) => (
              <div key={card.id} className="data-card p-5">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-[15px] font-bold tracking-tight text-foreground">
                      Stealth Startup
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {card.meta}
                    </div>
                  </div>
                  {card.sector && (
                    <span className="badge-signal badge-signal-neutral whitespace-nowrap">
                      {card.sector}
                    </span>
                  )}
                </div>

                {/* Badges */}
                {card.badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {card.badges.map((b) => (
                      <span key={b.label} className={badgeClass[b.strength] ?? badgeClass.neutral}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Body */}
                {card.description && (
                  <p className="mb-1.5 text-[13px] leading-snug text-foreground line-clamp-3">
                    {card.description}
                  </p>
                )}

                {/* Signal footer */}
                <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
                  <span
                    className={`h-[7px] w-[7px] shrink-0 rounded-full ${signalDotClass[card.signalDot]}`}
                  />
                  {card.signalCount} signal{card.signalCount !== 1 ? "s" : ""} tracked
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -- BOTTOM CTA -- */}
        <section className="pb-20 text-center">
          <h2 className="mb-3 font-serif text-2xl font-bold tracking-[-0.02em] text-foreground">
            Ready to see the full picture?
          </h2>
          <p className="mb-6 text-[15px] text-muted-foreground">
            Join investors who track the French AI ecosystem with clarity.
          </p>
          <Button size="lg" asChild>
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </section>
      </div>

      {/* -- FOOTER -- */}
      <footer className="py-6" style={{ borderTop: '1px solid rgba(193, 199, 206, 0.25)' }}>
        <div className="page-container flex flex-col items-center justify-between gap-2 text-[12px] text-muted-foreground md:flex-row">
          <span>France AI Radar by French Tech Journal</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors duration-300">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors duration-300">Terms</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors duration-300">Contact</Link>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
