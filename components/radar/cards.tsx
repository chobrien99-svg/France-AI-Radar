import Link from "next/link"
import { Monogram } from "./monogram"
import { ShortlistStar } from "./shortlist-star"
import { Icon } from "./icons"
import { signalColor, signalLabel, relativeDate, toneFor } from "@/lib/radar"

export type CardStartup = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  sector: string | null
  stage: string
  city: string | null
  signalCount: number
  latestSignal: { type: string; title: string; date: string | null } | null
}

export type CardFounder = {
  id: string
  slug: string | null
  name: string
  role: string | null
  photoUrl: string | null
  bio: string | null
  tags: string[]
  company: { name: string; slug: string; sector: string | null; city: string | null } | null
}

/**
 * Startup card. The name is a stretched link so the whole card opens the
 * profile, while the shortlist star stays a separate button.
 * `showSignalTitle` is false for tiers that can't read signal details.
 */
export function StartupCardV2({
  s,
  saved,
  canShortlist,
  showSignalTitle = true,
}: {
  s: CardStartup
  saved: boolean
  canShortlist: boolean
  showSignalTitle?: boolean
}) {
  const last = s.latestSignal
  return (
    <div className="r2-card">
      <div className="r2-card-top">
        <Monogram name={s.name} tone={toneFor(s.slug)} imageUrl={s.logoUrl} />
        {canShortlist && (
          <div className="r2-acts">
            <ShortlistStar startupId={s.id} name={s.name} initialSaved={saved} />
          </div>
        )}
      </div>
      <h3 className="r2-name">
        <Link href={`/startup/${s.slug}`} className="r2-stretch">{s.name}</Link>
      </h3>
      <p className="r2-one">{s.description}</p>
      <div className="r2-tags">
        {s.sector && <span className="r2-tag">{s.sector}</span>}
        {s.stage !== "Undisclosed" && <span className="r2-tag">{s.stage}</span>}
        {s.city && <span className="r2-tag">{s.city}</span>}
      </div>
      {last && (
        <div className="r2-sig">
          <span className="r2-cat" style={{ color: signalColor(last.type) }}>{signalLabel(last.type)}</span>
          <span className="t">{showSignalTitle ? last.title : ""}</span>
          <span className="d">{relativeDate(last.date)}</span>
        </div>
      )}
    </div>
  )
}

export function StartupRowV2({ s, saved, canShortlist }: { s: CardStartup; saved: boolean; canShortlist: boolean }) {
  const last = s.latestSignal
  return (
    <div className="r2-row">
      <Monogram name={s.name} tone={toneFor(s.slug)} size="sm" imageUrl={s.logoUrl} />
      <div style={{ minWidth: 0 }}>
        <Link href={`/startup/${s.slug}`} className="r2-stretch nm">{s.name}</Link>
        <div className="ds">{s.description}</div>
      </div>
      <div className="hide-sm" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {s.sector && <span className="r2-tag">{s.sector}</span>}
        {s.stage !== "Undisclosed" && <span className="r2-tag">{s.stage}</span>}
      </div>
      <div className="hide-sm" style={{ minWidth: 0, fontSize: 12.5 }}>
        {last && (
          <>
            <span className="r2-cat" style={{ color: signalColor(last.type) }}>{signalLabel(last.type)}</span>
            <span className="r2-mono-sm" style={{ marginLeft: 8 }}>{relativeDate(last.date)}</span>
          </>
        )}
      </div>
      {canShortlist ? <ShortlistStar startupId={s.id} name={s.name} initialSaved={saved} /> : <span />}
    </div>
  )
}

/** Blurred stand-in for Professional-only text; the real value is never sent */
export function Redacted({ width }: { width: number }) {
  return (
    <span className="r2-redact" aria-label="Professional plan only" style={{ width }} />
  )
}

function founderHref(f: CardFounder): string | null {
  if (f.slug) return `/founder/${f.slug}`
  return f.company ? `/startup/${f.company.slug}` : null
}

export function FounderCardV2({ f, redacted = false }: { f: CardFounder; redacted?: boolean }) {
  const href = founderHref(f)
  return (
    <div className="r2-card" style={{ minHeight: 220 }}>
      <div className="r2-card-top">
        <Monogram name={f.name} tone="light" round imageUrl={f.photoUrl} />
      </div>
      <h3 className="r2-name">
        {href ? <Link href={href} className="r2-stretch">{f.name}</Link> : f.name}
      </h3>
      <div className="r2-sub">
        {redacted ? <Redacted width={90} /> : f.role}
        {(f.role || redacted) && f.company ? " · " : ""}
        {f.company && <b>{f.company.name}</b>}
      </div>
      {redacted ? (
        <p className="r2-one"><Redacted width={220} /><br /><Redacted width={160} /></p>
      ) : (
        f.bio && <p className="r2-one">{f.bio}</p>
      )}
      <div className="r2-tags">
        {redacted
          ? <span className="r2-tag r2-tag-lock">Background · Professional</span>
          : f.tags.map((t) => <span key={t} className="r2-tag">{t}</span>)}
      </div>
    </div>
  )
}

export function FounderRowV2({ f, redacted = false }: { f: CardFounder; redacted?: boolean }) {
  const href = founderHref(f)
  return (
    <div className="r2-row">
      <Monogram name={f.name} tone="light" size="sm" round imageUrl={f.photoUrl} />
      <div style={{ minWidth: 0 }}>
        {href ? <Link href={href} className="r2-stretch nm">{f.name}</Link> : <span className="nm">{f.name}</span>}
        <div className="ds">{redacted ? <Redacted width={110} /> : f.role}</div>
      </div>
      <div className="hide-sm" style={{ fontWeight: 600, fontSize: 14 }}>{f.company?.name}</div>
      <div className="hide-sm" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {redacted
          ? <span className="r2-tag r2-tag-lock">Background · Professional</span>
          : f.tags.map((t) => <span key={t} className="r2-tag">{t}</span>)}
      </div>
      <span style={{ color: "var(--muted-foreground)" }}><Icon name="arrow" size={14} /></span>
    </div>
  )
}
