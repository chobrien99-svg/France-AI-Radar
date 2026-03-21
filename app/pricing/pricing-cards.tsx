"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Interval = "monthly" | "annual"

const EXPLORER_FEATURES = [
  "50 startup profiles / month",
  "Basic sector & stage filters",
  "Signal badge overview",
  "Weekly digest email",
  "Name & keyword search",
]

const PRO_FEATURES = [
  "Unlimited startup profiles",
  "All filters including founder signals",
  "Full investor briefs & timelines",
  "Founding team deep-dives",
  "10 PDF exports / month",
  "Saved searches & watchlists",
  "Priority alerts on new signals",
]

const ENTERPRISE_FEATURES = [
  "Everything in Professional",
  "Unlimited PDF exports",
  "API access",
  "Custom watchlists",
  "10 team seats",
  "Dedicated account manager",
  "Custom data requests",
]

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-primary"
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
          className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
            interval === "monthly"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
            interval === "annual"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Annual
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Save 20%
          </span>
        </button>
      </div>

      {/* Tier cards */}
      <div className="mx-auto grid max-w-[960px] gap-5 md:grid-cols-3">
        {/* Explorer */}
        <div className="data-card flex flex-col p-6">
          <div className="mb-6">
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Explorer
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-[32px] font-bold tracking-tight text-foreground">
                {annual ? "€39" : "€49"}
              </span>
              <span className="mb-1 text-[13px] text-muted-foreground">/mo</span>
            </div>
            {annual && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Billed annually (€470/yr)
              </p>
            )}
            <p className="mt-3 text-[13px] text-muted-foreground">
              For investors who want a structured view of the French AI
              landscape.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={EXPLORER_FEATURES} />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link
              href={`/api/stripe/checkout?tier=explorer&interval=${interval}`}
            >
              Start Exploring
            </Link>
          </Button>
        </div>

        {/* Professional — featured */}
        <div
          className="relative flex flex-col rounded-xl border-2 border-primary bg-card p-6 shadow-md"
        >
          {/* Recommended badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-primary px-3.5 py-1 text-[11px] font-semibold text-primary-foreground">
              Recommended
            </span>
          </div>

          <div className="mb-6">
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-primary">
              Professional
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-[32px] font-bold tracking-tight text-foreground">
                {annual ? "€119" : "€149"}
              </span>
              <span className="mb-1 text-[13px] text-muted-foreground">/mo</span>
            </div>
            {annual && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Billed annually (€1,430/yr)
              </p>
            )}
            <p className="mt-3 text-[13px] text-muted-foreground">
              For active dealmakers who need full signal depth on every
              opportunity.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={PRO_FEATURES} />
          </div>

          <Button className="w-full" asChild>
            <Link
              href={`/api/stripe/checkout?tier=professional&interval=${interval}`}
            >
              Go Professional
            </Link>
          </Button>
        </div>

        {/* Enterprise */}
        <div className="data-card flex flex-col p-6">
          <div className="mb-6">
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Enterprise
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-[32px] font-bold tracking-tight text-foreground">
                Custom
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Tailored to your team
            </p>
            <p className="mt-3 text-[13px] text-muted-foreground">
              For VC firms, corporate M&A teams, and LPs who need team
              access and custom data.
            </p>
          </div>

          <div className="mb-8 flex-1">
            <FeatureList items={ENTERPRISE_FEATURES} />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link href="mailto:enterprise@frenchtech.journal">
              Contact Us
            </Link>
          </Button>
        </div>
      </div>
    </>
  )
}
