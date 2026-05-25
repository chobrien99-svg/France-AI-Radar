import Link from "next/link"
import { Button } from "@/components/ui/button"

// Sample cards pulled directly from seed data for the landing page
const SAMPLE_CARDS = [
  {
    name: "NovaMind AI",
    meta: "Paris, France · Founded Jan 2026",
    sector: "AI Agents",
    badges: [
      { label: "Fundraising Signal", strength: "positive" },
      { label: "Founder Reboot", strength: "warning" },
    ],
    description: "Autonomous agent framework for enterprise workflow orchestration.",
    takeaway: "Ex-DeepMind founder; likely preparing seed round based on hiring velocity.",
    signalCount: 3,
    signalDot: "green",
    href: "/startup/novamind-ai",
  },
  {
    name: "Katrix.AI",
    meta: "Meudon, France · Founded Nov 2025",
    sector: "Robotics AI",
    badges: [
      { label: "Founder Reboot", strength: "warning" },
      { label: "First Seen Jan 2026", strength: "neutral" },
    ],
    description: "Hybrid perception stack for autonomous systems.",
    takeaway: "Potential relaunch of robotics tech focused on perception infrastructure.",
    signalCount: 1,
    signalDot: "amber",
    href: "/startup/katrix-ai",
  },
  {
    name: "BioSight",
    meta: "Lyon, France · Founded Mar 2026",
    sector: "BioAI",
    badges: [
      { label: "IP Signal", strength: "positive" },
      { label: "Academic Spinout", strength: "neutral" },
    ],
    description: "AI-driven molecular imaging for drug discovery acceleration.",
    takeaway: "CNRS spinout; patent filing detected — IP protection  fundraise.",
    signalCount: 2,
    signalDot: "green",
    href: "/startup/biosight",
  },
]

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

export default function LandingPage() {
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
            The French AI Radar
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
              <Link href="/startup/novamind-ai">View Sample Report</Link>
            </Button>
          </div>
        </section>

        {/* -- PROOF BAR -- */}
        <section className="mb-[72px]">
          <div className="mx-auto grid max-w-[720px] grid-cols-4 overflow-hidden bg-card">
            {[
              { num: "6", label: "Startups Tracked" },
              { num: "21", label: "Signals Detected" },
              { num: "48", label: "Sectors Covered" },
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
          <p className="section-kicker mb-2 text-center">Why AI Radar</p>
          <h2 className="mb-2 text-center font-serif text-2xl font-bold tracking-[-0.02em] text-foreground">
            Intelligence, Not Noise
          </h2>
          <p className="mb-12 text-center text-[15px] text-muted-foreground">
            What separates AI Radar from startup directories and news feeds.
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
            {SAMPLE_CARDS.map((card) => (
              <Link key={card.name} href={card.href} className="block">
                <div className="data-card cursor-pointer p-5">
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
                    <span className="badge-signal badge-signal-neutral whitespace-nowrap">
                      {card.sector}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {card.badges.map((b) => (
                      <span key={b.label} className={badgeClass[b.strength]}>
                        {b.label}
                      </span>
                    ))}
                  </div>

                  {/* Body */}
                  <p className="mb-1.5 text-[13px] leading-snug text-foreground">
                    {card.description}
                  </p>
                  <p className="font-serif text-[13px] italic leading-snug text-muted-foreground">
                    {card.takeaway}
                  </p>

                  {/* Signal footer */}
                  <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
                    <span
                      className={`h-[7px] w-[7px] shrink-0 rounded-full ${signalDotClass[card.signalDot]}`}
                    />
                    {card.signalCount} new signal{card.signalCount !== 1 ? "s" : ""} this week
                  </div>
                </div>
              </Link>
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
          <span>AI Radar by French Tech Journal</span>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-foreground transition-colors duration-300">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors duration-300">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors duration-300">Contact</Link>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
