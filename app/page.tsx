import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { AppNav } from "@/components/app-nav"
import { SiteFooter } from "@/components/site-footer"
import { Icon } from "@/components/radar/icons"
import { FranceMap } from "@/components/home/france-map"
import { RadarDish } from "@/components/home/radar-dish"
import { relativeDate, stageFrom } from "@/lib/radar"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

/** Start of the current calendar quarter (UTC) */
function quarterStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1))
}

/** "04:12 CEST" if it was today in Paris, otherwise "9 Oct" */
function updatedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const day = (x: Date) => x.toLocaleDateString("en-GB", { timeZone: "Europe/Paris" })
  if (day(d) === day(new Date())) {
    return d.toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
  }
  return d.toLocaleDateString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short" })
}

const foundedLabel = (iso: string | null) =>
  iso ? `Founded ${new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : null

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const svc = await createServiceClient()

  // ---------------- Live data (AI Radar startups only) ----------------
  const { data: aiRadarOrgs } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const radarIds = (aiRadarOrgs ?? []).map((r: { organization_id: string }) => r.organization_id)
  const idFilter = radarIds.length > 0 ? radarIds : ["00000000-0000-0000-0000-000000000000"]

  const [{ data: orgRows }, { data: sectorRows }, { data: signalRows }, { data: founderRows }] = await Promise.all([
    svc
      .from("organizations")
      .select("id, slug, description, short_description, founded_date, last_round, signal_count, last_signal_date, updated_at, cities!organizations_city_id_fkey(name)")
      .in("id", idFilter)
      .eq("status", "active"),
    svc.from("organization_sectors").select("organization_id, is_primary, sectors(id, name)").in("organization_id", idFilter),
    svc.from("signals").select("organization_id, signal_date").in("organization_id", idFilter),
    svc.from("organization_people").select("person_id").in("organization_id", idFilter).eq("is_founder", true),
  ])

  const orgs = (orgRows ?? []) as Row[]
  const activeIds = new Set(orgs.map((o) => o.id as string))

  const sectorBy = new Map<string, { id: string; name: string }>()
  for (const r of (sectorRows ?? []) as Row[]) {
    const s = one(r.sectors as { id: string; name: string } | { id: string; name: string }[] | null)
    const id = r.organization_id as string
    if (s && activeIds.has(id) && (!sectorBy.has(id) || r.is_primary)) sectorBy.set(id, s)
  }

  const signals = ((signalRows ?? []) as Row[]).filter((s) => activeIds.has(s.organization_id as string))
  const latestBy = new Map<string, string>()
  for (const s of signals) {
    const id = s.organization_id as string, d = s.signal_date as string | null
    if (d && (!latestBy.has(id) || d > latestBy.get(id)!)) latestBy.set(id, d)
  }
  const qStart = quarterStart(new Date()).toISOString().slice(0, 10)

  const activity = (o: Row) => (latestBy.get(o.id as string) ?? (o.last_signal_date as string | null) ?? (o.updated_at as string | null) ?? "")
  const byActivity = [...orgs].sort((a, b) => activity(b).localeCompare(activity(a)))

  const stats = [
    { n: orgs.length, l: "Startups on Radar" },
    { n: signals.filter((s) => ((s.signal_date as string | null) ?? "") >= qStart).length, l: "Signals this quarter" },
    { n: new Set([...sectorBy.values()].map((s) => s.id)).size, l: "Sectors covered" },
    { n: new Set(((founderRows ?? []) as Row[]).map((r) => r.person_id as string)).size, l: "Founders tracked" },
  ]

  // Cities on the map, most startups first
  const cityCount = new Map<string, number>()
  for (const o of orgs) {
    const c = one(o.cities as { name: string } | { name: string }[] | null)?.name
    if (c) cityCount.set(c, (cityCount.get(c) ?? 0) + 1)
  }
  const mapCities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)

  const updated = updatedLabel(orgs.map((o) => o.updated_at as string | null).filter(Boolean).sort().pop() ?? null)
  const sampleHref = byActivity[0] ? `/startup/${byActivity[0].slug}` : "/pricing"

  // "This week on the Radar": anonymous cards, the 3 most recently active startups
  const cards = byActivity.slice(0, 3).map((o) => {
    const id = o.id as string
    const city = one(o.cities as { name: string } | { name: string }[] | null)?.name
    const stage = stageFrom(o.last_round as string | null)
    return {
      id,
      heading: sectorBy.get(id)?.name ?? "AI startup",
      meta: [city, foundedLabel(o.founded_date as string | null)].filter(Boolean).join(" · ") || "France",
      stage: stage === "Undisclosed" || stage === "Other" ? null : stage,
      description: (o.short_description as string | null) || (o.description as string | null),
      signalCount: (o.signal_count as number | null) ?? 0,
      last: latestBy.get(id) ?? (o.last_signal_date as string | null),
    }
  })

  return (
    <div className="min-h-screen bg-ink">
      <AppNav activePage="home" />
      <div className="lp">
        {/* ---------------- Hero ---------------- */}
        <section className="lp-hero">
          <div className="lp-bg" aria-hidden="true">
            <FranceMap cities={mapCities} />
            <RadarDish />
            <div className="lp-vig" />
          </div>
          <div className="page-container lp-hero-in">
            <div className="lp-eye">
              <span className="bk" />
              Investor intelligence{updated ? ` · Updated ${updated}` : ""}
            </div>
            <h1 className="lp-h1">France <em style={{ fontStyle: "normal" }}>AI</em> Radar</h1>
            <div className="lp-sub">Discover French AI startups before the market.</div>
            <p className="lp-p">
              AI startups across France at their earliest signal: at incorporation, in stealth, or at their first
              public trace. Built from filings, founder activity and ecosystem signals.
            </p>
            <div className="lp-ctas">
              <Link href="/database" className="lp-btn pri">Explore the Database <Icon name="arrow" size={13} /></Link>
              <Link href={sampleHref} className="lp-btn out">View sample report</Link>
            </div>
          </div>
          <div className="page-container" style={{ position: "relative", width: "100%" }}>
            <div className="lp-stats">
              {stats.map((s) => (
                <div key={s.l} className="lp-stat"><b>{s.n}</b><span>{s.l}</span></div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Why the Radar ---------------- */}
        <section className="lp-sec">
          <div className="page-container">
            <div className="lp-why">
              <div>
                <div className="lp-kick">Why the Radar</div>
                <h2 className="lp-h2">Intelligence,<br />not noise.</h2>
              </div>
              <p>
                Directories aggregate the loud. News feeds rehash the announced. The Radar reads what companies{" "}
                <em>do</em> before they <em>say</em>: filings, hiring velocity, patents, founder movements, weighed as
                signal strength.
              </p>
            </div>
            <div className="lp-cols">
              {[
                ["01", "Signal detection", "Fundraising moves, restructuring, key hires and pivots, surfaced before they hit the press."],
                ["02", "Founder intelligence", "Big Tech alumni, repeat founders, academic spinouts: every background mapped and scored."],
                ["03", "Sector mapping", "AI Agents, Robotics, BioAI, DeepTech and more. Filterable, exportable, always current."],
              ].map(([n, t, b]) => (
                <div key={n} className="lp-col">
                  <div className="n">№ {n}</div>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- This week on the Radar ---------------- */}
        {cards.length > 0 && (
          <section className="lp-sec">
            <div className="page-container">
              <div className="lp-head">
                <div>
                  <div className="lp-kick">Live from the database</div>
                  <h2 className="lp-h2">This week on the Radar</h2>
                </div>
                <Link href="/database" className="lp-link">
                  See all {orgs.length} files <Icon name="arrow" size={12} />
                </Link>
              </div>
              <div className="lp-cards">
                {cards.map((c) => (
                  <div key={c.id} className="lp-card">
                    <div className="t">
                      <div>
                        <div className="nm">{c.heading}</div>
                        <div className="mt">{c.meta}</div>
                      </div>
                      {c.stage && <span className="sec">{c.stage}</span>}
                    </div>
                    {c.description && <p className="d">{c.description}</p>}
                    <div className="ft">
                      <i />
                      {c.signalCount} signal{c.signalCount !== 1 ? "s" : ""}
                      {c.last ? ` · ${relativeDate(c.last)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- CTA ---------------- */}
        <section className="lp-sec">
          <div className="page-container lp-cta">
            <div>
              <div className="lp-kick">Ready to see the full picture</div>
              <h2 className="lp-h2">Join investors tracking the French AI ecosystem with clarity.</h2>
            </div>
            <div>
              <p>
                Professional access: unlimited profiles, full signal timelines, founder analysis, investor briefs, CSV
                exports and alerts.
              </p>
              <div className="lp-ctas" style={{ justifyContent: "flex-start" }}>
                <Link href="/pricing" className="lp-btn pri">View pricing</Link>
                <Link href={sampleHref} className="lp-btn out">Read a sample report</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </div>
  )
}
