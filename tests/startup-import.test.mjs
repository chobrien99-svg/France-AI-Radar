// Draft import validation (lib/startup-import.ts). Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { validateDraft, extractDraftJson, slugify } from "../lib/startup-import.ts"
import { vocabFromMigrations } from "./vocab-from-migrations.mjs"

const vocab = vocabFromMigrations()
const example = JSON.parse(readFileSync(new URL("./fixtures/startup-draft.example.json", import.meta.url), "utf8"))
const clone = () => structuredClone(example)
const paths = (issues) => issues.map((i) => i.path)

test("vocabulary parsed from the migrations", () => {
  assert.equal(vocab.layers.length, 12)
  assert.equal(vocab.terms.length, 135)
})

test("the template's example draft imports with no errors", () => {
  const { draft, errors, warnings } = validateDraft(example, vocab)
  assert.deepEqual(errors, [])
  assert.ok(draft)
  // Only expected warnings: a year-month date and a synonym-free example
  assert.deepEqual(paths(warnings), ["grants[0].awarded_date"])
  assert.equal(draft.organization.slug, "exemple-biosystemes")
  assert.equal(draft.primaryLayer.label, "AI-Native Applications")
  assert.equal(draft.primaryLayer.evidence_status, "reported")
  assert.equal(draft.terms.length, 8)
  assert.deepEqual(draft.terms.map((t) => t.facet).sort(), ["domain", "method", "method", "modality", "modality", "specialization", "specialization", "specialization"])
  assert.equal(draft.terms.find((t) => t.label === "Predictive Modeling").facet, "method")
  assert.equal(draft.profile.technology_positioning, "research_commercialization")
  assert.equal(draft.organization.fundraising_status, "exploring")
  assert.equal(draft.founders[0].person.has_phd, true)
  assert.equal(draft.signals[0].signal_type, "fundraising")
  assert.equal(draft.fundingRounds[0].stage, "pre_seed")
  assert.equal(draft.grants[0].awarded_date, "2025-06-01")
  assert.deepEqual(draft.sectors.map((s) => [s.name, s.is_primary]), [["TechBio", true], ["HealthTech", false]])
  assert.deepEqual(draft.tags, [{ tag: "Lab spin-off", strength: 5 }, { tag: "Clinical pilots", strength: 3 }])
})

test("finds the JSON block inside a whole Claude reply", () => {
  const reply = "Here is the draft.\n\n### A. Core\nCompany name: X\n\n```json\n" + JSON.stringify(example, null, 2) + "\n```\n\nLet me know."
  const out = extractDraftJson(reply)
  assert.ok("value" in out)
  assert.equal(out.value.company.name, "Exemple Biosystèmes")
  assert.ok("error" in extractDraftJson("no json here"))
  assert.ok("error" in extractDraftJson("```json\n{ broken\n```"))
})

test("missing name and wrong schema are errors", () => {
  const d = clone(); d.company.name = "Unknown"
  assert.deepEqual(paths(validateDraft(d, vocab).errors), ["company.name"])
  const s = clone(); s.schema = "something-else@9"
  assert.equal(validateDraft(s, vocab).draft, null)
})

test("unknown, retired and misplaced terms are skipped with a warning, not imported", () => {
  const d = clone()
  d.technical.specializations.push({ term: "Quantum Telepathy" })
  d.technical.specializations.push({ term: "Reinforcement Learning" }) // a method, not a specialization
  const { draft, warnings } = validateDraft(d, vocab)
  assert.equal(draft.terms.filter((t) => t.facet === "specialization").length, 3)
  assert.ok(warnings.some((w) => w.message.includes("Quantum Telepathy")))
  assert.ok(warnings.some((w) => w.message.includes("exists under Core AI methods")))

  const retired = structuredClone(vocab)
  retired.terms.find((t) => t.slug === "bioinformatics").isActive = false
  assert.ok(validateDraft(example, retired).warnings.some((w) => w.message.includes("retired")))
})

test("synonyms resolve to the canonical term and are flagged for review", () => {
  const d = clone()
  d.technical.specializations = [{ term: "RAG" }, { term: "agentic ai" }]
  const { draft, warnings } = validateDraft(d, vocab)
  assert.deepEqual(draft.terms.filter((t) => t.facet === "specialization").map((t) => t.label), ["Retrieval-Augmented Generation", "AI Agents"])
  assert.equal(warnings.filter((w) => w.message.includes("synonym")).length, 2)
})

test("labels and slugs are both accepted, case and accents ignored", () => {
  const d = clone()
  d.technical.primary_layer = { layer: "inference_optimization" }
  d.technical.technology_maturity = "COMMERCIAL"
  d.fundraising.fundraising_status = "actively raising"
  const { draft } = validateDraft(d, vocab)
  assert.equal(draft.primaryLayer.label, "Inference & Optimization")
  assert.equal(draft.primaryLayer.evidence_status, "unverified")
  assert.equal(draft.profile.technology_maturity, "commercial")
  assert.equal(draft.organization.fundraising_status, "actively_raising")
})

test("Unknown and empty values stay unset; the primary layer is not repeated as secondary", () => {
  const d = clone()
  d.technical.primary_layer = { layer: "Unknown" }
  d.technical.secondary_layers = ["AI-Native Applications", "AI-Native Applications"]
  d.technical.ai_product_role = "unknown"
  const { draft, warnings } = validateDraft(d, vocab)
  assert.equal(draft.primaryLayer, null)
  assert.equal(draft.secondaryLayers.length, 1)
  assert.equal(draft.profile.ai_product_role, null)
  assert.ok(warnings.some((w) => w.message.includes("Duplicate layer")))
})

test("amounts, dates, identifiers and URLs are normalized or rejected", () => {
  const d = clone()
  d.fundraising.total_raised_eur = "€2.5M"
  d.funding_rounds[0].amount_eur = "2 500 000"
  d.grants[0].amount_eur = "1,2 M€"
  d.legal_entities[0].capital_eur = "10,000"
  d.company.founded_date = "2025"
  d.company.first_seen_at = "2025-02-30"
  d.legal_entities[0].siren = "123 456 789"
  d.legal_entities[0].siret = "12345"
  d.company.website = "example.com"
  d.company.linkedin_url = "not a url"
  d.company.email = "nope"
  const { draft } = validateDraft(d, vocab)
  assert.equal(draft.organization.total_raised_eur, 2500000)
  assert.equal(draft.fundingRounds[0].amount_eur, 2500000)
  assert.equal(draft.grants[0].amount_eur, 1200000)
  assert.equal(draft.legalEntities[0].capital_eur, 10000)
  assert.equal(draft.organization.founded_date, "2025-01-01")
  assert.equal(draft.organization.first_seen_at, null)
  assert.equal(draft.legalEntities[0].siren, "123456789")
  assert.equal(draft.legalEntities[0].siret, null)
  assert.equal(draft.organization.website, "https://example.com")
  assert.equal(draft.organization.linkedin_url, null)
  assert.equal(draft.organization.email, null)
})

test("invalid list items are skipped, the rest imported", () => {
  const d = clone()
  d.signals.push({ signal_type: "Rumour", title: "Something" })
  d.funding_rounds.push({ stage: "Series Z" })
  d.sectors.others.push("Not A Sector")
  d.founders.push({ role: "CTO" })
  const { draft, warnings } = validateDraft(d, vocab)
  assert.equal(draft.signals.length, 1)
  assert.equal(draft.fundingRounds.length, 1)
  assert.equal(draft.sectors.length, 2)
  assert.equal(draft.founders.length, 1)
  assert.ok(warnings.length >= 4)
})

test("slugs follow the admin form's rule", () => {
  assert.equal(slugify("Société Générative IA"), "societe-generative-ia")
  assert.equal(slugify("  Mistral AI!! "), "mistral-ai")
})

test("the Claude Project template's own example passes the importer", () => {
  const template = readFileSync(new URL("../docs/claude-project/France_AI_Radar_Startup_Template.md", import.meta.url), "utf8")
  const out = extractDraftJson(template)
  assert.ok("value" in out, "template contains a parsable import block")
  assert.deepEqual(out.value, example, "template example matches tests/fixtures (regenerate with scripts/build-claude-template.py)")
  assert.deepEqual(validateDraft(out.value, vocab).errors, [])
  for (const t of vocab.terms) assert.ok(template.includes(`| ${t.label} |`), `template lists ${t.label}`)
})
