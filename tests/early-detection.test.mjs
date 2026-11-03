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
// The sample without its unreadable row (the "Anne Roux" line has no project name).
const CLEAN_CSV = CSV.split("\r\n").filter((l) => !l.includes("Anne;Roux")).join("\r\n")
const REPAIRED_CSV = CSV.replace("Anne;Roux;Anne Roux;;", "Anne;Roux;Anne Roux;CHEMIA;")
/** A laureate row in the export's 26 columns. */
const row = ({ year, first, last, project, summary }) =>
  [year, "8", "Lauréat", "", "", first, last, `${first} ${last}`, project, summary, "", "", "", "", "", "Bretagne", "", "", "", "", "", "", "", "Numérique", "", ""].join(";")
const NEW_LAUREATE = row({ year: "2027", first: "Léa", last: "Morel", project: "VISIONAGRI", summary: "Vision par ordinateur pour détecter les maladies des vignes." })
const withRow = (csv, line) => csv.replace(/\r\n$/, "") + "\r\n" + line + "\r\n"
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
  assert.deepEqual([run.status, run.candidates_created, run.failed_records, run.is_history_import], ["partial", 2, 1, true])
  assert.ok(t.detection_sources[0].last_success_at)
  assert.equal(t.detection_sources[0].history_complete, false, "an unreadable row keeps the source in history mode")
  assert.equal(t.ingestion_failures[0].external_id, "~2024:anne-roux", "the unreadable row can be recognised later")
})

test("re-running the same file adds nothing; a changed item keeps both versions and resurfaces as a new find", async () => {
  const db = fakeSupabase(seed(), { rpc })
  const first0 = await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CLEAN_CSV).fetchImpl, sleep: noSleep })
  assert.deepEqual([first0.status, first0.isHistoryImport, first0.historyComplete], ["succeeded", true, true])
  const counts = () => ["source_records", "detection_candidates", "projects", "awards", "candidate_subjects", "candidate_evidence"].map((k) => db.tables[k].length)
  const first = counts()

  const again = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(CLEAN_CSV).fetchImpl, sleep: noSleep })
  assert.equal(again.isHistoryImport, false)
  assert.deepEqual([again.newRecords, again.changedRecords, again.unchangedRecords, again.candidatesCreated], [0, 0, 3, 0])
  assert.deepEqual(counts(), first, "nothing duplicated")

  const cand0 = db.tables.detection_candidates.find((c) => c.title === "NEUROSEG")
  assert.equal(cand0.is_backfill, true)
  const before = cand0.last_evidence_at
  const edited = CLEAN_CSV.replace("Premier dispositif validé en clinique.", "Premier dispositif validé en clinique, essai multicentrique en cours.")
  const changed = await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(edited).fetchImpl, sleep: noSleep, now: () => new Date(Date.now() + 60_000) })
  assert.deepEqual([changed.newRecords, changed.changedRecords, changed.candidatesCreated, changed.candidatesUpdated], [0, 1, 0, 1])
  const versions = db.tables.source_records.filter((r) => r.external_id === "2026:neuroseg:helene-durand")
  assert.equal(versions.length, 2, "old version kept")
  assert.equal(versions[1].is_backfill, false, "a change after the history import is news")
  const cand = db.tables.detection_candidates.find((c) => c.title === "NEUROSEG")
  assert.equal(db.tables.candidate_evidence.filter((e) => e.candidate_id === cand.id).length, 2)
  assert.ok(db.tables.candidate_events.some((e) => e.candidate_id === cand.id && e.action === "evidence_added"))
  assert.equal(cand.is_backfill, false, "the update is a new find: shown under New finds, with the New find badge")
  assert.equal(cand.last_evidence_at, versions[1].first_seen_at, "sorted by its latest evidence")
  assert.ok(cand.last_evidence_at > before)
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

test("undoing or changing a confirmed match downgrades the identifiers it verified, unless another match still backs them", async () => {
  const { decideSubject } = await import("@/lib/detection/review")
  const db = fakeSupabase(seed(), { rpc })
  await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  const t = db.tables
  const editor = "admin-1"
  const cand = t.detection_candidates.find((c) => c.title === "NEUROSEG")
  cand.state = "under_review"
  const person = t.candidate_subjects.find((s) => s.candidate_id === cand.id && s.role === "person")
  const thesis = (id) => t.external_identities.find((i) => i.entity_type === "person" && i.entity_id === id && i.scheme === "theses_fr" && i.value === "s400001")

  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  assert.equal(thesis("p-1").status, "verified")

  // Homonym corrected: the thesis number no longer counts as verified for the wrong person.
  await decideSubject(db.client, person.id, "confirm", editor, "p-2")
  assert.equal(thesis("p-1").status, "rejected", "previous match's identifier downgraded")
  assert.equal(thesis("p-2").status, "verified")
  const changed = t.candidate_events.filter((e) => e.action === "subject_confirmed").at(-1)
  assert.deepEqual(changed.details.released.identifiers_downgraded, ["theses_fr:s400001→rejected"], "audit trail says what was undone")

  await decideSubject(db.client, person.id, "reject", editor)
  assert.equal(thesis("p-2").status, "rejected")

  // Re-confirming a match that was downgraded makes it verified again.
  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  assert.equal(thesis("p-1").status, "verified")

  await decideSubject(db.client, person.id, "reopen", editor)
  assert.equal(thesis("p-1").status, "proposed", "reopen means undecided, not wrong")
  assert.equal(t.project_links.filter((l) => l.person_id).length, 0)

  // A refused request changes nothing.
  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  await assert.rejects(decideSubject(db.client, person.id, "confirm", editor, "o-isir"), /suggested matches/)
  await assert.rejects(decideSubject(db.client, person.id, "nonsense", editor), /Unknown decision/)
  assert.deepEqual([person.status, person.matched_person_id, thesis("p-1").status], ["confirmed", "p-1", "verified"])
  assert.equal(t.project_links.filter((l) => l.person_id === "p-1").length, 1, "link kept after a refused request")

  // The same lab code backed by two candidates: undoing one keeps it verified for the other.
  const lab = t.candidate_subjects.find((s) => s.candidate_id === cand.id && s.role === "lab")
  const other = t.detection_candidates.find((c) => c.title === "PREDICTIA")
  const otherLab = { ...structuredClone(lab), id: "subject-shared-lab", candidate_id: other.id, status: "proposed", matched_organization_id: null }
  t.candidate_subjects.push(otherLab)
  const rnsr = () => t.external_identities.find((i) => i.entity_type === "organization" && i.entity_id === "o-isir" && i.scheme === "rnsr")
  await decideSubject(db.client, lab.id, "confirm", editor, "o-isir")
  await decideSubject(db.client, otherLab.id, "confirm", editor, "o-isir")
  await decideSubject(db.client, lab.id, "unmatched", editor)
  assert.equal(rnsr().status, "verified", "still backed by the other candidate's confirmed lab")
  assert.equal(t.project_links.filter((l) => l.project_id === cand.project_id && l.organization_id === "o-isir").length, 0, "this candidate's link removed")
  assert.equal(t.project_links.filter((l) => l.project_id === other.project_id && l.organization_id === "o-isir").length, 1, "the other candidate's link kept")
  await decideSubject(db.client, otherLab.id, "reject", editor)
  assert.equal(rnsr().status, "rejected", "downgraded once nothing backs it")
})

test("a partial history import stays in history mode until its unreadable rows are fixed", async () => {
  const db = fakeSupabase(seed(), { rpc })
  const t = db.tables
  const go = (csv) => runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(csv).fetchImpl, sleep: noSleep })

  const first = await go(CSV)
  assert.deepEqual([first.status, first.isHistoryImport, first.historyComplete], ["partial", true, false])

  // Still history mode: even a laureate appearing now is marked as history (conservative).
  const second = await go(withRow(CSV, NEW_LAUREATE))
  assert.deepEqual([second.isHistoryImport, second.historyComplete], [true, false])
  assert.equal(t.source_records.find((r) => r.external_id.startsWith("2027:")).is_backfill, true)

  // The publisher fixes the broken row: it is history, not news, and the history import completes.
  const third = await go(withRow(REPAIRED_CSV, NEW_LAUREATE))
  const repaired = t.source_records.find((r) => r.external_id === "2024:chemia:anne-roux")
  assert.equal(repaired.is_backfill, true, "a repaired historical row is never presented as news")
  assert.equal(third.failuresResolved, 2, "both earlier failures for that row resolved")
  assert.equal(third.historyComplete, true)
  assert.equal(t.detection_sources[0].history_complete, true)

  // From now on, new items are news.
  const fourth = await go(withRow(withRow(REPAIRED_CSV, NEW_LAUREATE), row({ year: "2027", first: "Hugo", last: "Petit", project: "DEEPSOIL", summary: "Apprentissage profond appliqué aux sols." })))
  assert.equal(fourth.isHistoryImport, false)
  assert.equal(t.source_records.find((r) => r.external_id === "2027:deepsoil:hugo-petit").is_backfill, false)
  const news = t.detection_candidates.find((c) => c.title === "DEEPSOIL")
  assert.equal(news.is_backfill, false, "listed as a new find")
})

test("an editor can dismiss unreadable rows to finish the history import; a failed download never finishes it", async () => {
  const { dismissFailures } = await import("@/lib/connectors/run")
  const db = fakeSupabase(seed(), { rpc })
  const t = db.tables

  const failed = await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve("down", 503).fetchImpl, sleep: noSleep })
  assert.deepEqual([failed.status, failed.historyComplete], ["failed", false])

  await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CSV).fetchImpl, sleep: noSleep })
  assert.equal(t.detection_sources[0].history_complete, false)
  const res = await dismissFailures(db.client, "esr-iphd", "all")
  assert.deepEqual([res.dismissed, res.complete], [1, true])

  await runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(withRow(CSV, NEW_LAUREATE)).fetchImpl, sleep: noSleep })
  assert.equal(t.source_records.find((r) => r.external_id.startsWith("2027:")).is_backfill, false, "news after the editor closed the history import")
  assert.equal(t.detection_sources[0].history_complete, true, "a row that fails again outside history mode doesn't reopen it")

  // An explicit "Re-import as history" marks what it finds as history again.
  const reimport = await runSource(db.client, "esr-iphd", { kind: "backfill", fetchImpl: serve(withRow(CSV, row({ year: "2027", first: "Zoé", last: "Lambert", project: "NEUROLANG", summary: "Modèles de langage pour l'aphasie." }))).fetchImpl, sleep: noSleep })
  assert.equal(reimport.isHistoryImport, true)
  assert.equal(t.source_records.find((r) => r.external_id.startsWith("2027:neurolang")).is_backfill, true)
})

test("a corrected source version updates people, labs and identifiers, and undoes decisions based on the old values", async () => {
  const { decideSubject } = await import("@/lib/detection/review")
  const db = fakeSupabase(seed(), { rpc })
  const t = db.tables
  const editor = "admin-1"
  let clock = Date.now()
  const go = (csv) => runSource(db.client, "esr-iphd", { kind: "cron", fetchImpl: serve(csv).fetchImpl, sleep: noSleep, now: () => new Date((clock += 60_000)) })
  await go(CLEAN_CSV)
  const cand = t.detection_candidates.find((c) => c.title === "NEUROSEG")
  const subjects = () => t.candidate_subjects.filter((s) => s.candidate_id === cand.id)
  const person = subjects().find((s) => s.role === "person")
  const oldLab = subjects().find((s) => s.role === "lab")
  const institutionIds = subjects().filter((s) => s.role === "institution").map((s) => s.id)
  const ident = (type, id, scheme, value) => t.external_identities.find((i) => i.entity_type === type && i.entity_id === id && i.scheme === scheme && i.value === value)
  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  await decideSubject(db.client, oldLab.id, "confirm", editor, "o-isir")
  assert.equal(ident("person", "p-1", "theses_fr", "s400001").status, "verified")
  assert.equal(ident("organization", "o-isir", "rnsr", "200918463J").status, "verified")

  // The publisher corrects the thesis number and the lab (same laureate, same external ID).
  const corrected = CLEAN_CSV.replaceAll("s400001", "s400009")
    .replace("Institut des systèmes intelligents et de robotique (ISIR)", "Laboratoire d'informatique de Paris 6 (LIP6)")
    .replace("200918463J", "199712604Z")
  const run = await go(corrected)
  assert.equal(run.changedRecords, 1)

  assert.deepEqual([person.status, person.matched_person_id, person.identifiers], ["proposed", null, { theses_fr: "s400009" }], "reviewer sees the corrected number, decision undone")
  assert.equal(person.proposed_affiliation, "Laboratoire d'informatique de Paris 6 (LIP6)")
  assert.equal(ident("person", "p-1", "theses_fr", "s400001").status, "rejected", "the corrected-away number is no longer verified")
  assert.equal(t.project_links.filter((l) => l.person_id === "p-1").length, 0)

  assert.ok(!t.candidate_subjects.includes(oldLab), "the lab the source no longer names is removed")
  assert.equal(ident("organization", "o-isir", "rnsr", "200918463J").status, "rejected")
  assert.equal(t.project_links.filter((l) => l.organization_id === "o-isir").length, 0)
  const newLab = subjects().find((s) => s.role === "lab")
  assert.deepEqual([newLab.proposed_name, newLab.identifiers.rnsr, newLab.status], ["Laboratoire d'informatique de Paris 6 (LIP6)", "199712604Z", "proposed"])
  assert.deepEqual(subjects().filter((s) => s.role === "institution").map((s) => s.id), institutionIds, "unchanged subjects are left alone")

  const ev = t.candidate_events.filter((e) => e.candidate_id === cand.id && e.action === "subjects_updated")
  assert.equal(ev.length, 1)
  assert.deepEqual([ev[0].details.changed.length, ev[0].details.removed.length, ev[0].details.added.length], [1, 1, 1])
  assert.equal(ev[0].details.changed[0].previous_status, "confirmed")

  // Re-confirming verifies the corrected number only.
  await decideSubject(db.client, person.id, "confirm", editor, "p-1")
  assert.equal(ident("person", "p-1", "theses_fr", "s400009").status, "verified")
  assert.equal(ident("person", "p-1", "theses_fr", "s400001").status, "rejected")

  // Only the affiliation changes: the decision is undone, but the unchanged number goes back to proposed, not rejected.
  await go(corrected.replace("Laboratoire d'informatique de Paris 6 (LIP6)", "LIP6 – Sorbonne Université"))
  assert.equal(person.status, "proposed")
  assert.equal(ident("person", "p-1", "theses_fr", "s400009").status, "proposed")

  // Reading the same version again changes nothing.
  const events = t.candidate_events.length
  await go(corrected.replace("Laboratoire d'informatique de Paris 6 (LIP6)", "LIP6 – Sorbonne Université"))
  assert.equal(t.candidate_events.length, events)
})

test("Company verified: only a startup or corporate can be linked, and leaving the state undoes the link", async () => {
  const { changeState } = await import("@/lib/detection/review")
  const db = fakeSupabase(seed(), { rpc })
  await runSource(db.client, "esr-iphd", { kind: "manual", fetchImpl: serve(CLEAN_CSV).fetchImpl, sleep: noSleep })
  const t = db.tables
  const editor = "admin-1"
  const cand = t.detection_candidates.find((c) => c.title === "NEUROSEG")
  cand.state = "under_review"
  const project = t.projects.find((p) => p.id === cand.project_id)
  t.organizations.push({ id: "o-fund", name: "Deep Fund", slug: "deep-fund", organization_type: "investor" })

  await assert.rejects(changeState(db.client, cand.id, "verified_company", editor, { organizationSlug: "isir" }), /research lab, not a company/)
  await assert.rejects(changeState(db.client, cand.id, "verified_company", editor, { organizationSlug: "deep-fund" }), /investor, not a company/)
  assert.deepEqual([cand.state, cand.organization_id, project.organization_id, project.commercialization_status], ["under_review", undefined, undefined, "awarded"], "a refused link changes nothing")

  await changeState(db.client, cand.id, "verified_company", editor, { organizationSlug: "isir-sas" })
  assert.deepEqual([cand.organization_id, project.organization_id, project.commercialization_status], ["o-startup", "o-startup", "incorporated"])

  // The company was wrong: back to review, then rejected.
  await changeState(db.client, cand.id, "under_review", editor, { note: "Wrong company." })
  assert.deepEqual([cand.organization_id, project.organization_id, project.commercialization_status], [null, null, "awarded"], "link undone, earlier status restored")
  const ev = t.candidate_events.filter((e) => e.candidate_id === cand.id && e.action === "state_changed").at(-1)
  assert.deepEqual([ev.details.company_unlinked.organization_id, ev.details.project_status_restored], ["o-startup", "awarded"])
  await changeState(db.client, cand.id, "rejected", editor)
  assert.deepEqual([cand.organization_id, project.organization_id], [null, null], "a rejected candidate asserts no company")
  assert.equal(t.candidate_evidence.filter((e) => e.candidate_id === cand.id).length, 1, "evidence kept throughout")
})
