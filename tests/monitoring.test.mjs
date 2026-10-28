// Signal monitoring: name matching, feed and BODACC parsing, validation of
// Claude's answers, duplicate detection. Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mentions, normalizeText, searchTerms } from "../lib/monitoring/match.ts"
import { normalizeSiren, pappersUrl, parseBodacc, parseFeed, parsePappersCompany, parsePappersSearch, parsePappersWebhook, stripHtml } from "../lib/monitoring/parse.ts"
import { ANALYSIS_SCHEMA, buildPrompt, findPossibleDuplicate, isUsable, validateAnalysis } from "../lib/monitoring/analysis.ts"

const fixture = (name) => readFileSync(new URL(`./fixtures/monitoring/${name}`, import.meta.url), "utf8")
const target = (name, aliases = [], excludeTerms = []) => ({ name, aliases, excludeTerms })

// ---------------------------------------------------------------- matching

test("normalizeText strips accents, case and punctuation", () => {
  assert.equal(normalizeText("Signéva, l'IA « morale » !"), "signeva l ia morale")
  assert.equal(normalizeText("Katrix.AI"), "katrix ai")
})

test("searchTerms drops legal suffixes and too-short names, keeps aliases", () => {
  assert.deepEqual(searchTerms(target("Jemba SAS", ["Jemba Industrie"])), ["jemba", "jemba industrie"])
  assert.deepEqual(searchTerms(target("AI")), [])
})

test("mentions needs whole words, ignores accents and case", () => {
  assert.ok(mentions("SIGNEVA dévoile sa feuille de route", target("Signéva")))
  assert.ok(mentions("Katrix.AI opens Munich office", target("Katrix.AI")))
  assert.ok(!mentions("Jembalaya restaurant opens", target("Jemba")))
  assert.ok(!mentions("Nothing relevant here", target("Jemba")))
})

test("mentions matches aliases and honours exclude words", () => {
  assert.ok(mentions("Homo Digitalis wins award", target("Signéva", ["Homo Digitalis"])))
  assert.ok(!mentions("Axone, the neuron part, explained by biologists", target("Axone", [], ["neuron"])))
})

// ---------------------------------------------------------------- feeds

test("parseFeed reads RSS 2.0 items, strips HTML, skips items without a link", () => {
  const items = parseFeed(fixture("press.rss.xml"), "press_rss", "Maddyness")
  assert.equal(items.length, 2)
  const [first] = items
  assert.equal(first.title, "Jemba lève 3 millions d’euros pour démocratiser l’IA industrielle")
  assert.equal(first.url, "https://www.maddyness.com/2026/10/20/jemba-leve-3-millions/")
  assert.equal(first.excerpt, "La startup parisienne Jemba annonce une levée de fonds de 3 M€ menée par Elaia.")
  assert.equal(first.publishedAt, "2026-10-20T07:30:00.000Z")
  assert.equal(first.sourceName, "Maddyness")
})

test("parseFeed reads Atom entries", () => {
  const [entry] = parseFeed(fixture("press.atom.xml"), "press_rss", "Tech.eu")
  assert.equal(entry.title, "Katrix.AI opens Munich office")
  assert.equal(entry.url, "https://tech.eu/2026/10/21/katrix-munich/")
  assert.equal(entry.excerpt, "The perception startup expands to Germany.")
  assert.equal(entry.publishedAt, "2026-10-21T09:00:00.000Z")
})

test("parseFeed moves Google News' publisher suffix to sourceName", () => {
  const [item] = parseFeed(fixture("google-news.rss.xml"), "google_news", "Google News")
  assert.equal(item.title, "Signéva dévoile son architecture cognitive pour robots")
  assert.equal(item.sourceName, "Les Echos")
  assert.equal(item.source, "google_news")
})

test("parseFeed refuses non-web links", () => {
  const evil = `<rss><channel><title>x</title><item><title>Jemba</title><link>javascript:alert(1)</link></item></channel></rss>`
  assert.deepEqual(parseFeed(evil, "press_rss"), [])
})

test("parseFeed returns nothing for junk", () => {
  assert.deepEqual(parseFeed("<html><body>Not a feed</body></html>", "press_rss"), [])
  assert.deepEqual(parseFeed("", "press_rss"), [])
})

test("stripHtml collapses tags and spaces", () => {
  assert.equal(stripHtml("<p>A&nbsp;<b>b</b></p>\n c"), "A b c")
})

// ---------------------------------------------------------------- BODACC

test("parseBodacc keeps filings, skips annual accounts, newest first", () => {
  const items = parseBodacc(JSON.parse(fixture("bodacc.json")))
  assert.equal(items.length, 2)
  assert.deepEqual(items.map((i) => i.publishedAt?.slice(0, 10)), ["2026-10-15", "2026-10-10"])
  const [proceedings, capital] = items
  assert.equal(proceedings.title, "BODACC: Procédures collectives – Jugement d'ouverture – JEMBA")
  assert.match(proceedings.excerpt, /procédure de sauvegarde/)
  assert.equal(proceedings.url, "https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:C202602222222")
  assert.match(capital.excerpt, /capital \(augmentation\)/)
  assert.equal(capital.sourceName, "BODACC")
})

test("parseBodacc tolerates odd responses", () => {
  assert.deepEqual(parseBodacc(null), [])
  assert.deepEqual(parseBodacc({ results: "nope" }), [])
  assert.deepEqual(parseBodacc({ results: [{ familleavis: "modification" }] }), [])
})

test("normalizeSiren", () => {
  assert.equal(normalizeSiren("912 345 678"), "912345678")
  assert.equal(normalizeSiren("91234567"), null)
  assert.equal(normalizeSiren(null), null)
})

// ---------------------------------------------------------------- Pappers

test("parsePappersSearch keeps valid companies with their details", () => {
  const matches = parsePappersSearch(JSON.parse(fixture("pappers-recherche.json")))
  assert.equal(matches.length, 2)
  assert.deepEqual(matches[0], {
    siren: "912345678", name: "JEMBA", legalForm: "SAS, société par actions simplifiée", city: "Lyon",
    createdOn: "2022-03-14", nafCode: "62.01Z", activity: "Programmation informatique", capital: 12000, closed: false,
  })
  assert.equal(matches[1].siren, "801234567")
  assert.equal(matches[1].closed, true)
  assert.deepEqual(parsePappersSearch({ error: "x" }), [])
})

test("parsePappersCompany finds recent filings and new directors, skipping accounts and past events", () => {
  const body = JSON.parse(fixture("pappers-entreprise.json"))
  const { items, snapshot } = parsePappersCompany(body, "2026-08-01", null, "2026-10-28")
  assert.deepEqual(snapshot, { capital: 15000, closed: false })
  assert.deepEqual(items.map((i) => i.title), [
    "Pappers: Documents filed (Procès-verbal d'assemblée générale extraordinaire, Statuts mis à jour) – JEMBA",
    "Pappers: New Directeur général – JEMBA",
  ])
  const [actes, director] = items
  assert.equal(actes.source, "pappers")
  assert.equal(actes.sourceName, "Pappers")
  assert.equal(actes.excerpt, "Augmentation du capital social")
  assert.equal(actes.publishedAt, "2026-10-09T00:00:00.000Z")
  assert.equal(actes.url, "https://www.pappers.fr/entreprise/912345678#actes-2026-10-09-proces-verbal-d-assemblee-generale-extraordinaire-statuts-mi")
  assert.equal(director.url, pappersUrl("912345678", "dirigeant-2026-10-02-leo-dupre"))
  assert.equal(director.excerpt, "Léo Dupré, Directeur général, since 2026-10-02")
})

test("parsePappersCompany reports a capital change and a closure against the last snapshot", () => {
  const body = { ...JSON.parse(fixture("pappers-entreprise.json")), entreprise_cessee: true, date_cessation: "2026-10-20" }
  const first = parsePappersCompany(body, "2026-10-27", null, "2026-10-28")
  assert.equal(first.items.length, 0)   // nothing to compare with yet
  const { items } = parsePappersCompany(body, "2026-10-27", { capital: 12000, closed: false }, "2026-10-28")
  assert.deepEqual(items.map((i) => i.url), [
    "https://www.pappers.fr/entreprise/912345678#capital-15000",
    "https://www.pappers.fr/entreprise/912345678#cessation-2026-10-20",
  ])
  assert.match(items[0].excerpt, /from 12000 € to 15000 €/)
  assert.equal(parsePappersCompany(body, "2026-10-27", { capital: 15000, closed: true }, "2026-10-28").items.length, 0)
})

test("parsePappersWebhook turns a surveillance message into plain-language changes, leaving out routine ones", () => {
  const msg = parsePappersWebhook(JSON.parse(fixture("pappers-webhook-entreprises.json")))
  assert.equal(msg.event, "notifications.entreprises")
  assert.equal(msg.listId, "1234567890")
  assert.equal(msg.listName, "GAFA")
  assert.deepEqual(msg.leads, [])
  const [google] = msg.changes
  assert.equal(google.siren, "443061841")
  const byFragment = Object.fromEntries(google.items.map((i) => [i.url.split("#")[1], i]))
  assert.deepEqual(Object.keys(byFragment).sort(), [
    "acte-2023-10-02-proces-verbal-d-assemblee-changement-de-president",
    "capital-464884017",
    "depart-2019-05-03-manicle-paul",
    "dirigeant-2019-05-03-paul-manicle",
    "etablissement-2024-01-01-44306184100047",
    "forme-2024-01-01-societe-a-responsabilite-limitee-sarl",
    "justice-5364",
    "nom-2024-01-01-google-france",
    "objet-2024-01-01",
    "procedure-2023-10-02-6124",
    "role-2019-05-03-paul-manicle-gerant",
    "siege-2024-01-01-44306184100047",
    "statuts-2023-10-02",
  ])
  const capital = byFragment["capital-464884017"]
  assert.equal(capital.title, "Pappers: Share capital changed – GOOGLE FRANCE")
  assert.equal(capital.excerpt, "From 1,000,000 € to 464,884,017 €")
  assert.equal(capital.publishedAt, "2024-01-01T00:00:00.000Z")
  assert.equal(capital.source, "pappers")
  // DD/MM/YYYY dates and first names given as a list.
  assert.equal(byFragment["dirigeant-2019-05-03-paul-manicle"].publishedAt, "2019-05-03T00:00:00.000Z")
  assert.equal(byFragment["role-2019-05-03-paul-manicle-gerant"].excerpt, "Paul Manicle: From Commissaire aux comptes suppléant to Gérant")
  assert.equal(byFragment["procedure-2023-10-02-6124"].title, "Pappers: Liquidation judiciaire – GOOGLE FRANCE")
  // A company that is not closed, and an RCS status of "Inscrit", are not news.
  assert.ok(!google.items.some((i) => /closed|register/i.test(i.title)))
})

test("parsePappersWebhook reads a saved-search message: new companies become leads", () => {
  const msg = parsePappersWebhook(JSON.parse(fixture("pappers-webhook-veille.json")))
  assert.equal(msg.event, "notifications.veille")
  assert.deepEqual(msg.leads, [{ siren: "882572894", name: "HAYDN HARRIS CONSULTING", isNew: false }])
  assert.equal(msg.changes.length, 1)
  assert.deepEqual(msg.changes[0].items.map((i) => i.url.split("#")[1]), [
    "capital-464884017",
    "acte-2023-10-02-proces-verbal-d-assemblee-changement-de-president",
    "dirigeant-2019-05-03-paul-manicle",
  ])
  assert.equal(msg.changes[0].items[0].excerpt, "Now 464,884,017 €")
  assert.deepEqual(parsePappersWebhook({ evenement: "something.else" }).changes, [])
  assert.deepEqual(parsePappersWebhook(null).leads, [])
})

// ---------------------------------------------------------------- Claude's answer

const item = {
  source: "press_rss",
  url: "https://example.com/a",
  title: "Jemba raises €3M",
  excerpt: "Led by Elaia.",
  publishedAt: "2026-10-20T07:30:00.000Z",
  sourceName: "Maddyness",
}
const good = {
  is_about_company: true,
  confidence: 0.92,
  signal_type: "fundraising",
  title: "Jemba raises €3M seed round led by Elaia",
  description: "Jemba raised €3M in a round led by Elaia.",
  signal_date: "2026-10-20",
  strength: 4,
  funding_amount_eur: 3,
  funding_stage: "seed",
  investors: "Elaia",
  reasoning: "Names Jemba, Paris industrial ML startup.",
}

test("the schema requires every field and forbids extras", () => {
  assert.equal(ANALYSIS_SCHEMA.additionalProperties, false)
  assert.deepEqual([...ANALYSIS_SCHEMA.required].sort(), Object.keys(ANALYSIS_SCHEMA.properties).sort())
  assert.equal(ANALYSIS_SCHEMA.properties.signal_type.enum.length, 18)
})

test("a good answer validates unchanged", () => {
  const r = validateAnalysis(good, item, "2026-10-27")
  assert.ok("analysis" in r)
  assert.deepEqual(r.analysis, good)
  assert.ok(isUsable(r.analysis))
})

test("bad signal types and missing fields are refused", () => {
  assert.match(validateAnalysis({ ...good, signal_type: "rumour" }, item, "2026-10-27").error, /unknown signal_type/)
  assert.match(validateAnalysis({ ...good, title: "  " }, item, "2026-10-27").error, /title/)
  assert.match(validateAnalysis({ ...good, is_about_company: "yes" }, item, "2026-10-27").error, /is_about_company/)
  assert.ok("error" in validateAnalysis("text", item, "2026-10-27"))
})

test("a future signal date falls back to the publication date", () => {
  const r = validateAnalysis({ ...good, signal_date: "2027-03-01" }, item, "2026-10-27")
  assert.equal(r.analysis.signal_date, "2026-10-20")
  const noDate = validateAnalysis({ ...good, signal_date: "sometime" }, item, "2026-10-27")
  assert.equal(noDate.analysis.signal_date, "2026-10-20")
})

test("numbers are clamped and unknown funding values dropped", () => {
  const r = validateAnalysis({ ...good, confidence: 1.7, strength: 9, funding_amount_eur: -2, funding_stage: "mega" }, item, "2026-10-27").analysis
  assert.equal(r.confidence, 1)
  assert.equal(r.strength, 5)
  assert.equal(r.funding_amount_eur, null)
  assert.equal(r.funding_stage, null)
})

test("namesakes and low-confidence finds are not queued", () => {
  assert.ok(!isUsable(validateAnalysis({ ...good, is_about_company: false }, item, "2026-10-27").analysis))
  assert.ok(!isUsable(validateAnalysis({ ...good, confidence: 0.4 }, item, "2026-10-27").analysis))
})

test("the prompt carries the profile, recent signals and the item", () => {
  const p = buildPrompt({
    name: "Jemba", aliases: [], website: "https://jemba.ai", city: "Paris", description: "Industrial ML.",
    sectors: ["Industry"], recentSignals: [{ signal_type: "incorporation", signal_date: "2026-01-02", title: "Registered" }],
  }, item)
  assert.match(p, /Name: Jemba/)
  assert.match(p, /2026-01-02 · incorporation · Registered/)
  assert.match(p, /Title: Jemba raises €3M/)
  assert.match(p, /Published: 2026-10-20/)
})

// ---------------------------------------------------------------- duplicates

test("findPossibleDuplicate: same type within 21 days", () => {
  const existing = [
    { id: "s1", signal_type: "fundraising", signal_date: "2026-10-05" },
    { id: "s2", signal_type: "new_product", signal_date: "2026-10-20" },
  ]
  assert.equal(findPossibleDuplicate({ signal_type: "fundraising", signal_date: "2026-10-20" }, existing), "s1")
  assert.equal(findPossibleDuplicate({ signal_type: "fundraising", signal_date: "2026-11-30" }, existing), null)
  assert.equal(findPossibleDuplicate({ signal_type: "partnership", signal_date: "2026-10-20" }, existing), null)
  assert.equal(findPossibleDuplicate({ signal_type: "fundraising", signal_date: null }, existing), null)
})
