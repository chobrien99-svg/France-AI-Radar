import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PricingCards } from "./pricing-cards"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md" style={{ borderBottom: '1px solid rgba(193, 199, 206, 0.25)' }}>
        <div className="page-container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-primary text-[12px] font-extrabold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
              AR
            </div>
            <span className="font-serif text-[15px] font-bold tracking-tight text-foreground">
              AI Radar
            </span>
          </Link>

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
              className="px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-wide text-primary border-b-2 border-primary"
            >
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/signup">Get Access</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="page-container py-16 pb-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="section-kicker mb-3">Pricing</p>
          <h1 className="mb-3 font-serif text-[32px] font-bold tracking-tight text-foreground md:text-[40px]">
            Access the French AI Radar
          </h1>
          <p className="mx-auto max-w-[500px] text-[16px] text-muted-foreground">
            Early-stage AI intelligence across France—before it reaches the market.
          </p>
          <p className="mx-auto mt-3 max-w-[460px] text-[13px] text-muted-foreground/70">
            We're starting with a curated set of high-signal companies and expanding the database weekly.
          </p>
        </div>

        {/* Billing toggle + tier cards (client) */}
        <PricingCards />

        {/* Early Access Pricing note */}
        <div className="mx-auto mt-12 max-w-[600px] border-l-2 border-l-primary bg-card px-7 py-6 text-center">
          <p className="mb-1.5 font-serif text-[13px] font-semibold text-foreground">Early Access Pricing</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            We're offering discounted access for early users as we build the most comprehensive
            intelligence layer on the French AI ecosystem. Pricing will increase as the database
            and feature set expand.
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {[
            "Cancel anytime",
            "No long-term commitment",
            "Secure payments via Stripe",
          ].map((item) => (
            <span key={item} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <svg className="h-3.5 w-3.5 text-accent-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5 8 6.5 12 13.5 4" />
              </svg>
              {item}
            </span>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-[640px]">
          <h2 className="mb-6 text-center font-serif text-[20px] font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group border-l-2 border-l-border bg-card px-5 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-semibold text-foreground">
                  {item.q}
                  <span className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-[12px] text-muted-foreground" style={{ borderTop: '1px solid rgba(193, 199, 206, 0.25)' }}>
        <div className="flex items-center justify-center gap-4">
          <span>France AI Radar by French Tech Journal</span>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: "Where does the data come from?",
    a: "AI Radar combines public registry data (INPI/RCS), patent filings (INPI, EPO), job posting analysis, LinkedIn signals, press monitoring, and our editorial team's primary research. All intelligence is verified before publication.",
  },
  {
    q: "How often is the database updated?",
    a: "Signals are processed continuously. The editorial team publishes new investor briefs and curated updates weekly. New startups are added as soon as they show meaningful early signals.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. You can cancel your subscription at any time from your account settings. You'll retain access until the end of your current billing period — no proration, no penalties.",
  },
  {
    q: "Is there a free trial?",
    a: "There's no free trial, but Explorer at €9/month gives you access to browse the database and preview up to 3 startup profiles per month — enough to evaluate the intelligence before upgrading to Professional.",
  },
  {
    q: "How is AI Radar different from Crunchbase or Dealroom?",
    a: "Crunchbase and Dealroom are retrospective — they record what already happened. AI Radar is forward-looking: we detect pre-announcement signals like hiring velocity, corporate restructuring, patent filings, and founder moves before they hit the press. We also focus exclusively on the French AI ecosystem, with editorial depth that broad platforms can't match.",
  },
]
