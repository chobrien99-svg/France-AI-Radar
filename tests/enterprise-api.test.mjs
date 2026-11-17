// Enterprise API (/v1): field policy, filters, pagination, keys and the
// OpenAPI contract, on an in-memory dataset. Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { listCompanies, getCompany, listSignals, taxonomy, COMPANY_PARAMS } from "../lib/api/query.ts"
import { toCompany, toCompanySummary, isVendorUrl } from "../lib/api/serialize.ts"
import { OPENAPI } from "../lib/api/openapi.ts"
import { authenticate, bearerToken, hashKey, parseKeyConfig } from "../lib/api/keys.ts"
import { ApiError } from "../lib/api/errors.ts"
import { childrenIndex } from "../lib/taxonomy.ts"

// ---- fixture ----
const layer = (slug) => ({ id: `l-${slug}`, slug, label: slug.replace(/_/g, " "), description: null, isActive: true })
const term = (slug, facet, parentSlug = null) => ({ id: `t-${slug}`, slug, label: slug, definition: null, facet, family: null, parentSlug, isActive: true, aliases: slug === "coding_agents" ? ["agentic coding"] : [] })
const layers = [layer("foundation_models"), layer("ai_native_applications")]
const terms = [term("ai_agents", "specialization"), term("coding_agents", "specialization", "ai_agents"), term("healthcare", "domain")]
const T = Object.fromEntries(terms.map((t) => [t.slug, t]))
const paris = { name: "Paris", slug: "paris", region: "Île-de-France" }
const lyon = { name: "Lyon", slug: "lyon", region: "Auvergne-Rhône-Alpes" }

const company = (n, over = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  slug: `co-${n}`,
  name: `Company ${n}`,
  shortDescription: `One-liner ${n}`,
  description: `Longer description ${n}`,
  website: "https://example.com",
  linkedinUrl: "https://linkedin.com/company/x",
  twitterUrl: null,
  logoUrl: "javascript:alert(1)",
  country: "France",
  city: paris,
  secondaryCity: null,
  foundedYear: 2025,
  isStealth: false,
  employeeRange: "1-10",
  lastRound: "Seed – €2M",
  totalRaisedEurMillions: 2,
  signalCount: 0,
  latestSignalAt: null,
  firstSeenAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: `2026-11-0${n}T10:00:00Z`,
  sectors: [{ slug: "artificial-intelligence", name: "Artificial Intelligence", isPrimary: true }],
  tech: { primary: layers[1], secondary: [], terms: [] },
  founders: [{ id: `p-${n}`, name: `Founder ${n}`, slug: `founder-${n}`, role: "CEO", linkedinUrl: "https://linkedin.com/in/f", shortBio: null }],
  rounds: [{
    id: `r-${n}`, stage: "seed", amountEurMillions: 2.5, amountOriginal: null, currencyOriginal: null, announcedDate: "2026-06-01", closedDate: null, isEstimated: false,
    sourceName: "Les Echos", sourceUrl: "https://lesechos.fr/x", pressReleaseUrl: null, ftjUrl: "https://www.frenchtechjournal.com/x", investors: [{ name: "Fund A", isLead: true }],
  }],
  programs: [{ program: "Station F Future 40", programSlug: "station-f-future-40", edition: "Future 40 — 2026", editionSlug: "future-40-2026", year: 2026, role: "selected company" }],
  aliases: [],
  ...over,
})

const companies = [
  company(1, { tech: { primary: layers[0], secondary: [layers[1]], terms: [{ term: T.coding_agents, kind: "develops" }] } }),
  company(2, { city: lyon, lastRound: "Series A", name: "Alpha" }),
  company(3, { lastRound: null, tech: { primary: layers[1], secondary: [], terms: [{ term: T.healthcare, kind: "uses" }] } }),
  company(4, { name: "Zeta" }),
  company(5),
]
const signal = (n, companyIdx, date, type = "fundraising") => ({
  id: `00000000-0000-4000-9000-00000000000${n}`, companyId: companies[companyIdx].id, type, date, title: `Signal ${n}`, description: null, strength: 3,
  sourceName: "Pappers", sourceUrl: "https://pappers.fr/x", verificationStatus: "unverified", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
})
const ds = {
  companies,
  signals: [signal(1, 0, "2026-10-01"), signal(2, 1, "2026-11-01", "award"), signal(3, 0, "2026-09-01"), { ...signal(4, 0, "2026-08-01"), companyId: "not-published" }],
  layers,
  terms,
  termChildren: childrenIndex(terms),
  loadedAt: Date.now(),
}
const P = (s = "") => new URLSearchParams(s)

// ---- a minimal JSON-schema check against the OpenAPI components ----
function check(value, schema, path = "$") {
  if (schema.$ref) return check(value, OPENAPI.components.schemas[schema.$ref.split("/").pop()], path)
  if (schema.anyOf) {
    const errs = schema.anyOf.map((s) => { try { check(value, s, path); return null } catch (e) { return e } })
    if (errs.every(Boolean)) throw errs[0]
    return
  }
  if ("const" in schema) return assert.equal(value, schema.const, path)
  const types = [schema.type ?? []].flat()
  const typeOf = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value
  if (types.length) assert.ok(types.includes(typeOf) || (typeOf === "integer" && types.includes("number")), `${path}: ${typeOf} not in ${types}`)
  if (schema.enum && value !== null) assert.ok(schema.enum.includes(value), `${path}: ${value} not in enum`)
  if (typeOf === "array" && schema.items) value.forEach((v, i) => check(v, schema.items, `${path}[${i}]`))
  if (typeOf === "object" && schema.properties) {
    assert.deepEqual(Object.keys(value).sort(), Object.keys(schema.properties).sort(), `${path}: keys differ from the contract`)
    for (const [k, s] of Object.entries(schema.properties)) check(value[k], s, `${path}.${k}`)
  }
}

const FORBIDDEN = /siren|siret|email|phone|note|legacy|thesis|brief|confidence|candidate|verification_status_internal/i
function keysDeep(v, out = []) {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out))
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); keysDeep(x, out) }
  return out
}

// ---- tests ----
test("company outputs match the OpenAPI contract exactly and carry no internal fields", () => {
  for (const c of companies) {
    check(toCompany(c), { $ref: "#/components/schemas/Company" })
    check(toCompanySummary(c), { $ref: "#/components/schemas/CompanySummary" })
    assert.ok(!keysDeep(toCompany(c)).some((k) => FORBIDDEN.test(k)))
  }
  check(listCompanies(ds, P()), { $ref: "#/components/schemas/CompanyList" })
  check(listSignals(ds, P()), { $ref: "#/components/schemas/SignalList" })
  check(taxonomy(ds, P()), { $ref: "#/components/schemas/TaxonomyResponse" })
})

test("amounts are whole euros, unsafe links are dropped, rounds are FTJ-compiled with references", () => {
  const c = toCompany(companies[0])
  assert.equal(c.total_raised_eur, 2_000_000)
  assert.equal(c.funding_rounds[0].amount_eur, 2_500_000)
  assert.equal(c.logo_url, null)
  assert.equal(c.url, "https://www.franceairadar.com/startup/co-1")
  assert.equal(c.funding_rounds[0].compiled_by, "The French Tech Journal")
  assert.deepEqual(c.funding_rounds[0].references, [
    { label: "The French Tech Journal", url: "https://www.frenchtechjournal.com/x" },
    { label: "lesechos.fr", url: "https://lesechos.fr/x" },
  ])
  // Internal labels never appear; data-vendor links are dropped
  const vendor = toCompany({ ...companies[0], rounds: [{ ...companies[0].rounds[0], ftjUrl: null, sourceName: "Valmy_def_tech.docx", sourceUrl: "https://pitchbook.com/profiles/company/1" }] })
  assert.deepEqual(vendor.funding_rounds[0].references, [])
  assert.ok(!JSON.stringify(vendor).includes("Valmy_def_tech") && !JSON.stringify(vendor).toLowerCase().includes("pitchbook"))
  assert.equal(isVendorUrl("https://app.dealroom.co/companies/x"), true)
  assert.equal(isVendorUrl("https://www.crunchbase.com/organization/x"), true)
  assert.equal(isVendorUrl("https://www.pappers.fr/entreprise/x"), false)
  assert.equal(c.stage, "seed")
  assert.equal(toCompany(companies[1]).stage, "series_a")
  assert.equal(toCompany(companies[2]).stage, "seed", "no last-round text: falls back to the latest round")
  assert.equal(toCompany({ ...companies[2], rounds: [] }).stage, "undisclosed")
  assert.equal(toCompany({ ...companies[2], lastRound: "—" }).stage, "seed", "a placeholder last round also falls back")
  assert.equal(toCompany({ ...companies[2], rounds: [{ ...companies[2].rounds[0], stage: "series_c" }] }).stage, "series_b_plus")
})

test("filters: sector, stage, city, layer scope, umbrella terms, search, updated_since", () => {
  const ids = (s) => listCompanies(ds, P(s)).data.map((c) => c.slug)
  assert.deepEqual(ids("stage=series_a"), ["co-2"])
  assert.deepEqual(ids("city=lyon"), ["co-2"])
  assert.deepEqual(ids("layer=foundation_models"), ["co-1"])
  assert.equal(ids("layer=ai_native_applications").length, 4)
  assert.equal(ids("layer=ai_native_applications&layer_scope=any").length, 5)
  assert.deepEqual(ids("term=ai_agents"), ["co-1"], "a broader term matches narrower ones")
  assert.deepEqual(ids("q=agentic"), ["co-1"], "search covers term aliases")
  assert.deepEqual(ids("term=healthcare"), ["co-3"])
  assert.deepEqual(ids("updated_since=2026-11-04T00:00:00Z"), ["co-5", "co-4"])
  assert.equal(ids("sector=artificial-intelligence").length, 5)
})

test("bad input is rejected with invalid_parameter", () => {
  for (const s of ["sectr=x", "limit=0", "limit=101", "limit=abc", "stage=series_z", "updated_since=yesterday", "sort=random", "sector=Bad Slug", "cursor=nope"]) {
    assert.throws(() => listCompanies(ds, P(s)), (e) => e instanceof ApiError && e.code === "invalid_parameter", s)
  }
  assert.throws(() => listSignals(ds, P("company_id=abc")), (e) => e.code === "invalid_parameter")
  assert.throws(() => listSignals(ds, P("since=2026-13-45")), (e) => e.code === "invalid_parameter")
  assert.throws(() => taxonomy(ds, P("x=1")), (e) => e.code === "invalid_parameter")
  assert.ok(COMPANY_PARAMS.includes("cursor"))
})

test("pagination visits every company once, in order, and cursors are tied to their query", () => {
  for (const sort of ["updated_at", "name", "latest_signal_at"]) {
    const seen = []
    let cursor = null
    do {
      const r = listCompanies(ds, P(`sort=${sort}&limit=2${cursor ? `&cursor=${cursor}` : ""}`))
      seen.push(...r.data.map((c) => c.id))
      cursor = r.next_cursor
    } while (cursor)
    assert.equal(seen.length, companies.length, sort)
    assert.equal(new Set(seen).size, companies.length, sort)
  }
  assert.deepEqual(listCompanies(ds, P("sort=name")).data.map((c) => c.name).slice(0, 2), ["Alpha", "Company 1"])
  const first = listCompanies(ds, P("sort=name&limit=2"))
  assert.throws(() => listCompanies(ds, P(`sort=updated_at&limit=2&cursor=${first.next_cursor}`)), (e) => e.code === "invalid_parameter")
  // A different page size may reuse the cursor
  assert.equal(listCompanies(ds, P(`sort=name&limit=3&cursor=${first.next_cursor}`)).data.length, 3)
})

test("company lookup by id or slug; anything unpublished is not found", () => {
  assert.equal(getCompany(ds, companies[1].id).data.slug, "co-2")
  assert.equal(getCompany(ds, "CO-2").data.id, companies[1].id)
  assert.throws(() => getCompany(ds, "a-draft-company"), (e) => e.code === "not_found")
  assert.throws(() => getCompany(ds, "00000000-0000-4000-8000-000000000099"), (e) => e.code === "not_found")
})

test("signals: only published companies, newest first, filtered by company, type and date", () => {
  const all = listSignals(ds, P())
  assert.deepEqual(all.data.map((s) => s.title), ["Signal 2", "Signal 1", "Signal 3"])
  assert.equal(all.data[0].company.slug, "co-2")
  assert.equal(all.data[0].publication_status, "approved")
  assert.equal(listSignals(ds, P(`company_id=${companies[0].id}`)).total, 2)
  assert.equal(listSignals(ds, P("type=award")).total, 1)
  assert.equal(listSignals(ds, P("since=2026-09-15&until=2026-10-31")).total, 1)
  // A signal approved today about an older date is found by updated_since, not by since
  const backfilled = { ...ds, signals: [...ds.signals, { ...signal(5, 2, "2026-01-15"), title: "Backfilled", createdAt: "2026-11-07T09:00:00Z", updatedAt: "2026-11-07T09:00:00Z" }] }
  assert.deepEqual(listSignals(backfilled, P("updated_since=2026-11-05T00:00:00Z")).data.map((s) => s.title), ["Backfilled"])
  assert.equal(listSignals(backfilled, P("since=2026-11-05")).total, 0)
  const p1 = listSignals(ds, P("limit=2"))
  assert.equal(listSignals(ds, P(`limit=2&cursor=${p1.next_cursor}`)).data[0].title, "Signal 3")
})

test("API keys: hashed config, bearer parsing, wrong or malformed keys refused", () => {
  const key = "far_live_abc123"
  const keys = parseKeyConfig(` acme:${hashKey(key)} , broken, other:${"0".repeat(64)}`)
  assert.equal(keys.length, 2)
  assert.equal(authenticate(bearerToken(`Bearer ${key}`), keys), "acme")
  assert.equal(authenticate(bearerToken("Bearer far_live_wrong"), keys), null)
  assert.equal(authenticate(bearerToken(`Basic ${key}`), keys), null)
  assert.equal(authenticate("sk_" + key, keys), null)
  assert.equal(authenticate(null, keys), null)
  assert.deepEqual(parseKeyConfig(undefined), [])
})

test("the contract documents every route and parameter the code accepts", () => {
  assert.deepEqual(Object.keys(OPENAPI.paths).sort(), ["/changes", "/companies", "/companies/{id}", "/openapi.json", "/signals", "/signals/{id}", "/snapshot", "/taxonomy"])
  const documented = OPENAPI.paths["/companies"].get.parameters.map((p) => p.name).sort()
  assert.deepEqual(documented, [...COMPANY_PARAMS].sort())
})

// ---- change feed (Stage 2) ----
import { trackedRecords, stableStringify, encodeSeqCursor, decodeSeqCursor, toChange, parseChangesQuery, CHANGES_PARAMS } from "../lib/api/changes.ts"
import { getSignal } from "../lib/api/query.ts"

test("tracked records hash what customers see, minus fields that move without a real change", () => {
  const recs = trackedRecords(ds)
  assert.equal(recs.filter((r) => r.entity_type === "company").length, companies.length)
  assert.equal(recs.filter((r) => r.entity_type === "signal").length, 3, "signals of unpublished companies are not tracked")
  for (const r of recs) assert.ok(!("updated_at" in r.record), "updated_at is not tracked")
  assert.equal(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] }), stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }))

  const hashOf = (d, type, id) => trackedRecords(d).find((r) => r.entity_type === type && r.entity_id === id).hash
  const c0 = companies[0]
  // Touching updated_at alone changes nothing
  const touched = { ...ds, companies: ds.companies.map((c) => (c.id === c0.id ? { ...c, updatedAt: "2027-01-01T00:00:00Z" } : c)) }
  assert.equal(hashOf(touched, "company", c0.id), hashOf(ds, "company", c0.id))
  // A real change does
  const moved = { ...ds, companies: ds.companies.map((c) => (c.id === c0.id ? { ...c, city: lyon } : c)) }
  assert.notEqual(hashOf(moved, "company", c0.id), hashOf(ds, "company", c0.id))
  // Renaming a company does not re-announce its signals
  const renamed = { ...ds, companies: ds.companies.map((c) => (c.id === c0.id ? { ...c, name: "Renamed" } : c)) }
  assert.equal(hashOf(renamed, "signal", ds.signals[0].id), hashOf(ds, "signal", ds.signals[0].id))
})

test("change cursors round-trip and bad ones are rejected", () => {
  assert.equal(decodeSeqCursor(encodeSeqCursor(42)), 42)
  assert.equal(decodeSeqCursor(null), null)
  for (const bad of ["nope", encodeSeqCursor(-1), Buffer.from('{"v":2,"seq":1}').toString("base64url")]) {
    assert.throws(() => decodeSeqCursor(bad), (e) => e.code === "invalid_parameter", bad)
  }
  assert.deepEqual(parseChangesQuery(P(`cursor=${encodeSeqCursor(7)}&limit=10`)), { after: 7, limit: 10 })
  assert.throws(() => parseChangesQuery(P("limit=501")), (e) => e.code === "invalid_parameter")
  assert.throws(() => parseChangesQuery(P("since=2026-01-01")), (e) => e.code === "invalid_parameter")
})

test("change events: href only for live records; withdrawn and deleted carry ids only", () => {
  const base = { seq: 5, event_id: "e", entity_id: companies[0].id, record_version: 2, changed_fields: null, merged_into: null, occurred_at: "2026-11-17T10:00:00Z" }
  const upd = toChange({ ...base, entity_type: "company", event_type: "updated", changed_fields: ["city"] })
  check(upd, { $ref: "#/components/schemas/Change" })
  assert.equal(upd.href, `/v1/companies/${companies[0].id}`)
  assert.equal(decodeSeqCursor(upd.cursor), 5)
  const sig = toChange({ ...base, entity_type: "signal", event_type: "created" })
  assert.equal(sig.href, `/v1/signals/${companies[0].id}`)
  for (const t of ["withdrawn", "deleted", "merged"]) {
    const e = toChange({ ...base, entity_type: "company", event_type: t, merged_into: t === "merged" ? companies[1].id : null })
    check(e, { $ref: "#/components/schemas/Change" })
    assert.equal(e.href, null)
    assert.deepEqual(e.changed_fields, [])
  }
})

test("merged ids resolve to the surviving company; signals have their own endpoint", () => {
  const merged = { ...ds, companies: ds.companies.map((c, i) => (i === 0 ? { ...c, aliases: ["00000000-0000-4000-8000-0000000000aa"] } : c)) }
  assert.equal(getCompany(merged, "00000000-0000-4000-8000-0000000000aa").data.id, companies[0].id)
  assert.deepEqual(getCompany(merged, companies[0].id).data.aliases, ["00000000-0000-4000-8000-0000000000aa"])
  assert.equal(getSignal(ds, ds.signals[0].id).data.title, "Signal 1")
  assert.throws(() => getSignal(ds, ds.signals[3].id), (e) => e.code === "not_found", "a signal on an unpublished company is not found")
  check(getSignal(ds, ds.signals[0].id), { $ref: "#/components/schemas/SignalResponse" })
})

test("the contract documents the change feed and its parameters", () => {
  for (const p of ["/changes", "/snapshot", "/signals/{id}"]) assert.ok(OPENAPI.paths[p], p)
  assert.deepEqual(OPENAPI.paths["/changes"].get.parameters.map((p) => p.name).sort(), [...CHANGES_PARAMS].sort())
})
