// ------------------------------------------------------------------
// One signal monitoring run: for each AI Radar startup, collect new items
// from BODACC, Pappers (webhook messages and record reads), Google News and the press feeds, have Claude judge and draft
// each one, and queue the credible ones in signal_candidates for review.
// Called nightly by /api/cron/monitor-signals and on demand ("Check now").
// How it works: docs/signal-monitoring.md
// ------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js"
import { analysisConfigured, analyzeItem } from "@/lib/monitoring/analyze"
import { findPossibleDuplicate, isUsable, type CompanyContext } from "@/lib/monitoring/analysis"
import type { MatchTarget } from "@/lib/monitoring/match"
import { normalizeSiren, parsePappersCompany, parsePappersWebhook, type FoundItem, type PappersLead, type PappersSnapshot } from "@/lib/monitoring/parse"
import { addToWatchList, getCompany, PappersAccountError, pappersConfigured, pappersIntervalDays, pappersWatchListId } from "@/lib/monitoring/pappers"
import { fetchBodacc, fetchGoogleNews, fetchPressFeeds, pressMatches } from "@/lib/monitoring/sources"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

/** Claude calls per run, so a noisy night can't run up the bill. */
const MAX_ANALYSES = Number(process.env.MONITOR_MAX_ANALYSES) || 150
/** Per startup per run: a burst of coverage is usually one story. */
const MAX_ITEMS_PER_ORG = 12
/** How far back BODACC is read the first time a startup is checked. */
const BODACC_FIRST_LOOKBACK_DAYS = 90
/** Pappers events this recent are considered; ones already seen are skipped by URL. */
const PAPPERS_LOOKBACK_DAYS = 90
/** Pappers webhook messages read per run; the rest wait for the next one. */
const INBOX_BATCH = 200

export type RunSummary = {
  runId: string | null
  orgsChecked: number
  orgsRemaining: number
  itemsSeen: number
  itemsAnalyzed: number
  candidatesCreated: number
  candidateIds: string[]
  /** Companies new to the "to vet" list (from Pappers saved searches). */
  leadsAdded: number
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
  const summary: RunSummary = { runId: null, orgsChecked: 0, orgsRemaining: 0, itemsSeen: 0, itemsAnalyzed: 0, candidatesCreated: 0, candidateIds: [], leadsAdded: 0, errors: [] }
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

  // Pappers watch list: startups not on it yet are added (free with the
  // subscription); Pappers then posts their changes to /api/webhooks/pappers.
  const watchList = pappersWatchListId()
  if (watchList && pappersConfigured()) {
    const toWatch = orgs
      .map((o) => ({ id: o.id as string, siren: normalizeSiren(sirenBy.get(o.id as string)) }))
      .filter((o): o is { id: string; siren: string } => Boolean(o.siren) && stateBy.get(o.id)?.pappers_watched_siren !== o.siren)
    if (toWatch.length) {
      try {
        await addToWatchList(watchList, [...new Set(toWatch.map((o) => o.siren))])
        const now = new Date().toISOString()
        await svc.from("monitoring_state").upsert(
          toWatch.map((o) => ({ organization_id: o.id, pappers_watched_siren: o.siren, updated_at: now })),
          { onConflict: "organization_id" },
        )
        for (const o of toWatch) stateBy.set(o.id, { ...(stateBy.get(o.id) ?? {}), pappers_watched_siren: o.siren })
      } catch (err) {
        note(err instanceof Error ? err.message : "Pappers watch list failed")
      }
    }
  }

  // Pappers webhook messages: changes to Radar startups join that startup's
  // finds below; companies new to a saved search go to the "to vet" list.
  const inbox = await readInbox(svc, opts, ids, new Set(orgs.map((o) => o.id as string)))
  summary.leadsAdded = inbox.leadsAdded
  inbox.errors.forEach(note)
  const handledUrls = new Set<string>()

  const press = await fetchPressFeeds()
  press.errors.forEach(note)
  const today = isoDay(new Date())
  const pappersEvery = pappersIntervalDays()
  // Turned off for the rest of the run after a refused key or empty credit balance.
  let pappersOn = pappersConfigured() && (opts.kind === "manual" || pappersEvery > 0)

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
    // Pappers: one company record (1 credit) per startup every pappersEvery days.
    let pappersItems: FoundItem[] = []
    let pappersSnapshot: PappersSnapshot | null = null
    const lastPappers = (state?.last_pappers_at as string | null | undefined) ?? null
    const previousSnapshot = (state?.pappers_seen as PappersSnapshot | null | undefined) ?? null
    const pappersDue = opts.kind === "manual" || !lastPappers || Date.now() - Date.parse(lastPappers) >= pappersEvery * 86_400_000 - 3_600_000
    // Once Pappers has proved it sends webhook messages, watched startups need no paid reads.
    const watched = inbox.webhooksWork && Boolean(siren) && state?.pappers_watched_siren === normalizeSiren(siren)
    found.push(...(inbox.itemsBy.get(id) ?? []))
    if (siren && pappersOn && pappersDue && !watched) {
      try {
        const parsed = parsePappersCompany(
          await getCompany(siren),
          daysAgo(Math.max(PAPPERS_LOOKBACK_DAYS, pappersEvery * 2)),
          previousSnapshot && typeof previousSnapshot === "object" && "closed" in previousSnapshot ? previousSnapshot : null,
          today,
        )
        pappersItems = parsed.items
        pappersSnapshot = parsed.snapshot
        found.push(...pappersItems)
      } catch (err) {
        if (err instanceof PappersAccountError) pappersOn = false
        note(err instanceof PappersAccountError ? err.message : `${name}: ${err instanceof Error ? err.message : "Pappers failed"}`)
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

    // A capital or closure change is found by comparing with the stored
    // snapshot, so keep the old one until that item has been dealt with.
    const pappersUpdate: Record<string, unknown> = {}
    if (pappersSnapshot) {
      pappersUpdate.last_pappers_at = new Date().toISOString()
      const changeUnread = pappersItems.some((it) => /#(capital|cessation)-/.test(it.url) && !processed.has(it.url))
      if (!changeUnread) pappersUpdate.pappers_seen = pappersSnapshot
    }

    processed.forEach((u) => handledUrls.add(u))
    await svc.from("monitoring_state").upsert({
      organization_id: id,
      last_checked_at: new Date().toISOString(),
      last_bodacc_date: lastBodacc,
      ...pappersUpdate,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" })
    summary.orgsChecked++
  }

  // A webhook message is done once every Radar change in it was read (or
  // was already known); the rest wait for the next run.
  const done = inbox.rows.filter((r) => r.urls.every((u) => handledUrls.has(u))).map((r) => r.id)
  if (done.length) await svc.from("monitoring_inbox").update({ processed_at: new Date().toISOString() }).in("id", done)

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

type InboxRead = {
  /** Changes to Radar startups in this run, by organization id. */
  itemsBy: Map<string, FoundItem[]>
  /** Each unprocessed message and the item URLs it is waiting on. */
  rows: { id: string; urls: string[]; hasLeads?: boolean }[]
  leadsAdded: number
  /** True once any surveillance message has ever arrived. */
  webhooksWork: boolean
  errors: string[]
}

/**
 * Unprocessed Pappers webhook messages → items per startup, plus new leads.
 * A change to a startup outside this run waits for a run that covers it,
 * except on the nightly run, where startups left out (inactive, monitoring
 * off) simply don't wait.
 */
async function readInbox(
  svc: SupabaseClient,
  opts: { kind: "cron" | "manual" },
  runIds: string[],
  orgsInRun: Set<string>,
): Promise<InboxRead> {
  const out: InboxRead = { itemsBy: new Map(), rows: [], leadsAdded: 0, webhooksWork: false, errors: [] }
  const [{ data: rows, error }, { data: proof }] = await Promise.all([
    svc.from("monitoring_inbox").select("id, evenement, payload").is("processed_at", null).order("received_at").limit(INBOX_BATCH),
    svc.from("monitoring_inbox").select("id").eq("evenement", "notifications.entreprises").limit(1),
  ])
  out.webhooksWork = (proof ?? []).length > 0
  if (error || !rows?.length) return out

  // Every SIREN already on the site, and which Radar startup (if any) owns it.
  const radarIds = new Set([...runIds, ...(opts.kind === "manual" ? await targetIds(svc) : [])])
  const { data: entities } = await svc.from("legal_entities").select("organization_id, siren")
  const known = new Set<string>()
  const orgBySiren = new Map<string, string>()
  for (const e of (entities ?? []) as Row[]) {
    const siren = normalizeSiren(e.siren as string | null)
    if (!siren) continue
    known.add(siren)
    if (radarIds.has(e.organization_id as string)) orgBySiren.set(siren, e.organization_id as string)
  }

  const leads = new Map<string, PappersLead & { listName: string | null }>()
  for (const row of rows as Row[]) {
    const msg = parsePappersWebhook(row.payload)
    const urls: string[] = []
    for (const change of msg.changes) {
      const org = orgBySiren.get(change.siren)
      if (!org || (opts.kind === "cron" && !orgsInRun.has(org))) continue
      out.itemsBy.set(org, [...(out.itemsBy.get(org) ?? []), ...change.items])
      urls.push(...change.items.map((it) => it.url))
    }
    for (const lead of msg.leads) if (!known.has(lead.siren)) leads.set(lead.siren, { ...lead, listName: msg.listName })
    out.rows.push({ id: row.id as string, urls, hasLeads: msg.leads.length > 0 })
  }

  if (leads.size) {
    const { data: added, error: leadError } = await svc.from("company_leads").upsert(
      [...leads.values()].map((l) => ({ siren: l.siren, name: l.name, list_name: l.listName, is_new_company: l.isNew })),
      { onConflict: "siren", ignoreDuplicates: true },
    ).select("siren")
    if (leadError) {
      // Keep the messages so the leads are saved next time.
      out.errors.push(`Pappers: could not save companies to vet: ${leadError.message}`)
      out.rows = out.rows.filter((r) => !r.hasLeads)
    } else {
      out.leadsAdded = (added ?? []).length
    }
  }
  return out
}
