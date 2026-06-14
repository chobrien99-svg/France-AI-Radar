"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Events } from "@/lib/analytics"

type Interval = "monthly" | "annual"

const EXPLORER_FEATURES = [
  "Browse the full database",
  "3 startup profile views per month",
  "Basic time filters",
  "Weekly highlights email",
]

const PRO_FEATURES = [
  "Unlimited profile views",
  "Full investor briefs & signal timelines",
  "Advanced filters (sector, founder, signals)",
  "Watchlist & custom lists",
  "CSV export",
  "Alerts on new signals",
]

const ENTERPRISE_FEATURES = [
  "Team access",
  "Advanced exports",
  "Custom alerts and monitoring",
  "API access (coming)",
  "Dedicated support",
]

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-accent-green"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2.5 8 6.5 12 13.5 4" />
    </svg>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[13px]">
          <CheckIcon />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PricingCards() {
  const [interval, setInterval] = useState<Interval>("monthly")
  const annual = interval === "annual"

  return (
    <>
      {/* Billing toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <button
          onClick={() => setInterval("monthly")}
          className={`px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide transition-colors duration-300 ${
            interval === "monthly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          className={`flex items-center gap-2 px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide transition-colors duration-300 ${
            interval === "annual"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Annual
          <span className="border-l-2 border-l-accent-green bg-accent-green/10 px-2 py-0.5 text-[11px] font-bold text-accent-green">
            2 months free
          </span>
        </button>
      </div>

      {/* Tier cards */}
      <div className="mx-auto grid max-w-[960px] gap-5 md:grid-cols-3">

        {/* Explorer */}
        <div className="data-card flex flex-col p-6">
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Explorer
            </p>
            <div className="flex items-end gap-1.5">
              <span className="font-serif text-[32px] font-bold tracking-tight text-foreground">
                {annual ? "€90" : "€9"}
              </span>
              <span className="mb-1 text-[13px] text-muted-foreground">
                {annual ? "/ year" : "/ month"}
              </span>
            </div>
            {!annual && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">or €90 / year</p>
            )}
            <p className="mt-3 text-[13px] text-muted-foreground">
              For exploring the Radar and previewing early signals.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={EXPLORER_FEATURES} />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link
              href={`/api/stripe/checkout?tier=explorer&interval=${interval}`}
              onClick={() => Events.checkoutStarted("explorer", interval)}
            >
              Start Exploring
            </Link>
          </Button>
        </div>

        {/* Professional — featured */}
        <div className="relative flex flex-col border-l-4 border-l-accent-green bg-card p-6">
          {/* Badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-accent-green px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Founding Member
            </span>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-accent-green">
              Professional
            </p>
            <div className="flex items-end gap-1.5">
              <span className="font-serif text-[32px] font-bold tracking-tight text-foreground">
                {annual ? "€290" : "€29"}
              </span>
              <span className="mb-1 text-[13px] text-muted-foreground">
                {annual ? "/ year" : "/ month"}
              </span>
            </div>
            {!annual && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">or €290 / year · 2 months free</p>
            )}
            {annual && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">2 months free</p>
            )}

            {/* Future price */}
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              <span className="line-through">{annual ? "€790 / year" : "€79 / month"}</span>
              {" "}future price
            </p>

            <p className="mt-2.5 text-[12px] font-medium text-accent-green">
              Lock in early pricing as we expand the database.
            </p>

            <p className="mt-3 text-[13px] text-muted-foreground">
              Full access to the French AI Radar—every startup, signal, and investor brief.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={PRO_FEATURES} />
          </div>

          <Button className="w-full" asChild>
            <Link
              href={`/api/stripe/checkout?tier=professional&interval=${interval}`}
              onClick={() => Events.checkoutStarted("professional", interval)}
            >
              Get Full Access
            </Link>
          </Button>
        </div>

        {/* Enterprise */}
        <div className="data-card flex flex-col p-6">
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Enterprise
            </p>
            <div className="flex items-end gap-1.5">
              <span className="font-serif text-[32px] font-bold tracking-tight text-foreground">
                Custom
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              For venture funds and strategic teams.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={ENTERPRISE_FEATURES} />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link href="mailto:chris@frenchtechjournal.com">
              Contact Us
            </Link>
          </Button>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Onboarding a limited number of early partners.
          </p>
        </div>

      </div>
    </>
  )
}
