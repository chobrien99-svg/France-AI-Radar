import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PricingCards } from "./pricing-cards"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="page-container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary text-[12px] font-extrabold text-primary-foreground">
              AR
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              AI Radar
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/database"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Database
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-foreground bg-secondary"
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
          <h1 className="mb-3 text-[32px] font-bold tracking-tight text-foreground md:text-[38px]">
            Choose Your Intelligence Level
          </h1>
          <p className="mx-auto max-w-[480px] text-[15px] text-muted-foreground">
            Access the French AI ecosystem's most complete investor
            intelligence platform. Cancel anytime.
          </p>
        </div>

        {/* Billing toggle + tier cards (client) */}
        <PricingCards />

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-[640px]">
          <h2 className="mb-6 text-center text-[20px] font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card px-5 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-semibold text-foreground">
                  {item.q}
                  <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
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
      <footer className="border-t border-border py-6 text-center text-[12px] text-muted-foreground">
        AI Radar by French Tech Journal · Privacy · Terms · Contact · © 2026
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
    a: "There's no time-limited trial, but the free tier gives you access to 10 startup profiles with public data so you can evaluate the product before upgrading.",
  },
  {
    q: "How is AI Radar different from Crunchbase or Dealroom?",
    a: "Crunchbase and Dealroom are retrospective — they record what already happened. AI Radar is forward-looking: we detect pre-announcement signals like hiring velocity, corporate restructuring, patent filings, and founder moves before they hit the press. We also focus exclusively on the French AI ecosystem, with editorial depth that broad platforms can't match.",
  },
]
