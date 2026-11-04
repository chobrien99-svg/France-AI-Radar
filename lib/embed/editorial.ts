// Editorial settings for embeddable cohort infographics. A program edition can
// only be embedded once it is listed here with `enabled: true`: the page shows
// company facts from the shared database, so publishing it is an editorial
// decision, like publishing a startup. Company data comes from the database;
// only the headline text and the figures credited to an outside source live here.

export type CohortStat = { value: string; label: string }
export type CohortEmbed = {
  enabled: boolean
  kicker: string
  title: string
  dek: string
  stats?: CohortStat[]
  statsSource?: string
  method: string
  sources: string
}

export const COHORT_EMBEDS: Record<string, CohortEmbed> = {
  "future-40-2026": {
    enabled: true,
    kicker: "Station F Future 40 · 2026 cohort",
    title: "The Future 40, mapped",
    dek: "Station F picked 40 of its 1,000+ campus startups for traction and milestones. Most are under two years old, most build AI agents or the infrastructure behind them, and one investor shows up again and again. Filter by theme or base, then pick a company.",
    stats: [
      { value: "€110M", label: "raised by the cohort to date" },
      { value: "31", label: "at pre-seed or seed; 2 at Series A, 5 bootstrapped" },
      { value: "98", label: "founders from 24 nationalities" },
      { value: "30", label: "teams with a repeat founder" },
      { value: "15", label: "teams with someone who has sold a company" },
      { value: "10+", label: "PhDs among the founders" },
    ],
    statsSource: "Cohort figures: Station F's own reporting (stationf.co/news/future-40-2026).",
    method: "Themes are France AI Radar's grouping of each company's main product. \"Founded\" uses the year the company gives, or its registration date. Funding comes from company, investor and press announcements and is shown in the currency announced; company-reported metrics are attributed, not verified.",
    sources: "Station F Future 40 announcement; Tech.eu; company websites and investor announcements; French company registry; Y Combinator and a16z Speedrun profiles.",
  },
}

export function cohortEmbed(slug: string): CohortEmbed | null {
  const e = COHORT_EMBEDS[slug]
  return e?.enabled ? e : null
}
