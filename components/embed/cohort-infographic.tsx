"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BASE_LABELS, OTHER_THEME, SITE_URL, STAGE_LABELS, type BaseKey, type Cohort, type CohortCompany, type StageKey } from "@/lib/embed/cohort"
import type { CohortEmbed } from "@/lib/embed/editorial"

const BASES = Object.keys(BASE_LABELS) as BaseKey[]
const STAGES: StageKey[] = ["a", "seed", "pre", "unsp", "boot", "none"]
const SHORT_STAGE: Record<StageKey, string> = { a: "Series A+", seed: "Seed", pre: "Pre-seed", unsp: "Raised", boot: "Bootstrapped", none: "None disclosed" }
const MAX_THEMES = 8

type Props = { slug: string; editorial: CohortEmbed; cohort: Cohort; asOf: string }

export function CohortInfographic({ slug, editorial, cohort, asOf }: Props) {
  const [theme, setTheme] = useState<string | null>(null)
  const [base, setBase] = useState<BaseKey | "all">("all")
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(cohort.companies[0]?.slug ?? "")
  const [showEmbed, setShowEmbed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  // Themes keep the same colour whatever the filter: colour follows the theme, not its rank.
  const colour = useMemo(() => {
    const m = new Map<string, string>()
    cohort.themes.filter((t) => t.name !== OTHER_THEME).slice(0, MAX_THEMES).forEach((t, i) => m.set(t.name, `var(--cx-t${i + 1})`))
    return (name: string) => m.get(name) ?? "var(--cx-bar)"
  }, [cohort.themes])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return cohort.companies.filter((c) => {
      if (theme && c.theme !== theme) return false
      if (base !== "all" && c.base !== base) return false
      if (needle) {
        const hay = [c.name, c.place, c.description ?? "", ...c.founders, ...c.backers, ...c.programmes].join(" ").toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [cohort.companies, theme, base, q])
  const visibleSet = useMemo(() => new Set(visible.map((c) => c.slug)), [visible])
  const current = cohort.companies.find((c) => c.slug === sel && visibleSet.has(c.slug)) ?? visible[0] ?? cohort.companies[0]

  // Tell the host page how tall we are, so its iframe can fit the graphic without a scrollbar.
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window || !rootRef.current) return
    const send = () => window.parent.postMessage({ type: "far-embed:height", slug, height: Math.ceil(document.documentElement.scrollHeight) }, "*")
    const ro = new ResizeObserver(send)
    ro.observe(rootRef.current)
    send()
    return () => ro.disconnect()
  }, [slug])

  // Same on server and client (no hydration mismatch), and always the public address.
  const origin = SITE_URL
  const embedCode = `<iframe src="${origin}/embed/program/${slug}" title="${editorial.title} (France AI Radar)" style="width:100%;min-height:900px;border:0" loading="lazy"></iframe>
<script>addEventListener("message",function(e){if(e.origin!=="${origin}"||!e.data||e.data.type!=="far-embed:height")return;document.querySelectorAll('iframe[src^="${origin}/embed/"]').forEach(function(f){if(f.contentWindow===e.source)f.style.height=e.data.height+"px"})});</script>`

  return (
    <div className="cx-root" ref={rootRef}>
      <div className="cx-wrap">
        <div className="cx-kicker"><b>France AI Radar</b><span>{editorial.kicker}</span><span>Live data · {asOf}</span></div>
        <h1 className="cx-h1">{editorial.title}</h1>
        <p className="cx-dek">{editorial.dek}</p>

        {editorial.stats?.length ? (
          <>
            <div className="cx-stats" role="list">
              {editorial.stats.map((s) => (
                <div className="cx-stat" role="listitem" key={s.label}><div className="cx-n">{s.value}</div><div className="cx-l">{s.label}</div></div>
              ))}
            </div>
            {editorial.statsSource && <div className="cx-src">{editorial.statsSource} Company data below: France AI Radar database.</div>}
          </>
        ) : null}

        <div className="cx-filters">
          <div className="cx-chips" role="group" aria-label="Filter by theme">
            <button className="cx-chip" aria-pressed={theme === null} onClick={() => setTheme(null)}>All themes</button>
            {cohort.themes.map((t) => (
              <button key={t.name} className="cx-chip" aria-pressed={theme === t.name} onClick={() => setTheme(theme === t.name ? null : t.name)}>
                <span className="cx-sw" style={{ background: colour(t.name) }} />{t.name}
              </button>
            ))}
          </div>
          <label className="cx-ctl" htmlFor="cx-base">Base
            <select id="cx-base" value={base} onChange={(e) => setBase(e.target.value as BaseKey | "all")}>
              <option value="all">All</option>
              {BASES.map((b) => <option key={b} value={b}>{BASE_LABELS[b]}</option>)}
            </select>
          </label>
          <input id="cx-q" type="search" className="cx-search" placeholder="Search name, founder, backer" aria-label="Search companies" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="cx-count" aria-live="polite">Showing {visible.length} of {cohort.companies.length}</span>
        </div>

        <div className="cx-main">
          <div>
            <div className="cx-wall">
              {cohort.companies.map((c) => (
                <button
                  key={c.slug}
                  className={`cx-tile${visibleSet.has(c.slug) ? "" : " cx-out"}`}
                  style={{ borderTopColor: colour(c.theme) }}
                  aria-pressed={current?.slug === c.slug}
                  title={c.theme}
                  onClick={() => {
                    setSel(c.slug)
                    if (window.matchMedia("(max-width: 980px)").matches) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                  }}
                >
                  <span className="cx-nm">{c.name}</span>
                  <span className="cx-meta">{c.place}{c.year ? ` · ${c.year}` : ""}</span>
                  <span className="cx-tags">
                    {c.links.length > 0 && <span className="cx-tag cx-tag-accent">Our coverage</span>}
                    {c.stealth && <span className="cx-tag">Stealth</span>}
                    {c.programmes.some((p) => p.startsWith("Y Combinator")) && <span className="cx-tag">YC</span>}
                    <span className="cx-tag">{SHORT_STAGE[c.stage]}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="cx-legend">
              {cohort.themes.map((t) => <span key={t.name}><i style={{ background: colour(t.name) }} />{t.name}</span>)}
            </div>
          </div>
          {current && <Panel c={current} colour={colour(current.theme)} panelRef={panelRef} />}
        </div>

        <Charts all={cohort.companies} sel={visible} themes={cohort.themes} colour={colour} theme={theme} setTheme={setTheme} />

        <footer className="cx-foot">
          <div><b>Method.</b> {editorial.method}</div>
          <div><b>Sources.</b> {editorial.sources}</div>
          <div className="cx-foot-row">
            <a href={`${origin}/`} target="_blank" rel="noopener">Data: France AI Radar ↗</a>
            <button className="cx-linkbtn" onClick={() => setShowEmbed(!showEmbed)} aria-expanded={showEmbed}>Embed this graphic</button>
          </div>
          {showEmbed && <EmbedCode code={embedCode} />}
        </footer>
      </div>
    </div>
  )
}

function Panel({ c, colour, panelRef }: { c: CohortCompany; colour: string; panelRef: React.RefObject<HTMLElement | null> }) {
  const host = (() => { try { return c.website ? new URL(c.website).hostname.replace(/^www\./, "") : null } catch { return c.website } })()
  return (
    <aside className="cx-panel" ref={panelRef} aria-live="polite">
      <div className="cx-theme"><i style={{ background: colour }} />{c.theme}</div>
      <h2 className="cx-h2">{c.name}</h2>
      {c.stealth && <div className="cx-flags"><span className="cx-tag">In stealth</span></div>}
      {c.description && <p className="cx-d">{c.description}</p>}
      <dl>
        <dt>Based</dt><dd>{c.place} <span className="cx-muted">({BASE_LABELS[c.base]})</span></dd>
        <dt>Founded</dt><dd>{c.year ?? "Not public"}</dd>
        <dt>Founders</dt><dd>{c.founders.length ? c.founders.join(", ") : "Not published"}</dd>
        <dt>Funding</dt><dd>{c.funding.length ? c.funding.join("; ") : c.stage === "boot" ? "Bootstrapped (reported)" : "No round disclosed"}</dd>
        <dt>Backers</dt><dd>{c.backers.length ? c.backers.join(", ") : "Not disclosed"}</dd>
        {c.programmes.length > 0 && <><dt>Programmes</dt><dd>{c.programmes.join(", ")}</dd></>}
        {c.website && <><dt>Website</dt><dd><a href={c.website} target="_blank" rel="noopener">{host}</a></dd></>}
        {c.links.length > 0 && (
          <><dt>Our coverage</dt><dd className="cx-links">{c.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>)}</dd></>
        )}
      </dl>
    </aside>
  )
}

type Bar = { key: string; label: string; value: number; all: number; colour?: string }

function Rows({ items, max, onPick, picked }: { items: Bar[]; max: number; onPick?: (k: string) => void; picked?: string | null }) {
  return (
    <div className="cx-rows">
      {items.map((it) => {
        const inner = (
          <>
            <span className="cx-lab">{it.label}</span>
            <span className="cx-track">
              <span className="cx-ghost" style={{ width: `${max ? (it.all / max) * 100 : 0}%` }} />
              <span className="cx-fill" style={{ width: `${max ? (it.value / max) * 100 : 0}%`, background: it.colour }} />
            </span>
            <span className="cx-v">{it.value}</span>
          </>
        )
        return onPick
          ? <button key={it.key} className="cx-row cx-row-btn" aria-pressed={picked === it.key} title={`${it.label}: ${it.value} of ${it.all}`} onClick={() => onPick(it.key)}>{inner}</button>
          : <div key={it.key} className="cx-row" title={`${it.label}: ${it.value} of ${it.all}`}>{inner}</div>
      })}
    </div>
  )
}

function Charts({ all, sel, themes, colour, theme, setTheme }: {
  all: CohortCompany[]; sel: CohortCompany[]; themes: Cohort["themes"]; colour: (t: string) => string
  theme: string | null; setTheme: (t: string | null) => void
}) {
  const count = <K extends string>(list: CohortCompany[], f: (c: CohortCompany) => K) =>
    list.reduce((m, c) => m.set(f(c), (m.get(f(c)) ?? 0) + 1), new Map<K, number>())

  const tSel = count(sel, (c) => c.theme), tAll = count(all, (c) => c.theme)
  const themeBars: Bar[] = themes.map((t) => ({ key: t.name, label: t.name, value: tSel.get(t.name) ?? 0, all: t.count, colour: colour(t.name) }))
  const sSel = count(sel, (c) => c.stage), sAll = count(all, (c) => c.stage)
  const stageBars: Bar[] = STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s], value: sSel.get(s) ?? 0, all: sAll.get(s) ?? 0 })).filter((b) => b.all > 0)
  const bSel = count(sel, (c) => c.base), bAll = count(all, (c) => c.base)
  const baseBars: Bar[] = BASES.map((b) => ({ key: b, label: BASE_LABELS[b], value: bSel.get(b) ?? 0, all: bAll.get(b) ?? 0 })).filter((b) => b.all > 0)

  // Founding years: the last six years, earlier ones grouped.
  const yearsKnown = all.map((c) => c.year).filter((y): y is number => !!y)
  const last = yearsKnown.length ? Math.max(...yearsKnown) : new Date().getFullYear()
  const cols = Array.from({ length: 6 }, (_, i) => last - 5 + i)
  const bucket = (y: number) => (y < cols[0] ? "earlier" : String(y))
  const labels = (yearsKnown.some((y) => y < cols[0]) ? ["earlier"] : []).concat(cols.map(String))
  const yAll = labels.map((l) => all.filter((c) => c.year && bucket(c.year) === l).length)
  const ySel = labels.map((l) => sel.filter((c) => c.year && bucket(c.year) === l).length)
  const yMax = Math.max(1, ...yAll)
  const unknownYears = sel.filter((c) => !c.year).length

  const backerCount = new Map<string, number>()
  for (const c of sel) for (const b of new Set(c.backers)) backerCount.set(b, (backerCount.get(b) ?? 0) + 1)
  const topBackers = [...backerCount].filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)

  const funded = sel.filter((c) => c.funding.length > 0)

  return (
    <div className="cx-charts">
      <section>
        <h3>What they build</h3>
        <p className="cx-sub">Companies per theme. Click a theme to filter.</p>
        <Rows items={themeBars} max={Math.max(1, ...tAll.values())} onPick={(k) => setTheme(theme === k ? null : k)} picked={theme} />
      </section>
      <section>
        <h3>When they started</h3>
        <p className="cx-sub">Year founded or first registered, where known. Grey shows the whole cohort.</p>
        <div className="cx-cols" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
          {labels.map((l, i) => (
            <div className="cx-col" key={l} title={`${l}: ${ySel[i]} of ${yAll[i]}`}>
              <div className="cx-stack">
                <span className="cx-ghost" style={{ height: `${(yAll[i] / yMax) * 100}%` }} />
                <span className="cx-fill" style={{ height: `${(ySel[i] / yMax) * 100}%` }} />
                <span className="cx-cv" style={{ bottom: `${(ySel[i] / yMax) * 100}%` }}>{ySel[i]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="cx-xlabs" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>{labels.map((l) => <span key={l}>{l === "earlier" ? `< ${cols[0]}` : l}</span>)}</div>
        {unknownYears > 0 && <p className="cx-note">{unknownYears} of the selected companies have no public founding year.</p>}
      </section>
      <section>
        <h3>Funding stage</h3>
        <p className="cx-sub">Latest publicly reported round. &ldquo;None disclosed&rdquo; is not the same as unfunded.</p>
        <Rows items={stageBars} max={Math.max(1, ...sAll.values())} />
      </section>
      <section>
        <h3>Where they&rsquo;re based</h3>
        <p className="cx-sub">Operating base and legal set-up.</p>
        <Rows items={baseBars} max={Math.max(1, ...bAll.values())} />
      </section>
      <section>
        <h3>Who keeps showing up</h3>
        <p className="cx-sub">Backers and accelerators in two or more of the selected companies.</p>
        {topBackers.length
          ? <Rows items={topBackers.map(([n, v]) => ({ key: n, label: n, value: v, all: v }))} max={topBackers[0][1]} />
          : <p className="cx-note">No backer appears in two or more of the selected companies.</p>}
      </section>
      <section>
        <h3>Funding on record</h3>
        <p className="cx-sub">Disclosed rounds, in the currency announced.</p>
        {funded.length
          ? <div className="cx-fund">{funded.map((c) => <div key={c.slug}><b>{c.name}</b><span>{c.funding.join("; ")}</span></div>)}</div>
          : <p className="cx-note">No disclosed rounds among the selected companies.</p>}
      </section>
    </div>
  )
}

function EmbedCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <div className="cx-embed">
      <label htmlFor="cx-embed-code">Paste this into your article. The frame resizes itself to fit the graphic.</label>
      <textarea id="cx-embed-code" ref={ref} readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} />
      <button
        className="cx-chip"
        onClick={async () => {
          try { await navigator.clipboard.writeText(code); setCopied(true) } catch { ref.current?.select() }
        }}
      >{copied ? "Copied" : "Copy code"}</button>
    </div>
  )
}
