// Query-string validation for the Enterprise API. Unknown parameters are
// rejected so a typo ("sectr=") fails loudly instead of returning everything.
import { invalid } from "@/lib/api/errors"

const SLUG = /^[a-z0-9][a-z0-9_-]{0,80}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (s: string) => UUID.test(s)

export function rejectUnknown(params: URLSearchParams, allowed: string[]) {
  for (const key of new Set(params.keys())) {
    if (!allowed.includes(key)) throw invalid(allowed.length ? `unknown parameter "${key}"; allowed: ${allowed.join(", ")}` : `unknown parameter "${key}"; this endpoint takes no parameters`)
  }
}

/** Comma-separated or repeated slugs: ?sector=a,b or ?sector=a&sector=b */
export function slugList(params: URLSearchParams, name: string, allowedValues?: readonly string[]): string[] {
  const values = params.getAll(name).flatMap((v) => v.split(",")).map((v) => v.trim().toLowerCase()).filter(Boolean)
  if (values.length > 50) throw invalid(`${name}: at most 50 values`)
  for (const v of values) {
    if (!SLUG.test(v)) throw invalid(`${name}: "${v}" is not a valid slug`)
    if (allowedValues && !allowedValues.includes(v)) throw invalid(`${name}: "${v}" is not one of ${allowedValues.join(", ")}`)
  }
  return [...new Set(values)]
}

export function uuidList(params: URLSearchParams, name: string): string[] {
  const values = params.getAll(name).flatMap((v) => v.split(",")).map((v) => v.trim().toLowerCase()).filter(Boolean)
  if (values.length > 100) throw invalid(`${name}: at most 100 values`)
  for (const v of values) if (!isUuid(v)) throw invalid(`${name}: "${v}" is not a UUID`)
  return [...new Set(values)]
}

export function one(params: URLSearchParams, name: string): string | null {
  const all = params.getAll(name)
  if (all.length > 1) throw invalid(`${name}: give it once`)
  const v = all[0]?.trim()
  return v ? v : null
}

export function limitParam(params: URLSearchParams, { max, fallback }: { max: number; fallback: number }): number {
  const v = one(params, "limit")
  if (v == null) return fallback
  if (!/^\d+$/.test(v)) throw invalid("limit must be a whole number")
  const n = Number(v)
  if (n < 1 || n > max) throw invalid(`limit must be between 1 and ${max}`)
  return n
}

export function enumParam<T extends string>(params: URLSearchParams, name: string, values: readonly T[], fallback: T): T {
  const v = one(params, name)
  if (v == null) return fallback
  if (!(values as readonly string[]).includes(v)) throw invalid(`${name} must be one of ${values.join(", ")}`)
  return v as T
}

/** ISO 8601 date-time with a timezone (Z or ±hh:mm). Returns epoch ms. */
export function dateTimeParam(params: URLSearchParams, name: string): number | null {
  const v = one(params, name)
  if (v == null) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) throw invalid(`${name} must be an ISO 8601 date-time with a timezone, e.g. 2026-11-01T00:00:00Z`)
  const t = Date.parse(v)
  if (Number.isNaN(t)) throw invalid(`${name} is not a valid date-time`)
  return t
}

/** YYYY-MM-DD */
export function dateParam(params: URLSearchParams, name: string): string | null {
  const v = one(params, name)
  if (v == null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z"))) throw invalid(`${name} must be a date, YYYY-MM-DD`)
  return v
}

export function searchParam(params: URLSearchParams): string {
  const q = (one(params, "q") ?? "").toLowerCase()
  if (q.length > 200) throw invalid("q: at most 200 characters")
  return q
}
