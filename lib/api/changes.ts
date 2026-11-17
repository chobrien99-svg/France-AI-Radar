// The change feed's pure parts: what is tracked for each entity, the
// public shape of an event, and its cursor. Kept free of database code so
// `npm test` can run it; lib/api/sync.ts does the reading and writing.
import { createHash } from "node:crypto"
import { invalid } from "@/lib/api/errors"
import { limitParam, rejectUnknown } from "@/lib/api/params"
import type { Dataset } from "@/lib/api/model"
import { SITE_URL, toCompany, toSignal } from "@/lib/api/serialize"

export type TrackedRecord = { entity_type: "company" | "signal"; entity_id: string; hash: string; record: Record<string, unknown> }

/** JSON with object keys sorted, so equal records always hash the same. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`
  }
  return JSON.stringify(v ?? null)
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

/**
 * Exactly what a customer receives for each published entity, minus fields
 * that move without a real change: updated_at, and for signals the company's
 * name and links (a company rename must not re-announce all its signals).
 */
export function trackedRecords(ds: Dataset): TrackedRecord[] {
  const out: TrackedRecord[] = []
  for (const c of ds.companies) {
    const record: Record<string, unknown> = { ...toCompany(c) }
    delete record.updated_at
    out.push({ entity_type: "company", entity_id: c.id, hash: sha(stableStringify(record)), record })
  }
  const byId = new Map(ds.companies.map((c) => [c.id, c]))
  for (const s of ds.signals) {
    const company = byId.get(s.companyId)
    if (!company) continue
    const record: Record<string, unknown> = { ...toSignal(s, company), company_id: s.companyId }
    delete record.updated_at
    delete record.company
    out.push({ entity_type: "signal", entity_id: s.id, hash: sha(stableStringify(record)), record })
  }
  return out
}

// ---- cursors: opaque, carrying the event sequence number ----

export function encodeSeqCursor(seq: number): string {
  return Buffer.from(JSON.stringify({ v: 1, seq })).toString("base64url")
}

export function decodeSeqCursor(cursor: string | null): number | null {
  if (cursor == null || cursor === "") return null
  try {
    const p = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { v?: unknown; seq?: unknown }
    if (p.v === 1 && Number.isSafeInteger(p.seq) && (p.seq as number) >= 0) return p.seq as number
  } catch {
    // fall through
  }
  throw invalid("cursor is not valid")
}

export const CHANGES_PARAMS = ["cursor", "limit"]

export function parseChangesQuery(params: URLSearchParams) {
  rejectUnknown(params, CHANGES_PARAMS)
  return { after: decodeSeqCursor(params.get("cursor")), limit: limitParam(params, { max: 500, fallback: 200 }) }
}

export type EventRow = {
  seq: number
  event_id: string
  entity_type: "company" | "signal"
  entity_id: string
  event_type: "created" | "updated" | "withdrawn" | "deleted" | "merged"
  record_version: number
  changed_fields: string[] | null
  merged_into: string | null
  occurred_at: string
}

export function toChange(e: EventRow) {
  const live = e.event_type === "created" || e.event_type === "updated"
  return {
    object: "change" as const,
    event_id: e.event_id,
    cursor: encodeSeqCursor(Number(e.seq)),
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    event_type: e.event_type,
    record_version: e.record_version,
    occurred_at: new Date(e.occurred_at).toISOString(),
    changed_fields: e.changed_fields ?? [],
    merged_into: e.merged_into,
    href: live ? `/v1/${e.entity_type === "company" ? "companies" : "signals"}/${e.entity_id}` : null,
  }
}

export const RADAR_URL = SITE_URL
