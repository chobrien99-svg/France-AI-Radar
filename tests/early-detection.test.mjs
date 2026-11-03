// Early Detection, Phase 1: the i-PhD connector, the import runner and the
// candidate builder, against an in-memory database and a canned download.
// The sample file is synthetic (invented names) in the shape of the real
// Opendatasoft export. Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fakeSupabase } from "./fake-supabase.mjs"
import { parseCsv } from "@/lib/connectors/csv"
import { iphdAdapter, IPHD_EXPORT_URL } from "@/lib/connectors/iphd"
import { runSource, contentHash } from "@/lib/connectors/run"
import { scoreAiRelevance } from "@/lib/detection/relevance"

const CSV = readFileSync(new URL("./fixtures/early-detection/iphd.csv", import.meta.url), "utf8")
const noSleep = async () => {}
const PUBLIC_TABLES = ["organizations", "people", "organization_people", "signals", "product_organizations", "funding_rounds", "legal_entities", "program_organizations"]

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Stand-ins for the two matching functions: share a word of the name.
const rpc = {
  detection_match_people: ({ p_name }, tables) => ({
    data: (tables.people ?? [])
      .filter((p) => fold(p.full_name).split(/\W+/).some((w) => w.length > 3 && fold(p_name).includes(w)))
      .map((p) => ({ id: p.id, full_name: p.full_name, slug: p.slug, score: fold(p.full_name) === fold(p_name) ? 1 : 0.6 })),
    error: null,
  }),
  detection_match_organizations: ({ p_name, p_types }, tables) => ({
    data: (tables.organizations ?? [])
      .filter((o) => (!p_types || p_types.includes(o.organization_type)) && fold(p_name).includes(fold(o.name).slice(0, 20)))
      .map((o) => ({ id: o.id, name: o.name, slug: o.slug, organization_type: o.organization_type, score: 0.8 })),
    error: null,
  }),
}

function seed() {
  return {
    detection_sources: [{ id: "src-iphd", slug: "esr-iphd", enabled: false, cursor: null, last_success_at: null, consecutive_failures: 0 }],
    people: [
      { id: "p-1", full_name: "Hélène Durand", slug: "helene-durand" },
      { id: "p-2", full_name: "Hélène Durand-Petit", slug: "helene-durand-petit" },
    ],
    organizations: [
      { id: "o-isir", name: "Institut des systèmes intelligents et de robotique", slug: "isir", organization_type: "research_lab" },
      { id: "o-startup", name: "Institut des systèmes intelligents et de robotique SAS", slug: "isir-sas", organization_type: "startup" },
    ],
    programs: [{ id: "prog-iphd", slug: "i-phd", name: "i-PhD" }],
    program_editions: [{ id: "ed-2026", program_id: "prog-iphd", year: 2026 }],
    signals: [], product_organizations: [], organization_people: [], funding_rounds: [],
  }
}

function serve(body, status = 200) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    return new Response(typeof body === "function" ? body() : body, { status })
  }
  return { fetchImpl, calls }
}

const snapshot = (tables) => JSON.stringify(PUBLIC_TABLES.map((t) => tables[t] ?? []))

test("CSV reader: BOM, ';' delimiter, quoted semicolons, quotes and line breaks", () => {
  const rows = parseCsv(CSV)
  assert.equal(rows.length, 5)
  assert.ok("acronyme_du_projet" in rows[0] && "resultat" in rows[0] && "lien_vers_theses_fr" in rows[0], "headers normalized")
  assert.match(rows[0].resume_du_projet, /apprentissage profond; un réseau/)
  assert.match(rows[0].resume_du_projet, /\nPremier dispositif/)
  assert.match(rows[2].resume_du_projet, /un "jumeau numérique"/)
  assert.deepEqual(parseCsv("a,b\n1,\"x,y\"\n"), [{ a: "1", b: "x,y" }])
})

test("AI relevance: explainable terms, no false hits on French words", () => {
  assert.ok(scoreAiRelevance("Segmentation par apprentissage profond").score >= 0.5)
  assert.ok(scoreAiRelevance("Une IA qui prédit les pannes").terms.includes("IA"))
  assert.equal(scoreAiRelevance("Isolation via des panneaux; transformer le bâtiment; 10 ML de solution").score, 0)
  assert.equal(scoreAiRelevance("La biodiversité et la pharmacie").score, 0, "'ia' inside words doesn't count")
  const weakOnly = scoreAiRelevance("Un robot et un algorithme")
  assert.ok(weakOnly.score > 0 && weakOnly.score < 0.5, "related words alone stay below the threshold")
})

test("i-PhD connector: stable keys, gender left out, names cleaned", () => {
  const raw = parseCsv(CSV)
  const item = iphdAdapter.normalize(raw[0])
  assert.equal(item.externalId, "2026:neuroseg:helene-durand")
  assert.equal(item.editionYear, 2026)
  assert.equal(item.eventDate, null, "the dataset has no date, only a year")
  assert.equal(item.payload.prenom_nom, "Hélène Durand")
  assert.ok(!("sexe" in item.payload) && !("code_sexe" in item.payload))
  assert.equal(contentHash(item.payload), contentHash({ ...item.payload }), "hash ignores key order")
  assert.throws(() => iphdAdapter.normalize(raw[3]), /missing/)

  const draft = iphdAdapter.toCandidate(item)
  assert.equal(draft.kind, "project")
  assert.deepEqual(draft.subjects.map((s) => s.role), ["person", "lab", "institution", "institution", "support"])
  assert.deepEqual(draft.subjects[0].identifiers, { theses_fr: "s400001" })
  assert.deepEqual(draft.subjects[1].identifiers, { rnsr: "200918463J", paysage: "ERa8P" })
  assert.equal(draft.award.awardType, "competition")
})

test("acceptance: a sample award becomes a private project candidate linked to person, lab and source, with no public writes", async () => {
  const db = fakeSupabase(seed(), { rpc })
  const before = snapshot(db.tables)
  const { fetchImpl, calls } = serve(CSV)
  const s = await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl, sleep: noSleep })

  assert.equal(calls[0], IPHD_EXPORT_URL)
  assert.equal(s.status, "partial", "one row has no project name")
  assert.deepEqual(
    { fetched: s.fetched, new: s.newRecords, failed: s.failedRecords, created: s.candidatesCreated, notRelevant: s.notRelevant },
    { fetched: 5, new: 3, failed: 1, created: 2, notRelevant: 1 },
  )
  assert.equal(snapshot(db.tables), before, "no public table was written")

  const t = db.tables
  assert.equal(t.source_records.length, 3, "the duplicate row is stored once")
  assert.ok(t.source_records.every((r) => r.is_backfill), "first run is a history import")
  assert.ok(t.source_records.every((r) => r.processed_at), "all records handled")
  assert.equal(t.ingestion_failures.length, 1)

  const cand = t.detection_candidates.find((c) => c.title === "NEUROSEG")
  assert.ok(cand, "AI laureate became a candidate")
  assert.equal(cand.state ?? "new", "new")
  assert.equal(cand.kind, "project")
  assert.equal(cand.is_backfill, true)
  assert.ok(cand.ai_terms.includes("apprentissage profond"))
  assert.ok(!t.detection_candidates.some((c) => c.title === "GEOPOLY"), "non-AI laureate stored but not a candidate")

  const project = t.projects.find((p) => p.id === cand.project_id)
  assert.equal(project.commercialization_status, "awarded")
  assert.equal(project.organization_id, undefined, "no company created or linked")
  const award = t.awards.find((a) => a.recipient_project_id === project.id)
  assert.deepEqual([award.award_type, award.program_edition_id, award.category], ["competition", "ed-2026", "Lauréat"])
  assert.equal(t.project_links.filter((l) => l.project_id === project.id && l.program_edition_id === "ed-2026").length, 1)

  const evidence = t.candidate_evidence.filter((e) => e.candidate_id === cand.id)
  assert.equal(evidence.length, 1)
  assert.equal(t.source_records.find((r) => r.id === evidence[0].source_record_id).external_id, "2026:neuroseg:helene-durand")

  const subjects = t.candidate_subjects.filter((x) => x.candidate_id === cand.id)
  const person = subjects.find((x) => x.role === "person")
  assert.equal(person.proposed_name, "Hélène Durand")
  assert.deepEqual(person.match_options.map((o) => o.slug), ["helene-durand", "helene-durand-petit"], "homonyms both proposed")
  assert.equal(person.matched_person_id, undefined, "never linked automatically")
  assert.equal(person.status, "proposed")
  const lab = subjects.find((x) => x.role === "lab")
  assert.deepEqual(lab.match_options.map((o) => o.slug), ["isir"], "lab matched among labs only")

  assert.equal(t.candidate_events.filter((e) => e.candidate_id === cand.id && e.action === "created").length, 1)
  const run = t.ingestion_runs[0]
  assert.deepEqual([run.status, run.candidates_created, run.failed_records], ["partial", 2, 1])
  assert.ok(t.detection_sources[0].last_success_at)
})

test("re-running the same file adds nothing; a changed item keeps both versions", async () => {
  const db = fakeSupabase(seed(), { rpc })
  await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  const counts = () => ["source_records", "detection_candidates", "projects", "awards", "candidate_subjects", "candidate_evidence"].map((k) => db.tables[k].length)
  const first = counts()

  const again = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  assert.deepEqual([again.newRecords, again.changedRecords, again.unchangedRecords, again.candidatesCreated], [0, 0, 3, 0])
  assert.deepEqual(counts(), first, "nothing duplicated")

  const edited = CSV.replace("Premier dispositif validé en clinique.", "Premier dispositif validé en clinique, essai multicentrique en cours.")
  const changed = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(edited).fetchImpl, sleep: noSleep })
  assert.deepEqual([changed.newRecords, changed.changedRecords, changed.candidatesCreated, changed.candidatesUpdated], [0, 1, 0, 1])
  const versions = db.tables.source_records.filter((r) => r.external_id === "2026:neuroseg:helene-durand")
  assert.equal(versions.length, 2, "old version kept")
  assert.equal(versions[1].is_backfill, false, "a change after the history import is news")
  const cand = db.tables.detection_candidates.find((c) => c.title === "NEUROSEG")
  assert.equal(db.tables.candidate_evidence.filter((e) => e.candidate_id === cand.id).length, 2)
  assert.ok(db.tables.candidate_events.some((e) => e.candidate_id === cand.id && e.action === "evidence_added"))
  assert.equal(db.tables.detection_candidates.length, first[1], "still one candidate per laureate")
})

test("a download that keeps failing is retried, then logged; nothing is stored", async () => {
  const db = fakeSupabase(seed(), { rpc })
  const waits = []
  const { fetchImpl, calls } = serve("unavailable", 503)
  const s = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl, sleep: async (ms) => { waits.push(ms) } })
  assert.equal(s.status, "failed")
  assert.equal(calls.length, 3, "three attempts")
  assert.deepEqual(waits, [2000, 8000])
  assert.match(s.errors[0], /3 attempts: HTTP 503/)
  assert.equal((db.tables.source_records ?? []).length, 0)
  assert.equal(db.tables.detection_sources[0].consecutive_failures, 1)
  assert.equal(db.tables.detection_sources[0].last_success_at, null)
  assert.equal(db.tables.ingestion_runs[0].status, "failed")
})

test("a candidate interrupted halfway is finished by the next run, not duplicated", async () => {
  const db = fakeSupabase(seed(), { rpc, failOn: "candidate_subjects" })
  const first = await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  assert.equal(first.failedRecords, 3, "the bad row and both AI candidates")
  assert.ok(db.tables.source_records.filter((r) => !r.processed_at).length === 2, "left for the next run")

  db.setFailOn(null)
  const second = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  assert.equal(second.candidatesUpdated, 2)
  assert.equal(db.tables.detection_candidates.length, 2, "no duplicate candidates")
  assert.equal(db.tables.projects.length, 2, "no duplicate projects")
  assert.ok(db.tables.candidate_subjects.length >= 2, "subjects added on the second run")
  assert.ok(db.tables.source_records.every((r) => r.processed_at))
  assert.equal(db.tables.candidate_events.filter((e) => e.action === "created").length, 2, "audit trail complete")
})

test("unknown or unregistered source fails clearly", async () => {
  const db = fakeSupabase({ detection_sources: [] }, { rpc })
  await assert.rejects(runSource(db.client, "nope", { kind: "manual", fetchImpl: serve("").fetchImpl }), /No connector/)
  await assert.rejects(runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve("").fetchImpl }), /not registered/)
})

test("review: allowed moves only, company link keeps the evidence, identity decisions are reversible and audited", async () => {
  const { changeState, decideSubject, addNote, ReviewError } = await import("@/lib/detection/review")
  const db = fakeSupabase(seed(), { rpc })
  await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  const before = snapshot(db.tables)
  const t = db.tables
  const cand = t.detection_candidates.find((c) => c.title === "NEUROSEG")
  cand.state = "new"
  const other = t.detection_candidates.find((c) => c.title === "PREDICTIA")
  other.state = "new"
  const editor = "admin-1"

  await assert.rejects(changeState(db.client, cand.id, "approved_signal", editor), ReviewError, "can't approve before review")
  await assert.rejects(changeState(db.client, cand.id, "published", editor), /Unknown state/)
  await changeState(db.client, cand.id, "under_review", editor, { note: "Checking the thesis." })
  assert.equal(cand.state, "under_review")
  assert.equal(cand.reviewed_by, editor)

  await assert.rejects(changeState(db.client, cand.id, "verified_company", editor), /slug/)
  await assert.rejects(changeState(db.client, cand.id, "verified_company", editor, { organizationSlug: "nope" }), /No organization/)
  await changeState(db.client, cand.id, "verified_company", editor, { organizationSlug: "isir-sas" })
  assert.equal(cand.organization_id, "o-startup")
  const project = t.projects.find((p) => p.id === cand.project_id)
  assert.deepEqual([project.organization_id, project.commercialization_status], ["o-startup", "incorporated"])
  assert.equal(t.candidate_evidence.filter((e) => e.candidate_id === cand.id).length, 1, "pre-company evidence kept")

  const person = t.candidate_subjects.find((s) => s.candidate_id === cand.id && s.role === "person")
  await assert.rejects(decideSubject(db.client, person.id, "confirm", editor, "o-isir"), /suggested matches/)
  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  assert.deepEqual([person.status, person.matched_person_id], ["confirmed", "p-1"])
  assert.equal(t.project_links.filter((l) => l.person_id === "p-1" && l.status === "verified").length, 1)
  assert.ok(t.external_identities.some((i) => i.entity_id === "p-1" && i.scheme === "theses_fr" && i.value === "s400001"))
  await decideSubject(db.client, person.id, "confirm", editor, "p-2")
  assert.equal(t.project_links.filter((l) => l.person_id === "p-1").length, 0, "changing the match removes the old link")
  await decideSubject(db.client, person.id, "unmatched", editor)
  assert.deepEqual([person.status, person.matched_person_id], ["unmatched", null])
  assert.equal(t.project_links.filter((l) => l.person_id).length, 0)

  await assert.rejects(changeState(db.client, other.id, "merged", editor, { mergeIntoId: other.id }), /another candidate/)
  await changeState(db.client, other.id, "merged", editor, { mergeIntoId: cand.id })
  assert.equal(other.merged_into_id, cand.id)
  assert.ok(t.candidate_events.some((e) => e.candidate_id === cand.id && e.action === "merge_received"))
  await changeState(db.client, other.id, "under_review", editor)
  assert.equal(other.merged_into_id, null, "reopening clears the merge")

  await assert.rejects(addNote(db.client, cand.id, editor, "  "), /empty/)
  await addNote(db.client, cand.id, editor, "Founder confirmed by phone.")
  const actions = t.candidate_events.filter((e) => e.candidate_id === cand.id).map((e) => e.action)
  assert.deepEqual(actions, ["created", "state_changed", "state_changed", "subject_confirmed", "subject_confirmed", "subject_unmatched", "merge_received", "note"])
  assert.equal(snapshot(db.tables), before, "review actions never write to public tables")
})
