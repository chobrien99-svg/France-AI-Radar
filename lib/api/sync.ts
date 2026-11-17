// Reads and writes the change feed (tables from
// supabase/migrations/20261117_api_change_feed.sql).
import type { SupabaseClient } from "@supabase/supabase-js"
import { ApiError } from "@/lib/api/errors"
import { loadDataset } from "@/lib/api/load"
import { encodeSeqCursor, toChange, trackedRecords, type EventRow } from "@/lib/api/changes"

/** The feed is refreshed at least this often when clients read it (the cron runs every 10 minutes). */
export const MAX_FEED_AGE_MS = 10 * 60_000

export type SyncState = { last_run_at: string | null; last_seq: number; pruned_through: number }

export async function readSyncState(svc: SupabaseClient): Promise<SyncState> {
  const { data, error } = await svc.from("api_sync_state").select("last_run_at, last_seq, pruned_through").eq("id", 1).maybeSingle()
  if (error) throw new Error(`api_sync_state: ${error.message}`)
  return { last_run_at: data?.last_run_at ?? null, last_seq: Number(data?.last_seq ?? 0), pruned_through: Number(data?.pruned_through ?? 0) }
}

/** Compare what the API publishes now with the recorded state and append events. */
export async function recordChanges(svc: SupabaseClient) {
  const ds = await loadDataset(svc, { fresh: true })
  if (ds.companies.length === 0) throw new Error("dataset is empty; refusing to record changes")
  const { data, error } = await svc.rpc("api_record_changes", { p_records: trackedRecords(ds) })
  if (error) throw new Error(`api_record_changes: ${error.message}`)
  return data as Record<string, number>
}

/** Run the recorder first when the feed is older than MAX_FEED_AGE_MS. */
export async function ensureFresh(svc: SupabaseClient): Promise<SyncState> {
  const state = await readSyncState(svc)
  if (state.last_run_at && Date.now() - Date.parse(state.last_run_at) < MAX_FEED_AGE_MS) return state
  await recordChanges(svc)
  return readSyncState(svc)
}

export async function listChanges(svc: SupabaseClient, q: { after: number | null; limit: number }) {
  const state = await ensureFresh(svc)
  if (q.after != null && q.after < state.pruned_through) {
    throw new ApiError("cursor_expired", "This cursor is older than the 90-day history. Run a full sync from /v1/snapshot.")
  }
  const after = q.after ?? state.pruned_through
  const { data, error } = await svc
    .from("api_change_events")
    .select("seq, event_id, entity_type, entity_id, event_type, record_version, changed_fields, merged_into, occurred_at")
    .gt("seq", after)
    .order("seq")
    .limit(q.limit + 1)
  if (error) throw new Error(`api_change_events: ${error.message}`)
  const rows = (data ?? []) as EventRow[]
  const pageRows = rows.slice(0, q.limit)
  const lastSeq = pageRows.length ? Number(pageRows[pageRows.length - 1].seq) : after
  return {
    object: "list" as const,
    data: pageRows.map(toChange),
    next_cursor: encodeSeqCursor(lastSeq),
    has_more: rows.length > q.limit,
    synced_at: state.last_run_at,
  }
}

/** Start of a full sync: the cursor to replay changes from once the snapshot is read. */
export async function snapshotStart(svc: SupabaseClient) {
  const state = await ensureFresh(svc)
  return {
    data: {
      replay_cursor: encodeSeqCursor(state.last_seq),
      synced_at: state.last_run_at,
      steps: [
        "Store replay_cursor.",
        "Read every page of /v1/companies (and /v1/signals if you sync them).",
        "Then call /v1/changes?cursor=<replay_cursor> and keep following next_cursor.",
      ],
    },
  }
}
