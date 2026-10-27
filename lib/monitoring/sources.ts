// Network fetchers for signal monitoring. Every function returns items or
// throws a short, human-readable error; the caller logs it and moves on,
// so one broken source never stops a run.
import { PRESS_FEEDS } from "@/lib/monitoring/feeds"
import { mentions, searchTerms, type MatchTarget } from "@/lib/monitoring/match"
import { normalizeSiren, parseBodacc, parseFeed, type FoundItem } from "@/lib/monitoring/parse"

const USER_AGENT = "FranceAIRadarBot/1.0 (+https://www.franceairadar.com)"

async function get(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Every press feed, fetched in parallel. Failures are returned, not thrown. */
export async function fetchPressFeeds(): Promise<{ items: FoundItem[]; errors: string[] }> {
  const results = await Promise.allSettled(
    PRESS_FEEDS.map(async (f) => parseFeed(await get(f.url, "application/rss+xml, application/atom+xml, text/xml"), "press_rss", f.name)),
  )
  const items: FoundItem[] = []
  const errors: string[] = []
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value.length === 0) errors.push(`press feed ${PRESS_FEEDS[i].name}: no items`)
      items.push(...r.value)
    } else {
      errors.push(`press feed ${PRESS_FEEDS[i].name}: ${r.reason instanceof Error ? r.reason.message : "failed"}`)
    }
  })
  return { items, errors }
}

/** Press items that mention this startup. */
export function pressMatches(items: FoundItem[], target: MatchTarget): FoundItem[] {
  return items.filter((it) => mentions(`${it.title} ${it.excerpt ?? ""}`, target))
}

// Google News RSS search: unofficial but long-standing. French and English
// editions, last two weeks, exact-phrase search on the name and aliases.
const EDITIONS = [
  { hl: "fr", gl: "FR", ceid: "FR:fr" },
  { hl: "en-US", gl: "US", ceid: "US:en" },
]

export async function fetchGoogleNews(target: MatchTarget): Promise<FoundItem[]> {
  const terms = searchTerms(target)
  if (terms.length === 0) return []
  const q = `${terms.map((t) => `"${t}"`).join(" OR ")} when:14d`
  const seen = new Set<string>()
  const out: FoundItem[] = []
  for (const e of EDITIONS) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`
    for (const it of parseFeed(await get(url, "application/rss+xml"), "google_news", "Google News")) {
      // Google matches loosely; keep only items that really name the startup.
      if (seen.has(it.url) || !mentions(`${it.title} ${it.excerpt ?? ""}`, target)) continue
      seen.add(it.url)
      out.push(it)
    }
  }
  return out
}

// BODACC open data (DILA, via OpenDataSoft): full-text search on the SIREN,
// then keep only records whose registre field really carries it.
const BODACC_API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records"

export async function fetchBodacc(sirenRaw: string, since: string): Promise<FoundItem[]> {
  const siren = normalizeSiren(sirenRaw)
  if (!siren) return []
  const params = new URLSearchParams({
    where: `"${siren}" AND dateparution > date'${since}'`,
    order_by: "dateparution desc",
    limit: "50",
  })
  const body = JSON.parse(await get(`${BODACC_API}?${params}`, "application/json")) as { results?: Record<string, unknown>[] }
  const own = (body.results ?? []).filter((r) => {
    const reg = Array.isArray(r.registre) ? r.registre.join(" ") : String(r.registre ?? "")
    return reg.replace(/\D/g, "").includes(siren)
  })
  return parseBodacc({ results: own })
}
