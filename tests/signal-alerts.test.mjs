// Subscriber signal alerts (lib/signal-alerts.ts) against an in-memory
// database, with the email API (Resend) replaced by a stub. Run with `npm test`.
import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { fakeSupabase } from "./fake-supabase.mjs"
import { sendSignalAlerts, buildAlertEmail } from "@/lib/signal-alerts"

const NOW = new Date("2026-11-03T06:41:00.000Z")
const FUTURE = "2026-12-01T00:00:00.000Z"

let sent
let emailFails
const realFetch = globalThis.fetch

beforeEach(() => {
  sent = []
  emailFails = false
  process.env.RESEND_API_KEY = "test"
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.resend.com/emails")
    if (emailFails) return new Response("down", { status: 500 })
    sent.push(JSON.parse(init.body))
    return new Response("{}", { status: 200 })
  }
})
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.RESEND_API_KEY
})

const profile = (id, tier, status, extra = {}) => ({
  id, email: `${id}@example.com`, full_name: `${id[0].toUpperCase()}${id.slice(1)} Person`,
  subscription_tier: tier, subscription_status: status, trial_ends_at: null, is_admin: false, ...extra,
})
const alert = (user_id, organization_id, created_at = "2026-10-01T00:00:00.000Z") => ({ user_id, organization_id, created_at, is_active: true })

function seed() {
  return {
    organizations: [
      { id: "o1", name: "Jemba", slug: "jemba" },
      { id: "o2", name: "Axone", slug: "axone" },
      { id: "o3", name: "Navigator Only", slug: "navigator-only" },
    ],
    // On the Radar: o1 and o2 (o3 is a Navigator-only company).
    product_organizations: ["o1", "o2"].map((id) => ({ organization_id: id, "product_catalog.slug": "ai-radar" })),
    profiles: [
      profile("pro", "professional", "active"),
      profile("explorer", "explorer", "active"),
      profile("lapsed", "professional", "canceled"),
      profile("trial", "professional", "trialing", { trial_ends_at: FUTURE }),
      profile("admin", "explorer", "inactive", { is_admin: true }),
    ],
    alerts: [
      alert("pro", "o1"), alert("pro", "o2"), alert("pro", "o3"),
      alert("explorer", "o1"),
      alert("lapsed", "o1"),
      // Set after s1 was added: s1 isn't news to this user.
      alert("trial", "o1", "2026-11-02T12:00:00.000Z"),
      alert("admin", "o2"),
      { ...alert("pro", "o2"), is_active: false },
    ],
    signals: [
      { id: "s1", organization_id: "o1", signal_type: "fundraising", signal_date: "2026-11-01", title: "Jemba raises €3M <seed>", created_at: "2026-11-02T10:00:00.000Z" },
      // Added before the 7-day window.
      { id: "s2", organization_id: "o1", signal_type: "key_hire", signal_date: "2026-10-19", title: "Old news", created_at: "2026-10-20T10:00:00.000Z" },
      // Added today but dated 2023: a historical entry, not news.
      { id: "s3", organization_id: "o1", signal_type: "incorporation", signal_date: "2023-05-01", title: "Jemba incorporated", created_at: "2026-11-02T20:00:00.000Z" },
      { id: "s4", organization_id: "o2", signal_type: "new_product", signal_date: null, title: "Axone ships its chip", created_at: "2026-11-02T11:00:00.000Z" },
      { id: "s5", organization_id: "o3", signal_type: "fundraising", signal_date: "2026-11-01", title: "Not on the Radar", created_at: "2026-11-02T11:00:00.000Z" },
    ],
    alert_deliveries: [],
  }
}

test("emails each eligible user the new signals on their alerted startups, once", async () => {
  const { client, tables } = fakeSupabase(seed())
  const result = await sendSignalAlerts(client, NOW)

  assert.deepEqual(result, { users: 2, emails: 2, signals: 3, failed: 0 })
  const to = Object.fromEntries(sent.map((m) => [m.to, m]))
  assert.deepEqual(Object.keys(to).sort(), ["admin@example.com", "pro@example.com"])

  const pro = to["pro@example.com"]
  assert.equal(pro.subject, "New signals on 2 startups you follow")
  assert.match(pro.text, /Hi Pro,/)
  assert.match(pro.text, /Jemba \(https:\/\/www\.franceairadar\.com\/startup\/jemba\)\n- Fundraising · 1 Nov 2026: Jemba raises €3M <seed>/)
  assert.match(pro.text, /Axone .*\n- New Product: Axone ships its chip/)
  assert.doesNotMatch(pro.text, /Old news|Jemba incorporated|Not on the Radar/)
  assert.match(pro.html, /Jemba raises €3M &lt;seed&gt;/, "titles are escaped in HTML")

  assert.equal(to["admin@example.com"].subject, "New signal on Axone")
  assert.deepEqual(tables.alert_deliveries.map((d) => `${d.user_id}:${d.signal_id}`).sort(), ["admin:s4", "pro:s1", "pro:s4"])

  // The next run sends nothing new.
  sent = []
  const again = await sendSignalAlerts(client, NOW)
  assert.deepEqual(again, { users: 0, emails: 0, signals: 0, failed: 0 })
  assert.equal(sent.length, 0)
})

test("a failed email is retried on the next run", async () => {
  const { client, tables } = fakeSupabase(seed())
  emailFails = true
  const first = await sendSignalAlerts(client, NOW)
  assert.equal(first.failed, 2)
  assert.equal(tables.alert_deliveries.length, 0, "claims are released when sending fails")

  emailFails = false
  const second = await sendSignalAlerts(client, NOW)
  assert.equal(second.emails, 2)
  assert.equal(sent.length, 2)
})

test("a signal added after the alert reaches a user who set it later", async () => {
  const db = seed()
  db.signals.push({ id: "s6", organization_id: "o1", signal_type: "partnership", signal_date: "2026-11-02", title: "Jemba partners with Elaia", created_at: "2026-11-02T15:00:00.000Z" })
  const { client } = fakeSupabase(db)
  await sendSignalAlerts(client, NOW)
  const trial = sent.find((m) => m.to === "trial@example.com")
  assert.ok(trial, "the trial user gets an email")
  assert.equal(trial.subject, "New signal on Jemba")
  assert.match(trial.text, /Jemba partners with Elaia/)
  assert.doesNotMatch(trial.text, /raises/)
})

test("no alerts, no work", async () => {
  const { client } = fakeSupabase({ alerts: [] })
  assert.deepEqual(await sendSignalAlerts(client, NOW), { users: 0, emails: 0, signals: 0, failed: 0 })
})

test("a long list is cut and counted", () => {
  const orgs = new Map([["o1", { id: "o1", name: "Jemba", slug: "jemba" }]])
  const signals = Array.from({ length: 34 }, (_, i) => ({
    id: `x${i}`, organization_id: "o1", signal_type: "other", signal_date: null, title: `Item ${i}`, created_at: `2026-11-02T10:${String(i).padStart(2, "0")}:00.000Z`,
  }))
  const email = buildAlertEmail({ full_name: null }, signals, orgs)
  assert.equal(email.subject, "34 new signals on Jemba")
  assert.equal((email.text.match(/^- /gm) ?? []).length, 30)
  assert.match(email.text, /…and 4 more on the site\./)
  assert.match(email.text, /^Hi,/)
})
