// ------------------------------------------------------------------
// One signal monitoring run: for each AI Radar startup, collect new items
// from BODACC, Google News and the press feeds, have Claude judge and draft
// each one, and queue the credible ones in signal_candidates for review.
// Called nightly by /api/cron/monitor-signals and on demand ("Check now").
// How it works: docs/signal-monitoring.md
// ------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js"
import { analysisConfigured, analyzeItem } from "@/lib/monitoring/analyze"
import { findPossibleDuplicate, isUsable, type CompanyContext } from "@/lib/monitoring/analysis"
import type { MatchTarget } from "@/lib/monitoring/match"
import type { FoundItem } from "@/lib/monitoring/parse"
import { fetchBodacc, fetchGoogleNews, fetchPressFeeds, pressMatches } from "@/lib/monitoring/sources"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

/** Claude calls per run, so a noisy night can't run up the bill. */
const MAX_ANALYSES = Number(process.env.MONITOR_MAX_ANALYSES) || 150
/** Per startup per run: a burst of coverage is usually one story. */
const MAX_ITEMS_PER_ORG = 12
/** How far back BODACC is read the first time a startup is checked. */
const BODACC_FIRST_LOOKBACK_DAYS = 90

export type RunSummary = {
  runId: string | null
  orgsChecked: number
  orgsRemaining: number
  itemsSeen: number
  itemsAnalyzed: number
  candidatesCreated: number
  candidateIds: string[]
  errors: string[]
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000))
const dayBefore = (day: string) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000))

/** Radar startup ids, or just the one asked for. */
async function targetIds(svc: SupabaseClient, organizationId?: string): Promise<string[]> {
  if (organizationId) return [organizationId]
  const { data } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  return [...new Set((data ?? []).map((r: { organization_id: string }) => r.organization_id))]
}

export async function runMonitoring(
  svc: SupabaseClient,
  opts: { kind: "cron" | "manual"; organizationId?: string; deadline: number },
): Promise<RunSummary> {
  const summary: RunSummary = { runId: null, orgsChecked: 0, orgsRemaining: 0, itemsSeen: 0, itemsAnalyzed: 0, candidatesCreated: 0, candidateIds: [], errors: [] }
  const note = (msg: string) => { if (summary.errors.length < 100) summary.errors.push(msg) }

  if (!analysisConfigured()) {
    note("ANTHROPIC_API_KEY is not set, so nothing can be analysed")
    return summary
  }

  const { data: run } = await svc.from("monitoring_runs").insert({ kind: opts.kind }).select("id").single()
  summary.runId = (run?.id as string | undefined) ?? null

  const ids = await targetIds(svc, opts.organizationId)
  const [{ data: orgRows }, { data: stateRows }, { data: entityRows }, { data: sectorRows }] = await Promise.all([
    svc.from("organizations")
      .select("id, name, status, website, short_description, description, cities!organizations_city_id_fkey(name)")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("monitoring_state").select("*").in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("legal_entities").select("organization_id, siren, is_primary").in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("organization_sectors").select("organization_id, sectors(name)").in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ])

  const stateBy = new Map(((stateRows ?? []) as Row[]).map((s) => [s.organization_id as string, s]))
  const sirenBy = new Map<string, string>()
  for (const e of (entityRows ?? []) as Row[]) {
    const id = e.organization_id as string
    if (e.siren && (!sirenBy.has(id) || e.is_primary)) sirenBy.set(id, e.siren as string)
  }
  const sectorsBy = new Map<string, string[]>()
  for (const r of (sectorRows ?? []) as Row[]) {
    const name = one(r.sectors as { name: string } | { name: string }[] | null)?.name
    if (name) sectorsBy.set(r.organization_id as string, [...(sectorsBy.get(r.organization_id as string) ?? []), name])
  }

  // Nightly runs cover live startups that haven't been switched off, oldest check first.
  const orgs = ((orgRows ?? []) as Row[])
    .filter((o) => opts.kind === "manual" || (o.status === "active" && stateBy.get(o.id as string)?.enabled !== false))
    .sort((a, b) => String(stateBy.get(a.id as string)?.last_checked_at ?? "").localeCompare(String(stateBy.get(b.id as string)?.last_checked_at ?? "")))

  const press = await fetchPressFeeds()
  press.errors.forEach(note)
  const today = isoDay(new Date())

  for (const [index, org] of orgs.entries()) {
    if (Date.now() > opts.deadline || summary.itemsAnalyzed >= MAX_ANALYSES) {
      summary.orgsRemaining = orgs.length - index
      break
    }
    const id = org.id as string
    const name = org.name as string
    const state = stateBy.get(id)
    const target: MatchTarget = {
      name,
      aliases: (state?.search_aliases as string[] | undefined) ?? [],
      excludeTerms: (state?.exclude_terms as string[] | undefined) ?? [],
    }

    // 1. Collect
    const found: FoundItem[] = []
    let lastBodacc = (state?.last_bodacc_date as string | null | undefined) ?? null
    let bodaccItems: FoundItem[] = []
    const siren = sirenBy.get(id)
    if (siren) {
      try {
        bodaccItems = await fetchBodacc(siren, lastBodacc ?? daysAgo(BODACC_FIRST_LOOKBACK_DAYS))
        found.push(...bodaccItems)
      } catch (err) {
        note(`${name}: BODACC ${err instanceof Error ? err.message : "failed"}`)
      }
    }
    try {
      found.push(...(await fetchGoogleNews(target)))
    } catch (err) {
      note(`${name}: Google News ${err instanceof Error ? err.message : "failed"}`)
    }
    found.push(...pressMatches(press.items, target))

    // 2. Drop what we've already seen: queued drafts and existing signals' sources.
    const [{ data: seenRows }, { data: signalRows }] = await Promise.all([
      svc.from("signal_candidates").select("source_url").eq("organization_id", id),
      svc.from("signals").select("id, signal_type, signal_date, title, source_url").eq("organization_id", id)
        .order("signal_date", { ascending: false, nullsFirst: false }).limit(50),
    ])
    const signals = (signalRows ?? []) as { id: string; signal_type: string; signal_date: string | null; title: string; source_url: string | null }[]
    const seen = new Set<string>([
      ...((seenRows ?? []) as { source_url: string }[]).map((r) => r.source_url),
      ...signals.map((s) => s.source_url).filter((u): u is string => Boolean(u)),
    ])
    const fresh: FoundItem[] = []
    // URLs fully dealt with this run: already known, or read by Claude.
    const processed = new Set<string>()
    for (const it of found) {
      if (seen.has(it.url)) {
        processed.add(it.url)
        continue
      }
      seen.add(it.url)
      fresh.push(it)
    }
    summary.itemsSeen += fresh.length

    // 3. Judge and queue
    const company: CompanyContext = {
      name,
      aliases: target.aliases,
      website: (org.website as string | null) ?? null,
      city: one(org.cities as { name: string } | { name: string }[] | null)?.name ?? null,
      description: ((org.short_description as string | null) || (org.description as string | null) || "").slice(0, 800) || null,
      sectors: sectorsBy.get(id) ?? [],
      recentSignals: signals.slice(0, 10).map((s) => ({ signal_type: s.signal_type, signal_date: s.signal_date, title: s.title })),
    }
    for (const it of fresh.slice(0, MAX_ITEMS_PER_ORG)) {
      if (summary.itemsAnalyzed >= MAX_ANALYSES || Date.now() > opts.deadline) break
      summary.itemsAnalyzed++
      const result = await analyzeItem(company, it, today)
      if ("error" in result) {
        note(`${name}: ${result.error} (${it.url})`)
        continue
      }
      const a = result.analysis
      const usable = isUsable(a)
      // Dropped finds are stored as "dismissed" so they aren't read again tomorrow.
      const { data: inserted, error } = await svc.from("signal_candidates").insert({
        status: usable ? "pending" : "dismissed",
        organization_id: id,
        source: it.source,
        source_url: it.url,
        source_name: it.sourceName,
        source_published_at: it.publishedAt,
        raw_title: it.title,
        raw_excerpt: it.excerpt,
        signal_type: a.signal_type,
        title: a.title,
        description: a.description || null,
        signal_date: a.signal_date,
        strength: a.strength,
        funding_amount_eur: a.signal_type === "fundraising" ? a.funding_amount_eur : null,
        funding_stage: a.signal_type === "fundraising" ? a.funding_stage : null,
        investors: a.signal_type === "fundraising" ? a.investors : null,
        confidence: a.confidence,
        ai_reasoning: a.reasoning || null,
        possible_duplicate_signal_id: findPossibleDuplicate(a, signals),
      }).select("id").single()
      if (error) {
        // 23505: another run queued the same URL a moment ago.
        if (error.code === "23505") processed.add(it.url)
        else note(`${name}: could not queue draft: ${error.message}`)
        continue
      }
      processed.add(it.url)
      if (!usable) continue
      summary.candidatesCreated++
      summary.candidateIds.push(inserted.id as string)
    }

    // The BODACC query only returns filings after last_bodacc_date, so move it
    // forward only past filings that were dealt with; anything skipped this
    // time (Claude error, per-run cap, deadline) is fetched again next run.
    const bodaccDates = (pick: (it: FoundItem) => boolean) =>
      bodaccItems.filter(pick).map((it) => it.publishedAt?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort()
    const pendingDates = bodaccDates((it) => !processed.has(it.url))
    const doneDates = bodaccDates((it) => processed.has(it.url))
    const nextCursor = pendingDates.length ? dayBefore(pendingDates[0]) : doneDates.at(-1) ?? null
    if (nextCursor && (!lastBodacc || nextCursor > lastBodacc)) lastBodacc = nextCursor

    await svc.from("monitoring_state").upsert({
      organization_id: id,
      last_checked_at: new Date().toISOString(),
      last_bodacc_date: lastBodacc,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" })
    summary.orgsChecked++
  }

  if (summary.runId) {
    await svc.from("monitoring_runs").update({
      finished_at: new Date().toISOString(),
      orgs_checked: summary.orgsChecked,
      items_seen: summary.itemsSeen,
      items_analyzed: summary.itemsAnalyzed,
      candidates_created: summary.candidatesCreated,
      errors: summary.errors,
    }).eq("id", summary.runId)
  }
  return summary
}
