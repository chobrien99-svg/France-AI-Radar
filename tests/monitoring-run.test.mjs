// End-to-end run of the signal monitor against an in-memory database, with
// the network (feeds, BODACC and the Claude API) replaced by canned replies.
// Run with `npm test`.
import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fakeSupabase } from "./fake-supabase.mjs"
import { runMonitoring } from "@/lib/monitoring/run"

const fixture = (name) => readFileSync(new URL(`./fixtures/monitoring/${name}`, import.meta.url), "utf8")
const ORG = "org-jemba"
const EMPTY_RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>`

// What the fake Claude answers, chosen from the item in the prompt.
function fakeAnalysis(prompt) {
  const base = { investors: null, funding_amount_eur: null, funding_stage: null, strength: 3, description: "", reasoning: "Matches the profile." }
  if (prompt.includes("Procédures collectives")) {
    return { ...base, is_about_company: true, confidence: 0.95, signal_type: "restructuring", title: "Jemba enters safeguard proceedings", signal_date: "2026-10-08", strength: 5 }
  }
  if (prompt.includes("Jemba lève")) {
    return { ...base, is_about_company: true, confidence: 0.9, signal_type: "fundraising", title: "Jemba raises €3M", signal_date: "2026-10-20", funding_amount_eur: 3, funding_stage: "seed", investors: "Elaia" }
  }
  return { ...base, is_about_company: false, confidence: 0.1, signal_type: "other", title: "Unrelated", signal_date: null }
}

let calls
const realFetch = globalThis.fetch

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key"
  calls = { claude: 0, urls: [] }
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    calls.urls.push(url)
    const reply = (body, type = "application/xml", status = 200) => new Response(body, { status, headers: { "content-type": type } })
    if (url.startsWith("https://api.anthropic.com/")) {
      calls.claude++
      const body = JSON.parse(init.body)
      const prompt = body.messages[0].content
      assert.equal(body.model, "claude-haiku-5-5")
      assert.equal(body.output_config.format.type, "json_schema")
      return reply(JSON.stringify({
        id: `msg_${calls.claude}`, type: "message", role: "assistant", model: body.model,
        content: [{ type: "text", text: JSON.stringify(fakeAnalysis(prompt)) }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 },
      }), "application/json")
    }
    if (url.startsWith("https://bodacc-datadila.opendatasoft.com/")) return reply(fixture("bodacc.json"), "application/json")
    if (url.startsWith("https://news.google.com/")) return reply(EMPTY_RSS)
    if (url.startsWith("https://www.maddyness.com/")) return reply(fixture("press.rss.xml"))
    return reply("not found", "text/plain", 404)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function seed() {
  return fakeSupabase({
    organizations: [{ id: ORG, name: "Jemba", status: "active", website: "https://jemba.ai", short_description: "Industrial ML for factories." }],
    legal_entities: [{ organization_id: ORG, siren: "912 345 678", is_primary: true }],
    organization_sectors: [{ organization_id: ORG, sectors: { name: "Industry" } }],
    monitoring_state: [],
    signal_candidates: [],
    monitoring_runs: [],
    signals: [
      // Already on the Radar: the capital-increase filing, and a fundraising signal 15 days before the press story.
      { id: "sig-1", organization_id: ORG, signal_type: "fundraising", signal_date: "2026-10-05", title: "Capital increase",
        source_url: "https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202601234567" },
    ],
  })
}

test("a run queues credible finds, skips known ones and namesakes, and logs itself", async () => {
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })

  // BODACC: proceedings (new) + capital filing (already a signal's source) + annual accounts (skipped).
  // Press: the Jemba article; the trends article doesn't name Jemba.
  assert.equal(summary.itemsSeen, 2)
  assert.equal(summary.itemsAnalyzed, 2)
  assert.equal(calls.claude, 2)
  assert.equal(summary.candidatesCreated, 2)

  const drafts = db.tables.signal_candidates
  const proceedings = drafts.find((d) => d.source === "bodacc")
  assert.equal(proceedings.signal_type, "restructuring")
  assert.equal(proceedings.status ?? "pending", "pending")
  assert.equal(proceedings.source_name, "BODACC")
  const press = drafts.find((d) => d.source === "press_rss")
  assert.equal(press.signal_type, "fundraising")
  assert.equal(press.funding_amount_eur, 3)
  assert.equal(press.funding_stage, "seed")
  assert.equal(press.source_name, "Maddyness")
  assert.equal(press.possible_duplicate_signal_id, "sig-1")

  // Nothing was published.
  assert.equal(db.tables.signals.length, 1)

  // Progress and the run log.
  const state = db.tables.monitoring_state.find((s) => s.organization_id === ORG)
  assert.equal(state.last_bodacc_date, "2026-10-15")
  assert.ok(state.last_checked_at)
  const [run] = db.tables.monitoring_runs
  assert.equal(run.kind, "manual")
  assert.ok(run.finished_at)
  assert.equal(run.candidates_created, 2)
  assert.ok(run.errors.some((e) => e.startsWith("press feed FrenchWeb: HTTP 404")))
})

test("a second run finds nothing new and calls Claude for nothing", async () => {
  const db = seed()
  await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  calls.claude = 0
  const again = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(again.itemsSeen, 0)
  assert.equal(again.candidatesCreated, 0)
  assert.equal(calls.claude, 0)
  assert.equal(db.tables.signal_candidates.length, 2)
})

test("without an API key the run stops before doing anything", async () => {
  delete process.env.ANTHROPIC_API_KEY
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.match(summary.errors[0], /ANTHROPIC_API_KEY/)
  assert.equal(calls.urls.length, 0)
  assert.equal(db.tables.monitoring_runs.length, 0)
})

test("the deadline stops a run cleanly", async () => {
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() - 1 })
  assert.equal(summary.orgsChecked, 0)
  assert.equal(summary.orgsRemaining, 1)
  assert.equal(calls.claude, 0)
  assert.ok(db.tables.monitoring_runs[0].finished_at)
})
