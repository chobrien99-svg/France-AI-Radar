// OpenAPI 3.1 contract for the Enterprise API, served at /v1/openapi.json.
// tests/enterprise-api.test.mjs checks that every documented field matches
// what the serializers return, so this file and the code can't drift apart.

const str = { type: "string" }
const nstr = { type: ["string", "null"] }
const nuri = { type: ["string", "null"], format: "uri" }
const ndt = { type: ["string", "null"], format: "date-time" }
const ndate = { type: ["string", "null"], format: "date" }
const nint = { type: ["integer", "null"] }
const uuid = { type: "string", format: "uuid" }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const obj = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties, ...extra })
const list = (item: string) => obj({ object: { const: "list" }, data: { type: "array", items: ref(item) }, next_cursor: nstr, total: { type: "integer" } })
const q = (name: string, description: string, schema: Record<string, unknown> = str) => ({ name, in: "query", required: false, description, schema })
const errors = {
  "400": { description: "invalid_parameter", content: { "application/json": { schema: ref("Error") } } },
  "401": { description: "unauthorized: missing or invalid API key", content: { "application/json": { schema: ref("Error") } } },
  "429": { description: "rate_limited: wait for Retry-After seconds", content: { "application/json": { schema: ref("Error") } } },
  "500": { description: "internal", content: { "application/json": { schema: ref("Error") } } },
}
const ok = (schema: string, description: string) => ({ "200": { description, content: { "application/json": { schema: ref(schema) } } }, ...errors })
const pageParams = (max: number) => [
  q("limit", `Page size, 1–${max}. Default 50.`, { type: "integer", minimum: 1, maximum: max, default: 50 }),
  q("cursor", "Opaque cursor from next_cursor. Repeat the same filters and sort when you pass it."),
]

const CompanyRef = obj({ id: uuid, slug: str, name: str, url: { type: "string", format: "uri", description: "Canonical franceairadar.com profile" } })

const summaryProps = {
  object: { const: "company" },
  id: { ...uuid, description: "Stable. Never reused." },
  slug: { ...str, description: "Can change; store the id" },
  name: str,
  url: { type: "string", format: "uri", description: "Canonical franceairadar.com profile" },
  short_description: nstr,
  website: nuri,
  logo_url: nuri,
  country: nstr,
  city: nstr,
  stage: { type: "string", enum: ["pre_seed", "seed", "series_a", "series_b_plus", "grant", "other", "undisclosed"] },
  is_stealth: { type: "boolean" },
  publication_status: { const: "published" },
  latest_signal_at: ndt,
  updated_at: { type: "string", format: "date-time", description: "UTC. Last change to anything in the public record (company, rounds, investors, founders, sectors, technology, programmes, signals). Removals are reported by the change feed (next stage)." },
}

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "France AI Radar Enterprise API",
    version: "1.0.0-pilot",
    description:
      "Read-only access to companies published on France AI Radar, their founders, technology classification, funding and editor-approved signals. " +
      "All timestamps are UTC (ISO 8601). Amounts are in whole euros. Lists are sorted with a stable tiebreak on id and paginated with opaque cursors. " +
      "Drafts, Navigator-only companies, editor notes, legal identifiers and contact details are never returned. " +
      "The change feed for incremental sync (/v1/changes, /v1/snapshot) arrives in the next stage.",
  },
  servers: [{ url: "https://www.franceairadar.com/v1" }],
  security: [{ apiKey: [] }],
  paths: {
    "/companies": {
      get: {
        operationId: "listCompanies",
        summary: "Published companies",
        parameters: [
          q("q", "Search name, description, sector, city, founders and technology terms (aliases included)"),
          q("sector", "Sector slugs, comma-separated (any matches). See /taxonomy."),
          q("layer", "Technical layer slugs (any matches). Primary layer only unless layer_scope=any."),
          q("layer_scope", "primary (default) or any (primary or secondary)", { type: "string", enum: ["primary", "any"] }),
          q("term", "Technical term slugs from any facet (any matches). Broader terms include narrower ones."),
          q("stage", "Stage slugs (any matches)", { type: "string" }),
          q("city", "City slugs (any matches), main or second city"),
          q("updated_since", "Only companies whose public record (including rounds, founders, sectors, technology, programmes or signals) changed at or after this time, e.g. 2026-11-01T00:00:00Z", { type: "string", format: "date-time" }),
          q("sort", "updated_at (newest first, default), name (A–Z) or latest_signal_at (newest first)", { type: "string", enum: ["updated_at", "name", "latest_signal_at"] }),
          ...pageParams(100),
        ],
        responses: ok("CompanyList", "A page of company summaries"),
      },
    },
    "/companies/{id}": {
      get: {
        operationId: "getCompany",
        summary: "One published company by id or slug",
        parameters: [{ name: "id", in: "path", required: true, description: "Company id (UUID) or slug", schema: str }],
        responses: { ...ok("CompanyResponse", "The full public profile"), "404": { description: "not_found: no published company with that id or slug", content: { "application/json": { schema: ref("Error") } } } },
      },
    },
    "/signals": {
      get: {
        operationId: "listSignals",
        summary: "Editor-approved signals on published companies, newest first",
        parameters: [
          q("company_id", "Company ids, comma-separated"),
          q("type", "Signal type slugs (any matches). See /taxonomy."),
          q("since", "Signal date on or after (YYYY-MM-DD)", { type: "string", format: "date" }),
          q("until", "Signal date on or before (YYYY-MM-DD)", { type: "string", format: "date" }),
          q("updated_since", "Only signals added or edited at or after this time, whatever their signal date. Use this to poll for new signals.", { type: "string", format: "date-time" }),
          ...pageParams(100),
        ],
        responses: ok("SignalList", "A page of signals"),
      },
    },
    "/taxonomy": {
      get: { operationId: "getTaxonomy", summary: "Values accepted by the filters", parameters: [], responses: ok("TaxonomyResponse", "Sectors, technical layers and terms, stages, signal types, cities") },
    },
    "/openapi.json": {
      get: { operationId: "getOpenApi", summary: "This document", parameters: [], responses: { "200": { description: "OpenAPI 3.1 document" }, ...errors } },
    },
  },
  components: {
    securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "Your key, sent as Authorization: Bearer far_live_…" } },
    schemas: {
      CompanyRef,
      CompanySummary: obj({ ...summaryProps, sectors: { type: "array", items: str, description: "Sector slugs, primary first" }, primary_layer: nstr }),
      Company: obj({
        ...summaryProps,
        description: nstr,
        linkedin_url: nuri,
        twitter_url: nuri,
        secondary_city: nstr,
        founded_year: nint,
        employee_range: nstr,
        total_raised_eur: { ...nint, description: "Sum of the disclosed amounts of the published funding_rounds, in euros; null when none is disclosed" },
        signal_count: { type: "integer" },
        first_seen_at: { ...ndt, description: "When France AI Radar first detected the company" },
        sectors: { type: "array", items: obj({ slug: str, name: str, primary: { type: "boolean" } }) },
        technology: obj({
          primary_layer: { anyOf: [obj({ slug: str, label: str }), { type: "null" }] },
          secondary_layers: { type: "array", items: obj({ slug: str, label: str }) },
          terms: { type: "array", items: obj({ slug: str, label: str, facet: { type: "string", enum: ["specialization", "method", "modality", "domain"] }, relationship: { type: "string", enum: ["develops", "uses", "researches"] } }) },
        }),
        founders: { type: "array", items: obj({ id: uuid, name: str, role: nstr, linkedin_url: nuri, short_bio: nstr, url: nuri }) },
        funding_rounds: {
          type: "array",
          description: "Published rounds from The French Tech Journal's own funding data, newest first",
          items: obj({
            id: uuid,
            stage: nstr,
            amount_eur: { ...nint, description: "Euros; null when undisclosed" },
            amount_original: { type: ["number", "null"] },
            currency_original: nstr,
            is_estimated: { type: "boolean" },
            announced_date: ndate,
            closed_date: ndate,
            investors: { type: "array", items: obj({ name: str, lead: { type: "boolean" } }) },
            sources: { type: "array", items: obj({ name: nstr, url: { type: "string", format: "uri" } }) },
          }),
        },
        programs: { type: "array", items: obj({ program: str, edition: nstr, year: nint, role: nstr }) },
      }),
      Signal: obj({
        object: { const: "signal" },
        id: uuid,
        company: ref("CompanyRef"),
        type: str,
        type_label: str,
        date: ndate,
        title: str,
        description: nstr,
        strength: { ...nint, description: "1 (weak) to 5 (strong)" },
        source: obj({ name: nstr, url: nuri }),
        publication_status: { const: "approved", description: "An editor approved the signal for publication" },
        verification_status: { type: "string", enum: ["verified", "pending", "unverified", "disputed"], description: "Evidence status, separate from approval" },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      }),
      CompanyList: list("CompanySummary"),
      SignalList: list("Signal"),
      CompanyResponse: obj({ data: ref("Company") }),
      TaxonomyResponse: obj({
        data: obj({
          sectors: { type: "array", items: obj({ slug: str, name: str, companies: { type: "integer" } }) },
          technical_layers: { type: "array", items: obj({ slug: str, label: str, description: nstr }) },
          technical_terms: { type: "array", items: obj({ slug: str, label: str, facet: str, family: nstr, parent: nstr, definition: nstr, aliases: { type: "array", items: str } }) },
          stages: { type: "array", items: obj({ slug: str, label: str }) },
          signal_types: { type: "array", items: obj({ slug: str, label: str }) },
          cities: { type: "array", items: obj({ slug: str, name: str }) },
        }),
      }),
      Error: obj({
        error: obj({
          code: { type: "string", enum: ["invalid_parameter", "unauthorized", "forbidden_scope", "not_found", "gone", "rate_limited", "internal"] },
          message: str,
          request_id: str,
        }),
      }),
    },
  },
}
