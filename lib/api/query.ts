// Filtering, sorting and pagination for the Enterprise API, on a loaded
// Dataset. Pure functions, so the same rules can be tested without a
// database and reused by the MCP server in Stage 4.
import { withDescendants } from "@/lib/taxonomy"
import { SIGNAL_TYPE_LABELS } from "@/lib/subscription"
import { ApiError } from "@/lib/api/errors"
import { decodeCursor, keyComparator, page, queryFingerprint, type CursorKey } from "@/lib/api/cursor"
import { dateParam, dateTimeParam, enumParam, isUuid, limitParam, rejectUnknown, searchParam, slugList, uuidList } from "@/lib/api/params"
import { STAGES, type CompanyRecord, type Dataset, type SignalRecord } from "@/lib/api/model"
import { stageSlug, toCompany, toCompanySummary, toSignal } from "@/lib/api/serialize"

const STAGE_SLUGS = STAGES.map((s) => s.slug)
const SIGNAL_TYPES = Object.keys(SIGNAL_TYPE_LABELS)
const COMPANY_SORTS = ["updated_at", "name", "latest_signal_at"] as const

function searchText(c: CompanyRecord): string {
  return [
    c.name, c.shortDescription, c.description, c.city?.name, ...c.sectors.map((s) => s.name), ...c.founders.map((f) => f.name),
    c.tech.primary?.label, ...c.tech.secondary.map((l) => l.label), ...c.tech.terms.flatMap(({ term }) => [term.label, ...term.aliases]),
  ].filter(Boolean).join(" ").toLowerCase()
}

const time = (t: string | null) => (t ? new Date(t).getTime() : null)

export const COMPANY_PARAMS = ["q", "sector", "layer", "layer_scope", "term", "stage", "city", "updated_since", "sort", "limit", "cursor"]

/** Validates the query first (before any database read), then returns the runner. */
export function prepareListCompanies(params: URLSearchParams) {
  rejectUnknown(params, COMPANY_PARAMS)
  const q = searchParam(params)
  const sector = slugList(params, "sector")
  const layer = slugList(params, "layer")
  const layerScope = enumParam(params, "layer_scope", ["primary", "any"] as const, "primary")
  const term = slugList(params, "term")
  const stage = slugList(params, "stage", STAGE_SLUGS)
  const city = slugList(params, "city")
  const updatedSince = dateTimeParam(params, "updated_since")
  const sort = enumParam(params, "sort", COMPANY_SORTS, "updated_at")
  const limit = limitParam(params, { max: 100, fallback: 50 })
  const fingerprint = queryFingerprint(params)
  const after = decodeCursor(params.get("cursor"), fingerprint)

  return (ds: Dataset) => {
    const wantedTerms = term.length ? withDescendants(term, ds.termChildren) : null
    const rows = ds.companies.filter((c) => {
      if (sector.length && !c.sectors.some((s) => sector.includes(s.slug))) return false
      if (layer.length) {
        const layers = [c.tech.primary, ...(layerScope === "any" ? c.tech.secondary : [])].filter(Boolean).map((l) => l!.slug)
        if (!layers.some((l) => layer.includes(l))) return false
      }
      if (wantedTerms && !c.tech.terms.some(({ term: t }) => wantedTerms.has(t.slug))) return false
      if (stage.length && !stage.includes(stageSlug(c))) return false
      if (city.length && !city.some((s) => s === c.city?.slug || s === c.secondaryCity?.slug)) return false
      if (updatedSince != null && (time(c.updatedAt) ?? 0) < updatedSince) return false
      if (q && !searchText(c).includes(q)) return false
      return true
    })

    const keyOf = (c: CompanyRecord): CursorKey =>
      sort === "name" ? [c.name.toLowerCase(), c.id] : sort === "latest_signal_at" ? [time(c.latestSignalAt), c.id] : [time(c.updatedAt), c.id]
    const compareKeys = keyComparator(sort === "name" ? "asc" : "desc")
    rows.sort((a, b) => compareKeys(keyOf(a), keyOf(b)))
    const result = page(rows, { limit, after, keyOf, compareKeys, fingerprint })
    return { object: "list" as const, data: result.data.map(toCompanySummary), next_cursor: result.next_cursor, total: rows.length }
  }
}

export const listCompanies = (ds: Dataset, params: URLSearchParams) => prepareListCompanies(params)(ds)

/** One company by id or slug. Drafts and Navigator-only companies are not in the dataset, so they 404. */
export function getCompany(ds: Dataset, idOrSlug: string) {
  const key = idOrSlug.trim().toLowerCase()
  const c = isUuid(key) ? ds.companies.find((x) => x.id === key) : ds.companies.find((x) => x.slug.toLowerCase() === key)
  if (!c) throw new ApiError("not_found", "No published company with that id or slug")
  return { data: toCompany(c) }
}

export const SIGNAL_PARAMS = ["company_id", "type", "since", "until", "updated_since", "limit", "cursor"]

export function prepareListSignals(params: URLSearchParams) {
  rejectUnknown(params, SIGNAL_PARAMS)
  const companyIds = uuidList(params, "company_id")
  const types = slugList(params, "type", SIGNAL_TYPES)
  const since = dateParam(params, "since")
  const until = dateParam(params, "until")
  const updatedSince = dateTimeParam(params, "updated_since")
  const limit = limitParam(params, { max: 100, fallback: 50 })
  const fingerprint = queryFingerprint(params)
  const after = decodeCursor(params.get("cursor"), fingerprint)

  return (ds: Dataset) => {
    const byId = new Map(ds.companies.map((c) => [c.id, c]))
    const rows = ds.signals.filter(
      (s) =>
        byId.has(s.companyId) &&
        (!companyIds.length || companyIds.includes(s.companyId)) &&
        (!types.length || types.includes(s.type)) &&
        (!since || (s.date ?? "") >= since) &&
        (!until || (s.date ?? "9999") <= until) &&
      (updatedSince == null || Math.max(Date.parse(s.updatedAt), Date.parse(s.createdAt)) >= updatedSince),
    )
    const keyOf = (s: SignalRecord): CursorKey => [s.date, s.id]
    const compareKeys = keyComparator("desc")
    rows.sort((a, b) => compareKeys(keyOf(a), keyOf(b)))
    const result = page(rows, { limit, after, keyOf, compareKeys, fingerprint })
    return { object: "list" as const, data: result.data.map((s) => toSignal(s, byId.get(s.companyId)!)), next_cursor: result.next_cursor, total: rows.length }
  }
}

export const listSignals = (ds: Dataset, params: URLSearchParams) => prepareListSignals(params)(ds)

/** Values every filter accepts. Sectors and cities are those used by published companies. */
export function taxonomy(ds: Dataset, params: URLSearchParams) {
  rejectUnknown(params, [])
  const count = <K extends string>(keys: K[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<K, number>())
  const sectorCounts = count(ds.companies.flatMap((c) => c.sectors.map((s) => s.slug)))
  const sectors = new Map(ds.companies.flatMap((c) => c.sectors.map((s) => [s.slug, s.name] as const)))
  const cities = new Map<string, string>()
  for (const c of ds.companies) for (const p of [c.city, c.secondaryCity]) if (p?.slug) cities.set(p.slug, p.name)
  return {
    data: {
      sectors: [...sectors].map(([slug, name]) => ({ slug, name, companies: sectorCounts.get(slug) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name)),
      technical_layers: ds.layers.filter((l) => l.isActive).map((l) => ({ slug: l.slug, label: l.label, description: l.description })),
      technical_terms: ds.terms.filter((t) => t.isActive).map((t) => ({ slug: t.slug, label: t.label, facet: t.facet, family: t.family, parent: t.parentSlug, definition: t.definition, aliases: t.aliases })),
      stages: STAGES.map((s) => ({ slug: s.slug, label: s.label })),
      signal_types: SIGNAL_TYPES.map((slug) => ({ slug, label: SIGNAL_TYPE_LABELS[slug] })),
      cities: [...cities].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  }
}
