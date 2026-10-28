// ------------------------------------------------------------------
// Parsers for signal monitoring sources. Each turns a raw response into
// FoundItems; nothing here touches the network or the database.
//   - parseFeed: RSS 2.0 or Atom (press feeds, Google News)
//   - parseBodacc: BODACC open-data API records (official filings)
//
// Kept free of "@/..." imports so `npm test` can run it with plain Node.
// ------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser"

export type Source = "bodacc" | "press_rss" | "google_news"

export type FoundItem = {
  source: Source
  url: string
  title: string
  excerpt: string | null
  publishedAt: string | null   // ISO timestamp
  sourceName: string | null
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
})

const asArray = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

/** Text content of a parsed node, whether it came back as a string or {#text}. */
function text(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string" || typeof v === "number") return String(v)
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"] ?? "")
  return ""
}

/** Drop tags and collapse whitespace; feeds put HTML in descriptions. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isoDate(s: string): string | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Only plain web links: a feed must not be able to plant javascript: or data: URLs. */
const webUrl = (s: string) => (/^https?:\/\//i.test(s.trim()) ? s.trim() : "")

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * RSS 2.0 (<rss><channel><item>) or Atom (<feed><entry>).
 * Google News titles end in " - Publisher"; that suffix is moved to sourceName.
 */
export function parseFeed(body: string, source: Source, fallbackSourceName: string | null = null): FoundItem[] {
  let doc: Record<string, unknown>
  try {
    doc = xml.parse(body) as Record<string, unknown>
  } catch {
    return []
  }
  const out: FoundItem[] = []

  const rss = doc.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  if (channel) {
    const channelTitle = text(channel.title) || fallbackSourceName
    for (const it of asArray(channel.item as Record<string, unknown>[])) {
      const url = webUrl(text(it.link)) || webUrl(text(it.guid))
      let title = stripHtml(text(it.title))
      if (!url || !title) continue
      let sourceName = text(it.source).trim() || null
      if (source === "google_news" && sourceName && title.endsWith(` - ${sourceName}`)) {
        title = title.slice(0, -(sourceName.length + 3))
      }
      sourceName ??= channelTitle
      const excerpt = stripHtml(text(it["content:encoded"]) || text(it.description))
      out.push({ source, url, title, excerpt: excerpt ? clip(excerpt, 600) : null, publishedAt: isoDate(text(it.pubDate)), sourceName })
    }
    return out
  }

  const feed = doc.feed as Record<string, unknown> | undefined
  if (feed) {
    const feedTitle = text(feed.title) || fallbackSourceName
    for (const e of asArray(feed.entry as Record<string, unknown>[])) {
      const links = asArray(e.link as Record<string, string>[])
      const link = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0]
      const url = webUrl(link?.["@_href"] ?? "")
      const title = stripHtml(text(e.title))
      if (!url || !title) continue
      const excerpt = stripHtml(text(e.summary) || text(e.content))
      out.push({
        source, url, title,
        excerpt: excerpt ? clip(excerpt, 600) : null,
        publishedAt: isoDate(text(e.published) || text(e.updated)),
        sourceName: feedTitle,
      })
    }
  }
  return out
}

// ------------------------------------------------------------------
// BODACC (Bulletin officiel des annonces civiles et commerciales)
// Records from the open-data API, dataset "annonces-commerciales".
// ------------------------------------------------------------------

// Annual-accounts filings are routine and say nothing new; skip them.
const SKIPPED_FAMILIES = new Set(["dpc"])

function parseJsonField(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object") return v as Record<string, unknown>
  if (typeof v !== "string" || !v.trim()) return null
  try {
    const parsed = JSON.parse(v)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Flatten the human-readable parts of a BODACC JSON field into one line. */
function describe(v: unknown): string {
  const obj = parseJsonField(v)
  if (!obj) return typeof v === "string" ? v : ""
  const parts: string[] = []
  const walk = (x: unknown) => {
    if (typeof x === "string" && x.trim()) parts.push(x.trim())
    else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === "object") Object.values(x).forEach(walk)
  }
  walk(obj)
  return parts.join(" · ")
}

export function bodaccUrl(id: string): string {
  return `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${encodeURIComponent(id)}`
}

/** API response ({ results: [...] }) → items, newest first, excluding routine filings. */
export function parseBodacc(body: unknown): FoundItem[] {
  const results = (body && typeof body === "object" ? (body as { results?: unknown }).results : null)
  if (!Array.isArray(results)) return []
  const out: FoundItem[] = []
  for (const r of results as Record<string, unknown>[]) {
    const id = typeof r.id === "string" ? r.id : null
    if (!id || SKIPPED_FAMILIES.has(String(r.familleavis ?? ""))) continue
    const family = String(r.familleavis_lib ?? r.familleavis ?? "Annonce")
    const kind = typeof r.typeavis_lib === "string" ? r.typeavis_lib : ""
    const company = typeof r.commercant === "string" ? r.commercant : ""
    const details = [describe(r.modificationsgenerales), describe(r.jugement), describe(r.acte), describe(r.radiationaurcs), describe(r.depot)]
      .filter(Boolean)
      .join(" · ")
    const date = typeof r.dateparution === "string" ? r.dateparution : ""
    out.push({
      source: "bodacc",
      url: (typeof r.url_complete === "string" && webUrl(r.url_complete)) || bodaccUrl(id),
      title: [`BODACC: ${family}`, kind && kind !== family ? kind : null, company || null].filter(Boolean).join(" – "),
      excerpt: details ? clip(details, 800) : null,
      publishedAt: isoDate(date),
      sourceName: "BODACC",
    })
  }
  return out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
}

/** "552 032 534" / "552032534" → "552032534", or null when it isn't 9 digits. */
export function normalizeSiren(s: string | null | undefined): string | null {
  const digits = (s ?? "").replace(/\D/g, "")
  return digits.length === 9 ? digits : null
}
