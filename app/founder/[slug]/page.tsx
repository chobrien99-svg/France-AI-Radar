import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { canAccessPremiumFields } from "@/lib/subscription"
import { Icon } from "@/components/radar/icons"
import { Monogram } from "@/components/radar/monogram"
import { StartupCardV2, Redacted, type CardStartup } from "@/components/radar/cards"
import { formatDate, founderTags, signalColor, signalLabel, stageFrom } from "@/lib/radar"
import type { Profile } from "@/lib/types"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

/** Signal types that say something about the people behind a company */
const PEOPLE_SIGNALS = ["founder_departure", "incorporation", "key_hire", "talent_move", "hiring_surge", "restructuring", "advisory_formation"]

const year = (iso: string | null) => (iso ? new Date(iso).getFullYear() : null)

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

  let profile: (Profile & { is_admin?: boolean }) | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_tier, subscription_status, stripe_customer_id, subscription_period_end, is_admin")
      .eq("id", user.id)
      .single()
    profile = data
  }

  // Founder intelligence is Professional-only. Everyone else gets name + company,
  // and the premium values are never rendered (not just blurred).
  const isAdmin = !!profile?.is_admin
  const hasActiveSub = profile?.subscription_status === "active"
  const canPremium = isAdmin || (hasActiveSub && canAccessPremiumFields(profile?.subscription_tier ?? "explorer"))

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
    short_bio: string | null
    email: string | null
    photo_url: string | null
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

  // Companies this person founded, plus prior experience
  const [{ data: ventureLinksRaw }, { data: experienceRaw }] = await Promise.all([
    supabase
      .from("organization_people")
      .select("role, organizations(id, name, slug, description, short_description, logo_url, last_round, signal_count, founded_date, first_seen_at, cities!organizations_city_id_fkey(name))")
      .eq("person_id", founder.id)
      .eq("is_founder", true),
    supabase
      .from("person_experience")
      .select("id, company_name, role, title, start_date, end_date, is_current, organizations(name, slug)")
      .eq("person_id", founder.id)
      .order("start_date", { ascending: false, nullsFirst: false }),
  ])

  const ventures = ((ventureLinksRaw ?? []) as Row[])
    .map((row) => ({ role: (row.role as string | null) ?? null, org: one(row.organizations as Row | Row[] | null) }))
    .filter((v): v is { role: string | null; org: Row } => !!v.org)
    // a person can hold several founder roles at one company — list it once
    .filter((v, i, all) => all.findIndex((w) => w.org.id === v.org.id) === i)

  const primary = ventures[0] ?? null
  const company = primary?.org ?? null
  const companyId = (company?.id as string | undefined) ?? null
  const primaryRole = primary?.role ?? null

  // Company context: sector, signals, co-founders
  const svc = await createServiceClient()
  const [{ data: sectorRows }, { data: signalRows }, { data: coRows }] = companyId
    ? await Promise.all([
        svc.from("organization_sectors").select("is_primary, sectors(name)").eq("organization_id", companyId),
        supabase
          .from("signals")
          .select("id, signal_type, title, signal_date")
          .eq("organization_id", companyId)
          .order("signal_date", { ascending: false, nullsFirst: false }),
        supabase
          .from("organization_people")
          .select("role, people(id, full_name, slug, photo_url)")
          .eq("organization_id", companyId)
          .eq("is_founder", true)
          .neq("person_id", founder.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const sector =
    ((sectorRows ?? []) as Row[])
      .sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary))
      .map((r) => one(r.sectors as { name: string } | { name: string }[] | null)?.name)
      .find(Boolean) ?? null
  const signals = (signalRows ?? []) as Array<{ id: string; signal_type: string; title: string; signal_date: string | null }>
  const related = signals.filter((g) => PEOPLE_SIGNALS.includes(g.signal_type)).slice(0, 3)
  const coFounders = ((coRows ?? []) as Row[])
    .map((r) => ({ role: (r.role as string | null) ?? null, p: one(r.people as Row | Row[] | null) }))
    .filter((c): c is { role: string | null; p: Row } => !!c.p)
  const city = company ? one(company.cities as { name: string } | { name: string }[] | null)?.name ?? null : null

  const companyCard: CardStartup | null = company
    ? {
        id: company.id as string,
        slug: company.slug as string,
        name: company.name as string,
        description: (company.short_description as string | null) || (company.description as string | null),
        logoUrl: (company.logo_url as string | null) ?? null,
        sector,
        stage: stageFrom(company.last_round as string | null),
        city,
        signalCount: (company.signal_count as number | null) ?? 0,
        latestSignal: signals[0] ? { type: signals[0].signal_type, title: signals[0].title, date: signals[0].signal_date } : null,
      }
    : null

  // Career: founded companies first, then recorded experience, then the big-tech employer if not already listed
  type CvRow = { key: string; org: string; href?: string; role: string | null; years: string | null; now?: boolean }
  const career: CvRow[] = ventures.map((v) => ({
    key: `v-${v.org.id}`,
    org: v.org.name as string,
    href: `/startup/${v.org.slug}`,
    role: v.role,
    years: year(v.org.founded_date as string | null) ? `${year(v.org.founded_date as string | null)}–` : null,
    now: true,
  }))
  for (const e of (experienceRaw ?? []) as Row[]) {
    const org = one(e.organizations as { name: string; slug: string } | { name: string; slug: string }[] | null)
    const name = (e.company_name as string | null) || org?.name
    if (!name || career.some((c) => c.org === name)) continue
    const from = year(e.start_date as string | null)
    const to = e.is_current ? "" : year(e.end_date as string | null)
    career.push({
      key: e.id as string,
      org: name,
      role: (e.title as string | null) || (e.role as string | null),
      years: from && from === to ? String(from) : from ? `${from}–${to ?? ""}` : to ? String(to) : null,
    })
  }
  if (founder.big_tech_employer && !career.some((c) => c.org.toLowerCase().includes(founder.big_tech_employer!.toLowerCase()))) {
    career.push({ key: "bigtech", org: founder.big_tech_employer, role: null, years: null })
  }

  const highlights = [
    founder.big_tech_employer && `Big Tech alumni — previously at ${founder.big_tech_employer}`,
    founder.has_phd && (founder.academic_lab ? `PhD, ${founder.academic_lab}` : "Holds a PhD"),
    !founder.has_phd && founder.academic_lab && `Academic background: ${founder.academic_lab}`,
    founder.is_repeat_founder && "Repeat founder",
    founder.previous_exits > 0 && `${founder.previous_exits} prior exit${founder.previous_exits !== 1 ? "s" : ""}`,
  ].filter(Boolean) as string[]

  const tags = founderTags(founder)
  const links = [
    ["LinkedIn", founder.linkedin_url],
    ["GitHub", founder.github_url],
    ["Scholar", founder.google_scholar_url],
    ["Website", founder.personal_website_url],
  ].filter(([, u]) => u) as [string, string][]

  return (
    <main>
      {/* ---------------- Header band ---------------- */}
      <div className="r2-hero">
        <div className="page-container r2-hero-in">
          {company ? (
            <Link href={`/startup/${company.slug}`} className="r2-back"><Icon name="back" size={13} /> {company.name as string}</Link>
          ) : (
            <Link href="/database?tab=founders" className="r2-back"><Icon name="back" size={13} /> Founders</Link>
          )}
          <div className="r2-ph">
            <Monogram name={founder.full_name} tone="dark" size="xl" round imageUrl={founder.photo_url} />
            <div style={{ minWidth: 0 }}>
              <div className="r2-eyebrow"><span className="bk" />Founder{company ? ` · ${company.name as string}` : ""}</div>
              <h1 className="r2-h1">{founder.full_name}</h1>
              {(primaryRole || company) && (
                <p className="r2-lede">
                  {canPremium ? primaryRole : primaryRole ? <Redacted width={120} /> : null}
                  {primaryRole && company ? ", " : ""}
                  {company && <Link href={`/startup/${company.slug}`} className="r2-inline">{company.name as string}</Link>}
                </p>
              )}
              {canPremium ? (
                tags.length > 0 && (
                  <div className="r2-tags" style={{ paddingTop: 18 }}>{tags.map((t) => <span key={t} className="r2-tag">{t}</span>)}</div>
                )
              ) : (
                <div className="r2-tags" style={{ paddingTop: 18 }}><span className="r2-tag r2-tag-lock">Background · Professional</span></div>
              )}
            </div>
            {canPremium && links.length > 0 && (
              <div className="r2-ph-acts">
                {links.map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="r2-btn s">
                    {label} <Icon name="external" size={12} />
                  </a>
                ))}
              </div>
            )}
          </div>
          {company && (
            <div className="r2-stats sm">
              <div className="r2-stat"><b>{company.name as string}</b><span>Company</span></div>
              {sector && <div className="r2-stat"><b>{sector}</b><span>Sector</span></div>}
              {city && <div className="r2-stat"><b>{city}</b><span>Based in</span></div>}
              {company.first_seen_at ? (
                <div className="r2-stat"><b>{formatDate(company.first_seen_at as string, { month: "short", year: "numeric" })}</b><span>On the Radar since</span></div>
              ) : null}
            </div>
          )}
          {!company && <div style={{ height: 36 }} />}
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      <div className="page-container r2-pbody">
        <div style={{ minWidth: 0 }}>
          {!canPremium ? (
            <>
              <section className="r2-sec">
                <div className="r2-sec-h">Profile</div>
                <div className="r2-prose">
                  <p><Redacted width={520} /><br /><Redacted width={480} /><br /><Redacted width={300} /></p>
                </div>
              </section>
              <div className="r2-upsell" style={{ marginTop: 0 }}>
                <h5>Full founder profile is Professional-only</h5>
                <p>Upgrade to Professional for founder biographies, career and education history, pedigree analysis and contact details.</p>
                <Link href="/pricing" className="r2-btn p">Upgrade to Professional</Link>
              </div>
            </>
          ) : (
            <>
              {(founder.bio || founder.short_bio) && (
                <section className="r2-sec">
                  <div className="r2-sec-h">Profile</div>
                  <div className="r2-prose"><p>{founder.bio || founder.short_bio}</p></div>
                  {founder.email && (
                    <p className="text-[14px] text-muted-foreground">
                      Contact: <a href={`mailto:${founder.email}`}>{founder.email}</a>
                    </p>
                  )}
                </section>
              )}

              {career.length > 0 && (
                <section className="r2-sec">
                  <div className="r2-sec-h">Career</div>
                  {career.map((c) => (
                    <div key={c.key} className={"r2-cv-row" + (c.now ? " now" : "")}>
                      <div>
                        <div className="o">{c.href ? <Link href={c.href}>{c.org}</Link> : c.org}</div>
                        {c.role && <div className="r">{c.role}</div>}
                      </div>
                      {c.years && <div className="y">{c.years}</div>}
                    </div>
                  ))}
                </section>
              )}

              {founder.academic_lab && (
                <section className="r2-sec">
                  <div className="r2-sec-h">Education</div>
                  <div className="r2-cv-row">
                    <div>
                      <div className="o">{founder.academic_lab}</div>
                      <div className="r">{founder.has_phd ? "PhD" : "Academic lab"}</div>
                    </div>
                  </div>
                </section>
              )}

              {highlights.length > 0 && (
                <section className="r2-sec">
                  <div className="r2-sec-h">Why we&apos;re tracking</div>
                  <ul className="r2-hl">{highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="r2-rail">
          {companyCard && <StartupCardV2 s={companyCard} saved={false} canShortlist={false} showSignalTitle={canPremium} />}

          {ventures.length > 1 && (
            <div className="r2-box">
              <div className="r2-box-h"><span className="r2-lbl">Other ventures</span></div>
              <div className="r2-box-b">
                {ventures.slice(1).map((v) => (
                  <Link key={v.org.id as string} href={`/startup/${v.org.slug}`} className="r2-person">
                    <Monogram name={v.org.name as string} tone="light" size="sm" imageUrl={v.org.logo_url as string | null} />
                    <div style={{ flex: 1 }}><div className="nm">{v.org.name as string}</div>{v.role && <div className="rl">{canPremium ? v.role : <Redacted width={90} />}</div>}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {coFounders.length > 0 && (
            <div className="r2-box">
              <div className="r2-box-h"><span className="r2-lbl">Co-founders</span></div>
              <div className="r2-box-b">
                {coFounders.map(({ p, role }) => {
                  const inner = (
                    <>
                      <Monogram name={p.full_name as string} tone="light" size="sm" round imageUrl={p.photo_url as string | null} />
                      <div style={{ flex: 1 }}><div className="nm">{p.full_name as string}</div>{role && <div className="rl">{canPremium ? role : <Redacted width={90} />}</div>}</div>
                    </>
                  )
                  return p.slug ? (
                    <Link key={p.id as string} href={`/founder/${p.slug}`} className="r2-person">{inner}</Link>
                  ) : (
                    <div key={p.id as string} className="r2-person">{inner}</div>
                  )
                })}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="r2-box">
              <div className="r2-box-h"><span className="r2-lbl">Related signals</span></div>
              <div className="r2-box-b">
                {related.map((g) => (
                  <div key={g.id} className="r2-related">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span className="r2-cat" style={{ color: signalColor(g.signal_type) }}>{signalLabel(g.signal_type)}</span>
                      <span className="r2-mono-sm">{formatDate(g.signal_date, { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="ttl">{canPremium ? g.title : <Redacted width={180} />}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
