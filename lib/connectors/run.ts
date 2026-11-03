// Runs one source: read it, store each item as an immutable record, and build
// candidates from the relevant ones. Every run is logged in ingestion_runs;
// items that can't be read go to ingestion_failures and are retried next time.
//
// Repeat-safe: the same content is stored once (source_id, external_id,
// content_hash); a changed item adds a new version and keeps the old one.
// History mode: until a source's history import is complete, everything it
// stores is marked as history, so old items are never presented as news.
// "Complete" means a history-mode run finished and no item that failed during
// history mode is still unresolved (read correctly later, or dismissed by an
// editor). A partial first import therefore keeps the source in history mode.
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ADAPTERS } from "@/lib/connectors/registry"
import type { FetchLike, NormalizedItem } from "@/lib/connectors/types"
import { buildCandidate, type BuildContext } from "@/lib/detection/build"

type Row = Record<string, unknown>

export type RunKind = "cron" | "manual" | "backfill"

export type RunSummary = {
  runId: string | null
  status: "succeeded" | "partial" | "failed"
  fetched: number
  newRecords: number
  changedRecords: number
  unchangedRecords: number
  failedRecords: number
  candidatesCreated: number
  candidatesUpdated: number
  notRelevant: number
  failuresResolved: number
  isHistoryImport: boolean
  historyComplete: boolean
  errors: string[]
}

type Options = {
  kind: RunKind
  fetchImpl?: FetchLike
  /** Waits between download attempts (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>
  now?: () => Date
}

const PAGE = 1000
const MAX_ERRORS = 50
const RETRY_DELAYS_MS = [2_000, 8_000]

/** Stable JSON (sorted keys) so the same content always hashes the same. */
export function contentHash(payload: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable)
      : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as Row).sort().map((k) => [k, stable((v as Row)[k])]))
        : v
  return createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex")
}

/** fetch with up to 3 attempts on network errors, 429 and 5xx. */
export function withRetry(fetchImpl: FetchLike, sleep: (ms: number) => Promise<void>): FetchLike {
  return async (url, init) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(60_000) })
        if (res.status !== 429 && res.status < 500) return res
        lastError = new Error(`HTTP ${res.status}`)
      } catch (err) {
        lastError = err
      }
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
    }
    throw new Error(`Download failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }
}

export async function runSource(svc: SupabaseClient, slug: string, opts: Options): Promise<RunSummary> {
  const now = opts.now ?? (() => new Date())
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const summary: RunSummary = {
    runId: null, status: "succeeded", fetched: 0, newRecords: 0, changedRecords: 0, unchangedRecords: 0,
    failedRecords: 0, candidatesCreated: 0, candidatesUpdated: 0, notRelevant: 0, failuresResolved: 0,
    isHistoryImport: false, historyComplete: false, errors: [],
  }
  const note = (msg: string) => { if (summary.errors.length < MAX_ERRORS) summary.errors.push(msg) }

  const adapter = ADAPTERS[slug]
  if (!adapter) throw new Error(`No connector for source "${slug}"`)
  const { data: source, error: sourceError } = await svc.from("detection_sources").select("*").eq("slug", slug).maybeSingle()
  if (sourceError) throw new Error(`Source lookup: ${sourceError.message}`)
  if (!source) throw new Error(`Source "${slug}" is not registered (run the Early Detection migration)`)
  const src = source as Row
  const sourceId = src.id as string
  const isBackfill = opts.kind === "backfill" || !src.history_complete
  summary.isHistoryImport = isBackfill

  const { data: run, error: runError } = await svc.from("ingestion_runs")
    .insert({ source_id: sourceId, kind: opts.kind, status: "running", is_history_import: isBackfill, cursor_before: src.cursor ?? null })
    .select("id").single()
  if (runError) throw new Error(`Run log: ${runError.message}`)
  summary.runId = (run as Row).id as string

  // Keys of items that failed this run: never treated as resolved by another item sharing the key.
  const failedKeys = new Set<string>()
  const fail = async (rawExternalId: string | null, raw: unknown, err: unknown) => {
    summary.failedRecords++
    if (rawExternalId) failedKeys.add(rawExternalId)
    const message = err instanceof Error ? err.message : String(err)
    note(`${rawExternalId ?? "item"}: ${message}`)
    await svc.from("ingestion_failures").insert({ source_id: sourceId, run_id: summary.runId, external_id: rawExternalId, raw, error: message })
  }

  // 1. Read the source.
  let items: Record<string, string>[]
  let cursorAfter: unknown
  try {
    const got = await adapter.fetchItems(withRetry(opts.fetchImpl ?? fetch, sleep), src.cursor ?? null)
    items = got.items
    cursorAfter = got.cursor
    summary.fetched = items.length
  } catch (err) {
    summary.status = "failed"
    note(err instanceof Error ? err.message : String(err))
    await finish(svc, summary, sourceId, src, now(), null)
    summary.historyComplete = (await refreshHistoryState(svc, sourceId)).complete
    return summary
  }

  // 2. What we already hold for this source.
  const known = new Map<string, { id: string; hash: string; processed: boolean; firstSeenAt: string; isBackfill: boolean }[]>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await svc.from("source_records")
      .select("id, external_id, content_hash, processed_at, first_seen_at, is_backfill")
      .eq("source_id", sourceId)
      .order("first_seen_at", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Records lookup: ${error.message}`)
    for (const r of (data ?? []) as Row[]) {
      const list = known.get(r.external_id as string) ?? []
      list.push({ id: r.id as string, hash: r.content_hash as string, processed: !!r.processed_at, firstSeenAt: r.first_seen_at as string, isBackfill: !!r.is_backfill })
      known.set(r.external_id as string, list)
    }
    if ((data ?? []).length < PAGE) break
  }

  // 3. Store new and changed items.
  const toBuild: { recordId: string; item: NormalizedItem; isBackfill: boolean; firstSeenAt: string; keys: string[] }[] = []
  // Keys of items handled successfully this run: they resolve earlier failures for the same item.
  const resolvedKeys = new Set<string>()
  const looseKey = (raw: Record<string, string>) => {
    try { const k = adapter.looseKey?.(raw); return k ? `~${k}` : null } catch { return null }
  }
  const seenIds: string[] = []
  const seenThisRun = new Set<string>()
  for (const raw of items) {
    let item: NormalizedItem
    try {
      item = adapter.normalize(raw)
    } catch (err) {
      await fail(looseKey(raw), raw, err)
      continue
    }
    const keys = [item.externalId, looseKey(raw)].filter((k): k is string => !!k)
    const key = `${item.externalId}`
    if (seenThisRun.has(key)) continue   // the same item listed twice in one file
    seenThisRun.add(key)

    const hash = contentHash(item.payload)
    const versions = known.get(item.externalId) ?? []
    const same = versions.find((v) => v.hash === hash)
    if (same) {
      summary.unchangedRecords++
      seenIds.push(same.id)
      if (!same.processed) toBuild.push({ recordId: same.id, item, isBackfill: same.isBackfill, firstSeenAt: same.firstSeenAt, keys })
      else keys.forEach((k) => resolvedKeys.add(k))
      continue
    }
    const firstSeenAt = now().toISOString()
    const { data: inserted, error } = await svc.from("source_records").insert({
      source_id: sourceId,
      external_id: item.externalId,
      content_hash: hash,
      url: item.url,
      title: item.title,
      payload: item.payload,
      event_date: item.eventDate,
      edition_year: item.editionYear,
      published_at: item.publishedAt,
      first_seen_at: firstSeenAt,
      last_seen_at: firstSeenAt,
      ingested_at: firstSeenAt,
      is_backfill: isBackfill,
      run_id: summary.runId,
    }).select("id").single()
    if (error) {
      await fail(item.externalId, item.payload, new Error(`store: ${error.message}`))
      continue
    }
    if (versions.length) summary.changedRecords++
    else summary.newRecords++
    toBuild.push({ recordId: (inserted as Row).id as string, item, isBackfill, firstSeenAt, keys })
  }

  for (let i = 0; i < seenIds.length; i += 200) {
    await svc.from("source_records").update({ last_seen_at: now().toISOString() }).in("id", seenIds.slice(i, i + 200))
  }

  // 4. Candidates.
  const ctx: BuildContext = { editions: new Map() }
  for (const b of toBuild) {
    try {
      const result = await buildCandidate(svc, adapter.toCandidate(b.item), { id: b.recordId, isBackfill: b.isBackfill, firstSeenAt: b.firstSeenAt }, ctx)
      if (result === "created") summary.candidatesCreated++
      else if (result === "updated") summary.candidatesUpdated++
      else summary.notRelevant++
      await svc.from("source_records").update({ processed_at: now().toISOString() }).eq("id", b.recordId)
      b.keys.forEach((k) => resolvedKeys.add(k))
    } catch (err) {
      await fail(b.item.externalId, null, new Error(`candidate: ${err instanceof Error ? err.message : String(err)}`))
    }
  }

  // Earlier failures for items read correctly this time are resolved.
  const keys = [...resolvedKeys].filter((k) => !failedKeys.has(k))
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await svc.from("ingestion_failures").update({ resolved_at: now().toISOString() })
      .eq("source_id", sourceId).is("resolved_at", null).in("external_id", keys.slice(i, i + 200)).select("id")
    summary.failuresResolved += (data ?? []).length
  }

  summary.status = summary.failedRecords > 0 ? "partial" : "succeeded"
  await finish(svc, summary, sourceId, src, now(), cursorAfter)
  summary.historyComplete = (await refreshHistoryState(svc, sourceId)).complete
  return summary
}

/**
 * Whether the source's history import is complete: a history-mode run
 * finished, and no item that failed during history mode is unresolved.
 * Stored on detection_sources.history_complete; the next run reads it.
 */
export async function refreshHistoryState(svc: SupabaseClient, sourceId: string) {
  const [{ data: runs, error: runsError }, { data: open, error: openError }] = await Promise.all([
    svc.from("ingestion_runs").select("id, status").eq("source_id", sourceId).eq("is_history_import", true),
    svc.from("ingestion_failures").select("id, run_id").eq("source_id", sourceId).is("resolved_at", null),
  ])
  if (runsError || openError) throw new Error(`History state: ${(runsError ?? openError)!.message}`)
  const historyRuns = (runs ?? []) as Row[]
  const historyRunIds = new Set(historyRuns.map((r) => r.id as string))
  const finished = historyRuns.some((r) => r.status === "succeeded" || r.status === "partial")
  const blocking = ((open ?? []) as Row[]).filter((f) => historyRunIds.has(f.run_id as string)).length
  const complete = finished && blocking === 0
  await svc.from("detection_sources").update({ history_complete: complete }).eq("id", sourceId)
  return { complete, openHistoryFailures: blocking }
}

/**
 * An editor gives up on unreadable items (all, or the given ids). Ends
 * history mode if nothing else is pending. If the publisher later fixes a
 * dismissed item in a way we can't recognise, it will appear as a new find.
 */
export async function dismissFailures(svc: SupabaseClient, slug: string, ids: string[] | "all", at = new Date()) {
  const { data: source, error } = await svc.from("detection_sources").select("id").eq("slug", slug).maybeSingle()
  if (error) throw new Error(error.message)
  if (!source) throw new Error(`Source "${slug}" not found`)
  const sourceId = (source as Row).id as string
  let q = svc.from("ingestion_failures").update({ resolved_at: at.toISOString() }).eq("source_id", sourceId).is("resolved_at", null)
  if (ids !== "all") q = q.in("id", ids)
  const { data, error: updateError } = await q.select("id")
  if (updateError) throw new Error(updateError.message)
  return { dismissed: (data ?? []).length, ...(await refreshHistoryState(svc, sourceId)) }
}

async function finish(svc: SupabaseClient, s: RunSummary, sourceId: string, src: Row, at: Date, cursorAfter: unknown) {
  const ok = s.status !== "failed"
  await svc.from("ingestion_runs").update({
    status: s.status,
    finished_at: at.toISOString(),
    cursor_after: cursorAfter ?? null,
    fetched: s.fetched,
    new_records: s.newRecords,
    changed_records: s.changedRecords,
    unchanged_records: s.unchangedRecords,
    failed_records: s.failedRecords,
    candidates_created: s.candidatesCreated,
    candidates_updated: s.candidatesUpdated,
    errors: s.errors,
  }).eq("id", s.runId!)
  await svc.from("detection_sources").update({
    last_run_at: at.toISOString(),
    ...(ok ? { last_success_at: at.toISOString(), consecutive_failures: 0, cursor: cursorAfter ?? src.cursor ?? null } : { consecutive_failures: Number(src.consecutive_failures ?? 0) + 1 }),
  }).eq("id", sourceId)
}
