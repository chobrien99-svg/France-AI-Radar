// Opaque pagination cursors: base64url JSON holding the last item's sort
// key and a fingerprint of the query, so a cursor can't be reused with
// different filters or sort order.
import { createHash } from "node:crypto"
import { invalid } from "@/lib/api/errors"

export type CursorKey = [string | number | null, string]

export function queryFingerprint(params: URLSearchParams): string {
  const pairs = [...params.entries()].filter(([k]) => k !== "cursor" && k !== "limit").sort(([a, av], [b, bv]) => (a + av).localeCompare(b + bv))
  return createHash("sha256").update(JSON.stringify(pairs)).digest("base64url").slice(0, 12)
}

export function encodeCursor(key: CursorKey, fingerprint: string): string {
  return Buffer.from(JSON.stringify({ v: 1, k: key, f: fingerprint })).toString("base64url")
}

export function decodeCursor(cursor: string | null, fingerprint: string): CursorKey | null {
  if (!cursor) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  } catch {
    throw invalid("cursor is not valid")
  }
  const p = parsed as { v?: unknown; k?: unknown; f?: unknown }
  const k = p?.k
  if (p?.v !== 1 || !Array.isArray(k) || k.length !== 2 || typeof k[1] !== "string") throw invalid("cursor is not valid")
  if (p.f !== fingerprint) throw invalid("cursor belongs to a different query; repeat the same filters and sort")
  return [k[0] as string | number | null, k[1]]
}

/**
 * One page of `items` (already sorted by `compare`), starting after `after`.
 * `keyOf` gives each item's [sortValue, id], the same shape as the cursor.
 */
export function page<T>(
  items: T[],
  opts: { limit: number; after: CursorKey | null; keyOf: (item: T) => CursorKey; compareKeys: (a: CursorKey, b: CursorKey) => number; fingerprint: string },
): { data: T[]; next_cursor: string | null } {
  const { limit, after, keyOf, compareKeys, fingerprint } = opts
  const start = after ? items.findIndex((it) => compareKeys(keyOf(it), after) > 0) : 0
  const from = start < 0 ? items.length : start
  const data = items.slice(from, from + limit)
  const more = from + limit < items.length
  return { data, next_cursor: more && data.length ? encodeCursor(keyOf(data[data.length - 1]), fingerprint) : null }
}

/** Compare two keys: sort value (asc or desc, nulls last), then id ascending. */
export function keyComparator(direction: "asc" | "desc") {
  return (a: CursorKey, b: CursorKey): number => {
    const [av, aid] = a
    const [bv, bid] = b
    if (av !== bv) {
      if (av == null) return 1
      if (bv == null) return -1
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))
      if (c !== 0) return direction === "asc" ? c : -c
    }
    return aid < bid ? -1 : aid > bid ? 1 : 0
  }
}
