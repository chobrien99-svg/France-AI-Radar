// The import's database writes (lib/startup-import-server.ts) against an in-memory client.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { validateDraft } from "../lib/startup-import.ts"
import { writeDraft, checkExisting, updateFromDraft } from "../lib/startup-import-server.ts"
import { vocabFromMigrations } from "./vocab-from-migrations.mjs"
import { fakeSupabase } from "./fake-supabase.mjs"

const vocab = vocabFromMigrations()
const example = JSON.parse(readFileSync(new URL("./fixtures/startup-draft.example.json", import.meta.url), "utf8"))
const draft = validateDraft(example, vocab).draft
const seed = { product_catalog: [{ id: "radar", slug: "ai-radar" }], cities: [{ id: "city-lyon", name: "Lyon", slug: "lyon" }] }

test("creates the startup as a Draft with every section linked", async () => {
  const { client, tables } = fakeSupabase(seed)
  const res = await writeDraft(client, draft, {})
  assert.equal(res.ok, true)
  const [org] = tables.organizations
  assert.equal(org.status, "draft")
  assert.equal(org.organization_type, "startup")
  assert.equal(org.city_id, "city-lyon")
  assert.equal(org.signal_count, 1)
  assert.equal(org.last_signal_date, "2026-01-20")
  assert.equal(tables.product_organizations[0].product_id, "radar")
  assert.equal(tables.organization_profiles[0].technology_positioning, "research_commercialization")
  assert.equal(tables.organization_profiles[0].investor_brief.startsWith("Exemple"), true)
  assert.equal(tables.organization_technical_layers.length, 1)
  assert.equal(tables.organization_technical_layers[0].is_primary, true)
  assert.equal(tables.organization_technical_terms.length, 8)
  assert.equal(tables.organization_technology_claims.length, 2)
  assert.equal(tables.organization_sectors.length, 2)
  assert.equal(tables.people[0].slug, "camille-exemple")
  assert.equal(tables.organization_people[0].is_founder, true)
  assert.equal(tables.funding_rounds[0].amount_eur, 1.5, "funding amounts are stored in millions")
  assert.equal(tables.grants[0].amount_eur, 30000)
  assert.equal(tables.program_organizations.length, 1)
  assert.equal(tables.legal_entities[0].naf_code, "72.11Z")
  // No helper-only fields leak into the database rows
  for (const r of tables.organization_technical_terms) assert.deepEqual(Object.keys(r).sort(), ["evidence_status", "id", "is_core", "organization_id", "relationship_kind", "source_note", "source_url", "term_id"])
})

test("a failure part-way undoes everything the import created", async () => {
  const { client, tables } = fakeSupabase(seed, { failOn: "legal_entities" })
  const res = await writeDraft(client, draft, {})
  assert.equal(res.ok, false)
  assert.match(res.error, /legal_entities.*Nothing was saved/)
  assert.equal(tables.organizations.length, 0, "the organization is deleted (its links cascade in Postgres)")
  assert.equal(tables.people.length, 0, "founder profiles created by the import are removed")
})

test("an existing founder matched by LinkedIn is linked, not recreated or removed on failure", async () => {
  const people = [{ id: "p-1", slug: "camille", full_name: "Camille Exemple", linkedin_url: "https://www.linkedin.com/in/example" }]
  const { client, tables } = fakeSupabase({ ...seed, people })
  const check = await checkExisting(client, draft)
  assert.deepEqual(check.founderMatches, { 0: { id: "p-1", slug: "camille" } })
  const failing = fakeSupabase({ ...seed, people }, { failOn: "grants" })
  await writeDraft(failing.client, draft, check.founderMatches)
  assert.equal(failing.tables.people.length, 1, "the pre-existing profile survives a rollback")
  const res = await writeDraft(client, draft, check.founderMatches)
  assert.equal(res.ok, true)
  assert.equal(tables.people.length, 1)
  assert.equal(tables.organization_people[0].person_id, "p-1")
})

test("duplicate checks: taken slug blocks, same name / domain / SIREN warn", async () => {
  const organizations = [{ id: "o-1", name: "Exemple Biosystèmes", slug: "exemple-biosystemes", website: "https://example.com" }]
  const { client } = fakeSupabase({ ...seed, organizations, legal_entities: [] })
  const check = await checkExisting(client, draft)
  assert.deepEqual(check.errors.map((e) => e.path), ["company.slug"])

  const other = fakeSupabase({ ...seed, organizations: [{ id: "o-2", name: "exemple biosystèmes", slug: "other", website: "http://www.example.com/fr" }] })
  const w = await checkExisting(other.client, draft)
  assert.deepEqual(w.errors, [])
  assert.deepEqual(w.warnings.map((x) => x.path).sort(), ["company.name", "company.website"])
})

// ---------------------------------------------------------------- update an existing record

function thinNavigatorRecord() {
  // A sparse company from the Navigator, already holding one of the draft's rounds and its founder
  return fakeSupabase({
    ...seed,
    organizations: [{ id: "o-1", name: "Exemple Biosystèmes", slug: "exemple-biosystemes", status: "active", website: "https://old.example.org", description: null, founded_date: null, city_id: null }],
    organization_profiles: [{ organization_id: "o-1", product_description: "Kept as is", investor_brief: null }],
    people: [{ id: "p-1", slug: "camille-exemple", full_name: "camille exemple" }],
    organization_people: [{ organization_id: "o-1", person_id: "p-1", is_founder: true, people: { id: "p-1", slug: "camille-exemple", full_name: "camille exemple" } }],
    funding_rounds: [{ organization_id: "o-1", stage: draft.fundingRounds[0].stage, announced_date: draft.fundingRounds[0].announced_date, amount_eur: 2 }],
    legal_entities: [{ organization_id: "o-1", ...draft.legalEntities[0] }],
    product_organizations: [],
  })
}

test("the check offers to update the record with the same slug, and in update mode the slug is no conflict", async () => {
  const { client } = thinNavigatorRecord()
  const check = await checkExisting(client, draft)
  assert.deepEqual(check.errors.map((e) => e.path), ["company.slug"])
  assert.deepEqual(check.existing, { id: "o-1", name: "Exemple Biosystèmes", slug: "exemple-biosystemes" })

  const update = await checkExisting(client, draft, "o-1")
  assert.deepEqual(update.errors, [])
  assert.deepEqual(update.founderMatches, { 0: { id: "p-1", slug: "camille-exemple" } }, "the founder already on the company is the same person")
})

test("updating fills only empty fields, joins the Radar, adds what is missing, and is safe to run twice", async () => {
  const { client, tables } = thinNavigatorRecord()
  const check = await checkExisting(client, draft, "o-1")
  const res = await updateFromDraft(client, draft, "o-1", check.founderMatches)
  assert.equal(res.ok, true)

  const org = tables.organizations[0]
  assert.equal(org.website, "https://old.example.org", "a value already there is never overwritten")
  assert.equal(org.status, "active", "the status is kept")
  assert.equal(org.description, draft.organization.description, "an empty field is filled")
  assert.equal(org.city_id, "city-lyon")
  assert.equal(org.signal_count, 1)
  assert.equal(tables.organization_profiles[0].product_description, "Kept as is")
  assert.equal(tables.organization_profiles[0].investor_brief, draft.profile.investor_brief)
  assert.deepEqual(tables.product_organizations.map((r) => r.organization_id), ["o-1"], "it joins the Radar")

  assert.equal(tables.funding_rounds.length, 1, "the round already recorded isn't duplicated")
  assert.equal(tables.funding_rounds[0].amount_eur, 2, "and keeps its own amount")
  assert.equal(tables.legal_entities.length, 1)
  assert.equal(tables.people.length, 1, "no second profile for the same founder")
  assert.equal(tables.organization_people.length, 1)
  assert.equal(tables.signals.length, 1)
  assert.equal(tables.grants.length, 1)
  assert.equal(tables.program_organizations.length, 1)
  assert.ok(res.filled.includes("description") && !res.filled.includes("website"))
  assert.ok(res.added.includes("AI Radar membership"))

  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))
  const again = await updateFromDraft(client, draft, "o-1", check.founderMatches)
  assert.equal(again.ok, true)
  assert.deepEqual(again.filled, [])
  assert.deepEqual(again.added, [])
  assert.deepEqual(Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), counts, "the second run changes nothing")
})
