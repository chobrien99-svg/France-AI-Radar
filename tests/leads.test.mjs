// Companies to vet: reading the government directory, the first-pass score,
// Claude's web research, and the nightly ranking step, with the network
// (directory and Claude API) replaced by canned replies. Run with `npm test`.
import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fakeSupabase } from "./fake-supabase.mjs"
import { parseDirectory, scoreLead } from "@/lib/leads/parse"
import { researchAdjustment, validateResearch } from "@/lib/leads/research"
import { vetLeads } from "@/lib/leads/vet"

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/leads/${name}`, import.meta.url), "utf8"))
const CLARA = "131609539"
const OBSIDIA = "131976334"

// ---------------------------------------------------------------- directory + score

test("parseDirectory reads a real directory reply: activity, form, city, officers", () => {
  const facts = parseDirectory(fixture("directory-clara-solutions.json"), CLARA)
  assert.deepEqual(facts, {
    name: "CLARA SOLUTIONS",
    nafCode: "58.29A",
    nafLabel: "System and network software publishing",
    legalForm: "SAS",
    createdOn: "2026-10-16",
    city: "BUSSY-SAINT-GEORGES",
    employer: false,
    directors: [
      { name: "Mickael Chansavang", role: "Président de SAS", isCompany: false },
      { name: "Victor Huger", role: "Directeur Général", isCompany: false },
      { name: "David Thach", role: "Directeur Général", isCompany: false },
    ],
    closed: false,
  })
  assert.equal(parseDirectory(fixture("directory-clara-solutions.json"), "999999999"), null)
  assert.equal(parseDirectory({ error: "x" }, CLARA), null)
})

test("scoreLead ranks a software company with founders above a consultancy", () => {
  const clara = scoreLead("Clara Solutions", parseDirectory(fixture("directory-clara-solutions.json"), CLARA))
  assert.equal(clara.score, 80)
  assert.deepEqual(clara.reasons, ["+20 software or R&D activity (58.29A System and network software publishing)", "+10 3 officers (people or their holding companies)"])

  const obsidia = scoreLead("OBSIDIA PARTNERS", parseDirectory(fixture("directory-obsidia-partners.json"), OBSIDIA))
  assert.equal(obsidia.score, 0)
  assert.deepEqual(obsidia.reasons, ["-30 consulting, IT-services or training activity (70.22Z Business and management consulting)", '-20 "PARTNERS" in the name'])
})

test("scoreLead: a studio among the officers counts in favour, founders' holdings count as co-founders, a solo founder is not penalised", () => {
  const base = { name: null, nafCode: "62.01Z", nafLabel: null, legalForm: "SASU (single shareholder)", createdOn: null, city: null, employer: null, closed: false }
  assert.equal(scoreLead("LAR7", { ...base, directors: [{ name: "Ada Martin", role: "Président", isCompany: false }] }).score, 70)
  const studio = scoreLead("LAR7", { ...base, directors: [{ name: "EVE STUDIO", role: "Président", isCompany: true }] })
  assert.equal(studio.score, 80)
  assert.match(studio.reasons[1], /^\+10 a company among its officers \(EVE STUDIO\)/)
  const holdings = scoreLead("ORAKLIA TECHNOLOGIES", { ...base, directors: [
    { name: "FOURTICQ HOLDING", role: "Président", isCompany: true },
    { name: "BEROUA HOLDING", role: "Directeur général", isCompany: true },
  ] })
  assert.equal(holdings.score, 80)
  assert.deepEqual(holdings.reasons.slice(1), ["+10 2 officers (people or their holding companies)"])
  assert.deepEqual(scoreLead("DJED", null), { score: 50, reasons: [] })
  assert.equal(scoreLead("KOD CONSEIL", null).score, 30)
  assert.equal(scoreLead("NAPRIA", { ...base, closed: true, directors: [] }).score, 20)
})

// ---------------------------------------------------------------- research answer

test("validateResearch keeps only links the search actually returned", () => {
  const seen = new Set(["https://clara.ai/", "https://www.maddyness.com/clara"])
  const ok = validateResearch({
    verdict: "startup", confidence: 0.8, summary: "Builds an AI assistant.",
    website: "https://clara.ai/about", founders: ["Victor Huger, CEO"],
    links: [{ title: "Site", url: "https://clara.ai/" }, { title: "Made up", url: "https://invented.example/" }],
  }, seen)
  assert.equal(ok.website, "https://clara.ai/about")
  assert.deepEqual(ok.links, [{ title: "Site", url: "https://clara.ai/" }])
  assert.equal(validateResearch({ verdict: "startup", confidence: 0.8, summary: "x", website: "https://other.example/" }, seen).website, null)
  assert.deepEqual(validateResearch({ verdict: "maybe", confidence: 0.5, summary: "x" }, seen), { error: "unknown verdict" })
  assert.deepEqual(researchAdjustment({ verdict: "consultancy", confidence: 0.9 }), { points: -30, reason: "-30 web research: looks like a consultancy or service business" })
  assert.equal(researchAdjustment({ verdict: "startup", confidence: 0.3 }), null)
})

// ---------------------------------------------------------------- nightly step

let calls
let claudeStatus
const realFetch = globalThis.fetch

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key"
  delete process.env.LEAD_RESEARCH_PER_DAY
  calls = { directory: [], claude: [] }
  claudeStatus = 200
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
    if (url.startsWith("https://recherche-entreprises.api.gouv.fr/search")) {
      const q = new URL(url).searchParams.get("q")
      calls.directory.push(q)
      if (q === CLARA) return json(fixture("directory-clara-solutions.json"))
      if (q === OBSIDIA) return json(fixture("directory-obsidia-partners.json"))
      return json({ results: [], total_results: 0 })
    }
    if (url.startsWith("https://api.anthropic.com/")) {
      const body = JSON.parse(init.body)
      calls.claude.push(body)
      if (claudeStatus !== 200) return json({ type: "error", error: { type: "api_error", message: "overloaded" } }, claudeStatus)
      assert.equal(body.model, "claude-sonnet-5-5")
      assert.deepEqual(body.tools, [{ type: "web_search_20260209", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "FR" } }])
      if (!body.messages[0].content.includes("SIREN: 131609539")) {
        // Any other company: nothing much found yet.
        return json({
          id: "msg_2", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null,
          usage: { input_tokens: 3000, output_tokens: 100 },
          content: [{ type: "text", text: '{"verdict":"unclear","confidence":0.4,"summary":"No public trace yet.","website":null,"founders":[],"links":[]}' }],
        })
      }
      assert.match(body.messages[0].content, /Officers: Mickael Chansavang \(Président de SAS\)/)
      return json({
        id: "msg_1", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 5000, output_tokens: 300, server_tool_use: { web_search_requests: 2 } },
        content: [
          { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "Clara Solutions IA Bussy-Saint-Georges" } },
          { type: "web_search_tool_result", tool_use_id: "srv_1", content: [
            { type: "web_search_result", url: "https://clara-solutions.fr/", title: "Clara Solutions", encrypted_content: "x", page_age: null },
            { type: "web_search_result", url: "https://www.linkedin.com/company/clara-solutions", title: "Clara Solutions | LinkedIn", encrypted_content: "x", page_age: null },
          ] },
          { type: "text", text: JSON.stringify({
            verdict: "startup", confidence: 0.75, summary: "Three founders building an AI assistant for SMEs; a site and a LinkedIn page exist.",
            website: "https://clara-solutions.fr/", founders: ["Victor Huger, CEO"],
            links: [{ title: "Clara Solutions", url: "https://clara-solutions.fr/" }, { title: "Invented", url: "https://nowhere.example/" }],
          }) },
        ],
      })
    }
    return new Response("not found", { status: 404 })
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function seedLeads() {
  return fakeSupabase({
    company_leads: [
      { siren: CLARA, name: "Clara Solutions", status: "new", first_seen_at: "2026-10-28T18:00:00Z", checked_at: null, score: null, score_reasons: [], research: null, researched_at: null },
      { siren: OBSIDIA, name: "OBSIDIA PARTNERS", status: "new", first_seen_at: "2026-10-28T18:00:00Z", checked_at: null, score: null, score_reasons: [], research: null, researched_at: null },
      { siren: "131646390", name: "DJED", status: "new", first_seen_at: "2026-10-28T18:00:00Z", checked_at: null, score: null, score_reasons: [], research: null, researched_at: null },
      { siren: "131789786", name: "Lar7", status: "ignored", first_seen_at: "2026-10-28T18:00:00Z", checked_at: null, score: null, score_reasons: [], research: null, researched_at: null },
    ],
  })
}

const lead = (db, siren) => db.tables.company_leads.find((l) => l.siren === siren)

test("the nightly step checks new companies for free, then researches only the promising ones", async () => {
  const db = seedLeads()
  const summary = await vetLeads(db.client, { deadline: Date.now() + 60_000 })
  assert.deepEqual(summary, { checked: 3, researched: 2, errors: [] })
  assert.deepEqual(calls.directory.sort(), [CLARA, "131646390", OBSIDIA].sort())   // not the ignored one

  const clara = lead(db, CLARA)
  assert.equal(clara.naf_code, "58.29A")
  assert.equal(clara.directors.length, 3)
  assert.equal(clara.score, 100)   // 80 from the register, +20 from the research
  assert.equal(clara.score_reasons.at(-1), "+20 web research: looks like an AI product startup")
  assert.equal(clara.research.verdict, "startup")
  assert.deepEqual(clara.research.links, [{ title: "Clara Solutions", url: "https://clara-solutions.fr/" }])
  assert.ok(clara.researched_at)

  assert.equal(lead(db, OBSIDIA).score, 0)
  assert.equal(lead(db, OBSIDIA).research, null)   // below the research threshold
  const djed = lead(db, "131646390")
  assert.deepEqual(djed.score_reasons, ["not in the government directory yet (registered in the last days)"])
  assert.equal(djed.research.verdict, "unclear")
  assert.equal(djed.score, 50)   // an unclear verdict moves nothing
  assert.equal(calls.claude.length, 2)

  // A second run the same day does nothing new.
  const again = await vetLeads(db.client, { deadline: Date.now() + 60_000 })
  assert.equal(again.checked, 0)
})

test("research stops at the daily allowance, and a failure is recorded instead of retried every night", async () => {
  process.env.LEAD_RESEARCH_PER_DAY = "1"
  claudeStatus = 400
  const db = seedLeads()
  const summary = await vetLeads(db.client, { deadline: Date.now() + 60_000 })
  assert.equal(calls.claude.length, 1)
  assert.equal(summary.researched, 0)
  assert.match(summary.errors[0], /^Clara Solutions: research failed: Claude API error 400/)
  assert.match(lead(db, CLARA).research.error, /Claude API error 400/)
  assert.ok(lead(db, CLARA).researched_at)

  process.env.LEAD_RESEARCH_PER_DAY = "0"
  calls.claude = []
  await vetLeads(db.client, { deadline: Date.now() + 60_000 })
  assert.equal(calls.claude.length, 0)
})
