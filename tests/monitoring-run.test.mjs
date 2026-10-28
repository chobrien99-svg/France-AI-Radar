// End-to-end run of the signal monitor against an in-memory database, with
// the network (feeds, BODACC, Pappers and the Claude API) replaced by canned replies.
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
  if (prompt.includes("Augmentation du capital social")) {
    return { ...base, is_about_company: true, confidence: 0.8, signal_type: "fundraising", title: "Jemba files a capital increase", signal_date: "2026-10-09" }
  }
  if (prompt.includes("Jemba lève")) {
    return { ...base, is_about_company: true, confidence: 0.9, signal_type: "fundraising", title: "Jemba raises €3M", signal_date: "2026-10-20", funding_amount_eur: 3, funding_stage: "seed", investors: "Elaia" }
  }
  return { ...base, is_about_company: false, confidence: 0.1, signal_type: "other", title: "Unrelated", signal_date: null }
}

let calls
// Per-test switches: what Google News returns, and an item text Claude fails on.
let googleBody
let claudeFailsOn
// When true, the API refuses every structured-output request with a 400.
let rejectStructured
// When set, the plain (non-structured) request gets this text instead of JSON.
let plainAnswer
// What Pappers answers: an HTTP status, and the company record (dates relative to today).
let pappersStatus
let pappersCapital
const isoDaysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
function pappersCompany() {
  const record = JSON.parse(fixture("pappers-entreprise.json"))
  record.capital = pappersCapital
  record.depots_actes[0].date_depot = isoDaysAgo(10)
  record.representants[1].date_prise_de_poste = isoDaysAgo(20)
  return record
}
const realFetch = globalThis.fetch
const NAMESAKE_RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Google News</title>
<item><title>Jemba, le restaurant jamaïcain, ouvre à Lyon - Le Progrès</title><link>https://news.google.com/rss/articles/NAMESAKE</link>
<pubDate>Wed, 22 Oct 2026 06:00:00 GMT</pubDate><source url="https://www.leprogres.fr">Le Progrès</source></item></channel></rss>`

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key"
  calls = { claude: 0, urls: [] }
  googleBody = EMPTY_RSS
  claudeFailsOn = null
  rejectStructured = false
  plainAnswer = null
  pappersStatus = 200
  pappersCapital = 15000
  delete process.env.PAPPERS_API_KEY
  delete process.env.PAPPERS_INTERVAL_DAYS
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    calls.urls.push(url)
    const reply = (body, type = "application/xml", status = 200) => new Response(body, { status, headers: { "content-type": type } })
    if (url.startsWith("https://api.anthropic.com/")) {
      calls.claude++
      const body = JSON.parse(init.body)
      const prompt = body.messages[0].content
      if (claudeFailsOn && prompt.includes(claudeFailsOn)) {
        return reply(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "boom" } }), "application/json", 400)
      }
      if (rejectStructured && body.output_config) {
        return reply(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "output_config.format: schema not supported" } }), "application/json", 400)
      }
      assert.equal(body.model, "claude-haiku-5-5")
      if (body.output_config) assert.equal(body.output_config.format.type, "json_schema")
      else {
        assert.match(prompt, /Reply with only a JSON object/)
        assert.match(prompt, /funding_amount_eur \(number or null\) — Fundraising only: amount in MILLIONS of euros/)
        assert.match(prompt, /signal_type \(string one of: fundraising, /)
      }
      return reply(JSON.stringify({
        id: `msg_${calls.claude}`, type: "message", role: "assistant", model: body.model,
        content: [{ type: "text", text: !body.output_config && plainAnswer ? plainAnswer : JSON.stringify(fakeAnalysis(prompt)) }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 },
      }), "application/json")
    }
    if (url.startsWith("https://bodacc-datadila.opendatasoft.com/")) return reply(fixture("bodacc.json"), "application/json")
    if (url.startsWith("https://news.google.com/")) return reply(googleBody)
    if (url.startsWith("https://api.pappers.fr/")) {
      calls.pappers = (calls.pappers ?? 0) + 1
      // The key travels in a header, never in the URL (which can end up in logs).
      assert.equal(new Headers(init.headers).get("api-key"), "pappers-test-key")
      assert.ok(!url.includes("pappers-test-key"))
      assert.ok(url.startsWith("https://api.pappers.fr/v2/entreprise?siren=912345678"))
      if (pappersStatus !== 200) return reply(JSON.stringify({ statusCode: pappersStatus, message: "refused" }), "application/json", pappersStatus)
      return reply(JSON.stringify(pappersCompany()), "application/json")
    }
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
  assert.ok(run.errors.some((e) => e.startsWith("press feed Sifted: HTTP 404")))
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

test("a namesake is kept as dismissed, not queued, and not read again", async () => {
  googleBody = NAMESAKE_RSS
  const db = seed()
  const first = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(first.itemsAnalyzed, 3)
  assert.equal(first.candidatesCreated, 2)
  assert.equal(first.candidateIds.length, 2)
  const namesake = db.tables.signal_candidates.find((d) => d.source === "google_news")
  assert.equal(namesake.status, "dismissed")
  assert.equal(namesake.raw_title, "Jemba, le restaurant jamaïcain, ouvre à Lyon")

  calls.claude = 0
  const second = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(second.itemsSeen, 0)
  assert.equal(calls.claude, 0)
})

test("a filing Claude couldn't read is fetched again next run", async () => {
  claudeFailsOn = "Procédures collectives"
  const db = seed()
  const first = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(first.candidatesCreated, 1)
  assert.ok(first.errors.some((e) => e.includes("Claude API error 400")))
  // The unread filing is dated 2026-10-15, so the cursor stops the day before.
  assert.equal(db.tables.monitoring_state[0].last_bodacc_date, "2026-10-14")

  claudeFailsOn = null
  const second = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(second.candidatesCreated, 1)
  assert.equal(db.tables.signal_candidates.find((d) => d.source === "bodacc").signal_type, "restructuring")
  assert.equal(db.tables.monitoring_state[0].last_bodacc_date, "2026-10-15")
})

test("a reply that isn't a feed is reported, not taken as 'no news'", async () => {
  googleBody = "<!doctype html><html><body>Before you continue to Google</body></html>"
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.ok(summary.errors.includes("Jemba: Google News reply was not a news feed"))
})

test("if the structured request is refused, the plain retry still queues the draft and the reason is logged", async () => {
  rejectStructured = true
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(summary.candidatesCreated, 2)
  assert.equal(calls.claude, 4)   // each item: refused, then answered
  assert.equal(db.tables.signal_candidates.find((d) => d.source === "press_rss").funding_amount_eur, 3)
})

test("when both attempts fail, the API's own message is in the run log", async () => {
  claudeFailsOn = "Procédures collectives"
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.ok(summary.errors.some((e) => e.includes("structured request refused (boom)") && e.includes("Claude API error 400: boom")))
})

test("a plain retry that answers badly still records why the structured request was refused", async () => {
  rejectStructured = true
  plainAnswer = "Sorry, I can't tell."
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(summary.candidatesCreated, 0)
  assert.ok(summary.errors.some((e) => e.includes("structured request refused (output_config.format: schema not supported); plain retry: answer was not JSON")))
})

// ---------------------------------------------------------------- Pappers

test("with a Pappers key, register events are read once and queued like any other find", async () => {
  process.env.PAPPERS_API_KEY = "pappers-test-key"
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(calls.pappers, 1)
  // BODACC proceedings + press story + Pappers filing (queued) + Pappers new director (dismissed).
  assert.equal(summary.itemsAnalyzed, 4)
  assert.equal(summary.candidatesCreated, 3)
  const filing = db.tables.signal_candidates.find((d) => d.source === "pappers" && d.status !== "dismissed")
  assert.equal(filing.source_name, "Pappers")
  assert.equal(filing.signal_type, "fundraising")
  assert.match(filing.source_url, /^https:\/\/www\.pappers\.fr\/entreprise\/912345678#actes-/)
  const state = db.tables.monitoring_state[0]
  assert.ok(state.last_pappers_at)
  assert.deepEqual(state.pappers_seen, { capital: 15000, closed: false })

  // Next run: the same events are known; a capital change is new.
  pappersCapital = 20000
  calls.claude = 0
  const again = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(again.itemsSeen, 1)
  assert.equal(calls.claude, 1)
  assert.ok(db.tables.signal_candidates.some((d) => d.source_url === "https://www.pappers.fr/entreprise/912345678#capital-20000"))
  assert.deepEqual(db.tables.monitoring_state[0].pappers_seen, { capital: 20000, closed: false })
})

test("the nightly run reads Pappers only every PAPPERS_INTERVAL_DAYS, and 0 turns it off", async () => {
  process.env.PAPPERS_API_KEY = "pappers-test-key"
  const db = seed()
  db.tables.monitoring_state.push({ organization_id: ORG, enabled: true, search_aliases: [], exclude_terms: [],
    last_pappers_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), pappers_seen: { capital: 15000, closed: false } })
  await runMonitoring(db.client, { kind: "cron", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(calls.pappers ?? 0, 0)   // read 5 days ago; default is every 14

  process.env.PAPPERS_INTERVAL_DAYS = "3"
  await runMonitoring(db.client, { kind: "cron", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(calls.pappers, 1)

  process.env.PAPPERS_INTERVAL_DAYS = "0"
  db.tables.monitoring_state[0].last_pappers_at = null
  await runMonitoring(db.client, { kind: "cron", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.equal(calls.pappers, 1)
})

test("a refused Pappers key is reported once and the other sources still run", async () => {
  process.env.PAPPERS_API_KEY = "pappers-test-key"
  pappersStatus = 401
  const db = seed()
  const summary = await runMonitoring(db.client, { kind: "manual", organizationId: ORG, deadline: Date.now() + 60_000 })
  assert.ok(summary.errors.includes("Pappers: the API key was refused (401); check PAPPERS_API_KEY"))
  assert.equal(summary.candidatesCreated, 2)
  assert.equal(db.tables.monitoring_state[0].last_pappers_at, undefined)
})
