// Cohort infographic data (lib/embed/cohort.ts). Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildCohort, roundLine, compactAmount } from "../lib/embed/cohort.ts"
import { COHORT_EMBEDS, cohortEmbed } from "../lib/embed/editorial.ts"

const org = (id, name, extra = {}) => ({
  id, name, slug: name.toLowerCase().replace(/\W+/g, "-"), country: "France", city_id: null, secondary_city_id: null,
  founded_year: null, short_description: `${name} does things.`, description: null, website: null, is_stealth: false, ...extra,
})
const round = (id, organization_id, stage, extra = {}) => ({
  id, organization_id, stage, amount_eur: null, currency_original: null, amount_original: null, announced_date: null, ftj_url: null, ...extra,
})
const base = () => ({
  editionName: "Future 40 — 2026",
  members: [], orgs: [], cities: [], legal: [], rounds: [], roundInvestors: [], investorNames: [], founders: [], programmes: [], tags: [], radarIds: [],
})

test("amounts are shown in the currency announced, compactly", () => {
  assert.equal(compactAmount(7_000_000), "7M")
  assert.equal(compactAmount(2_500_000), "2.5M")
  assert.equal(compactAmount(930_000), "930k")
  assert.equal(compactAmount(10_000_000_000), "10bn")
  assert.equal(roundLine(round("r", "o", "seed", { currency_original: "USD", amount_original: 7_000_000, amount_eur: 6, announced_date: "2026-03-01" })), "Seed US$7M (Mar 2026)")
  assert.equal(roundLine(round("r", "o", "series_a", { currency_original: "KRW", amount_original: 10_000_000_000 })), "Series A ₩10bn")
  // amount_eur is stored in millions
  assert.equal(roundLine(round("r", "o", "pre_seed", { amount_eur: 0.378, announced_date: "2024-01-01" })), "Pre-seed €378k (Jan 2024)")
  assert.equal(roundLine(round("r", "o", "pre_seed", { announced_date: "2026-07-01" })), "Pre-seed, amount undisclosed (Jul 2026)")
  assert.equal(roundLine(round("r", "o", "undisclosed", { currency_original: "USD", amount_original: 3_000_000 })), "Raised US$3M")
  assert.equal(roundLine(round("r", "o", "undisclosed")), "Round, amount undisclosed")
})

test("only members of the edition are included, with their theme", () => {
  const rows = base()
  rows.orgs = [org("a", "Alpha"), org("b", "Beta"), org("x", "Outsider")]
  rows.members = [{ organization_id: "a", group_label: "Climate & energy" }, { organization_id: "b", group_label: null }]
  const c = buildCohort(rows)
  assert.deepEqual(c.companies.map((x) => x.name), ["Alpha", "Beta"])
  assert.equal(c.companies[1].theme, "Other")
  assert.deepEqual(c.themes, [{ name: "Climate & energy", count: 1 }, { name: "Other", count: 1 }])
})

test("base: French company, foreign parent with a team in France, abroad with or without a French entity", () => {
  const rows = base()
  rows.orgs = [
    org("fr", "Paris Co"),
    org("us", "Delaware Co"),
    org("sf", "SF Co", { country: "USA" }),
    org("de", "Munich Co", { country: "Germany" }),
  ]
  rows.members = rows.orgs.map((o) => ({ organization_id: o.id, group_label: "T" }))
  rows.legal = [
    { organization_id: "fr", country: "France", is_primary: true, incorporation_date: "2025-06-01" },
    { organization_id: "us", country: "USA", is_primary: true, incorporation_date: null },
    { organization_id: "us", country: "France", is_primary: false, incorporation_date: "2024-01-01" },
    { organization_id: "sf", country: "France", is_primary: true, incorporation_date: null },
    { organization_id: "de", country: "Germany", is_primary: true, incorporation_date: "2024-12-01" },
  ]
  const b = Object.fromEntries(buildCohort(rows).companies.map((c) => [c.name, c.base]))
  assert.deepEqual(b, { "Paris Co": "fr", "Delaware Co": "foreign-parent", "SF Co": "abroad-fr", "Munich Co": "abroad" })
})

test("year falls back to the main entity's registration date; place shows cities and a foreign country", () => {
  const rows = base()
  rows.orgs = [org("a", "Alpha", { city_id: "c1" }), org("b", "Beta", { founded_year: 2021, country: "USA", city_id: "c2", secondary_city_id: "c1" }), org("c", "Gamma")]
  rows.members = rows.orgs.map((o) => ({ organization_id: o.id, group_label: "T" }))
  rows.cities = [{ id: "c1", name: "Paris" }, { id: "c2", name: "San Francisco" }]
  rows.legal = [{ organization_id: "a", country: "France", is_primary: true, incorporation_date: "2025-10-14" }]
  const [a, b, c] = buildCohort(rows).companies
  assert.equal(a.year, 2025); assert.equal(a.place, "Paris")
  assert.equal(b.year, 2021); assert.equal(b.place, "San Francisco and Paris (USA)")
  assert.equal(c.year, null); assert.equal(c.place, "France")
})

test("stage is the furthest non-grant round reached; bootstrapped tag; none disclosed", () => {
  const rows = base()
  rows.orgs = [org("a", "A"), org("b", "B"), org("c", "C"), org("d", "D"), org("e", "E")]
  rows.members = rows.orgs.map((o) => ({ organization_id: o.id, group_label: "T" }))
  rows.rounds = [
    // A later undisclosed strategic investment doesn't take a Series A company back
    round("1", "a", "seed", { announced_date: "2025-06-01" }), round("2", "a", "series_a", { announced_date: "2026-04-10" }), round("2b", "a", "undisclosed", { announced_date: "2026-06-01" }),
    round("3", "b", "pre_seed", { announced_date: "2026-03-01" }), round("4", "b", "seed", { announced_date: "2026-10-06" }), round("5", "b", "grant", { announced_date: "2026-12-01" }),
    round("6", "c", "grant"),
    round("7", "e", "undisclosed", { currency_original: "USD", amount_original: 3e6 }),
  ]
  rows.tags = [{ organization_id: "d", tag: "Bootstrapped" }]
  const cs = buildCohort(rows).companies
  const s = Object.fromEntries(cs.map((c) => [c.name, c.stage]))
  assert.deepEqual(s, { A: "a", B: "seed", C: "none", D: "boot", E: "unsp" })
  // grants without an amount are left out of the funding list
  assert.deepEqual(cs.find((c) => c.name === "C").funding, [])
  assert.equal(cs.find((c) => c.name === "B").funding.length, 2)
})

test("backers: round investors plus accelerators, deduplicated, without 'Business Angels'", () => {
  const rows = base()
  rows.orgs = [org("a", "Alpha")]
  rows.members = [{ organization_id: "a", group_label: "T" }]
  rows.rounds = [round("r1", "a", "pre_seed"), round("r2", "a", "seed")]
  rows.investorNames = [{ id: "k", name: "Kima Ventures" }, { id: "ba", name: "Business Angels" }, { id: "s", name: "Seedcamp" }]
  rows.roundInvestors = [{ funding_round_id: "r1", investor_id: "k" }, { funding_round_id: "r1", investor_id: "ba" }, { funding_round_id: "r2", investor_id: "k" }, { funding_round_id: "r2", investor_id: "s" }]
  rows.programmes = [
    { organization_id: "a", program: "Y Combinator", program_type: "accelerator", cohort_label: "S26" },
    { organization_id: "a", program: "Inria", program_type: "university", cohort_label: "Spin-off" },
    // known to the editors but not public: never shown, not even as a backer
    { organization_id: "a", program: "F/ai (Station F)", program_type: "accelerator", cohort_label: "Batch 2", private: true },
  ]
  const [a] = buildCohort(rows).companies
  assert.deepEqual(a.backers, ["Kima Ventures", "Seedcamp", "Y Combinator"])
  assert.deepEqual(a.programmes, ["Y Combinator S26", "Inria Spin-off"])
})

test("links: Radar profile for Radar companies, French Tech Journal article from a round", () => {
  const rows = base()
  rows.orgs = [org("a", "Bleu Robotics"), org("b", "Lemrock")]
  rows.members = rows.orgs.map((o) => ({ organization_id: o.id, group_label: "T" }))
  rows.radarIds = ["a"]
  rows.rounds = [round("r", "b", "seed", { amount_eur: 6, currency_original: "USD", amount_original: 7e6, ftj_url: "https://www.frenchtechjournal.com/lemrock/" })]
  const [bleu, lemrock] = buildCohort(rows).companies
  assert.equal(bleu.links.length, 1)
  assert.match(bleu.links[0].url, /\/startup\/bleu-robotics$/)
  assert.deepEqual(lemrock.links, [{ label: "French Tech Journal: Seed US$7M", url: "https://www.frenchtechjournal.com/lemrock/" }])
})

test("founders are listed once per person", () => {
  const rows = base()
  rows.orgs = [org("a", "Alpha")]
  rows.members = [{ organization_id: "a", group_label: "T" }]
  rows.founders = [
    { organization_id: "a", person_id: "p1", full_name: "Serena Ivaldi" },
    { organization_id: "a", person_id: "p1", full_name: "Serena Ivaldi" },
    { organization_id: "a", person_id: "p2", full_name: "Jean-Baptiste Mouret" },
  ]
  assert.deepEqual(buildCohort(rows).companies[0].founders, ["Serena Ivaldi", "Jean-Baptiste Mouret"])
})

test("an edition can be embedded only once an editor enables it", () => {
  assert.ok(cohortEmbed("future-40-2026"))
  assert.equal(cohortEmbed("i-lab-2026"), null)
  COHORT_EMBEDS["test-off"] = { ...COHORT_EMBEDS["future-40-2026"], enabled: false }
  assert.equal(cohortEmbed("test-off"), null)
  delete COHORT_EMBEDS["test-off"]
})
