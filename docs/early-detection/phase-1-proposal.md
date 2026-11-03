# Early Detection Engine — Phase 1 proposal (for review)

Status: **approved 3 November 2026**, with the decisions below. Phase 1 is built (see [`docs/early-detection.md`](../early-detection.md)); the migration goes to a staging copy first, then to production, each with the owner's go-ahead.
Prepared 2 November 2026 against *France AI Radar Early Detection Engine Handoff V2*.

Database inspection was **read-only**: the live Navigator project (`oxqpmtttgicvxmesrjzy`) was queried for tables, columns, row counts, enums and RLS policies. Nothing was written.

---

## 0. Summary

- The Radar already has the basics of an early-detection system for **companies**: a nightly job (BODACC, Pappers, press, Google News, then Claude), a private review queue (`signal_candidates`), run logs, and a "To vet" list of newly registered companies (`company_leads`). Approved items become ordinary company signals.
- What's missing is everything **before a company exists**: research projects, laureates, researchers and labs as things you can track, a source registry with immutable evidence, and identity matching. Everything in that pipeline today needs an `organization_id`.
- **The main constraint:** `organizations`, `people`, `organization_people`, `funding_rounds` and `program_*` can be read by **anyone holding the site's public key** (RLS policy `USING (true)`). So an unverified lead (a PhD student, a project name) must **not** be stored in those tables until an editor approves it, or it becomes public. Phase 1 therefore puts all new pre-company data in new **staff-only** tables, using the same pattern as `signal_candidates`.
- Phase 1 changes no existing table, page or URL. It adds 9 staff-only tables, one sample connector (i-PhD laureates), an ingestion runner, and a staff "Candidates" console. Public Signals and My Radar pages come in later phases. Phase 1 delivers their wireframes.
- Estimate: **13–18 development days** in 5 pull requests. See §7.

---

## 1. Current state: routes and features

### Public / subscriber routes
| Route | What it does | Notes |
|---|---|---|
| `/` | Home (map, radar visual) | |
| `/database` | **Companies** explorer: Startups and Founders tabs | Login required (`proxy.ts`). Filters run in memory over the 54 Radar companies, with state in the URL (`lib/radar-dataset.ts`) |
| `/startup/[slug]` | Company profile | Sections: Investor brief, Signal timeline, Product & market, Strategy, Legal, Technical profile, funding rounds, programs. Navigator-only companies are admin-only |
| `/founder/[slug]` | Founder profile | Admin-only for founders of Navigator-only companies |
| `/account` | Profile, billing, **watchlist**, **lists**, **alerts**, **saved searches** | |
| `/pricing`, `/contact`, `/privacy`, `/terms`, `/auth/*` | | |

### Staff routes (`/admin`, `profiles.is_admin`)
Dashboard, Startups (edit, import from a Claude draft), **Signals** (review queue for `signal_candidates`), **To vet** (`company_leads`), Founders, Users, Metrics.

### Jobs (`vercel.json`)
- `/api/cron/monitor-signals`, daily at 01:23 UTC: company signal monitoring plus lead scoring and research.
- `/api/cron/trial-emails`, daily at 08:00.
- `/api/webhooks/pappers` stores messages in `monitoring_inbox`.

### Filters (Companies)
Search, sector, stage, signal type, location, founder background, time window, plus the technical taxonomy (primary layer with an optional "include secondary" setting, "develops only", specialization, method, modality, domain, "Not yet classified"). OR within a facet and AND across facets already match the V2 rule. The CSV export uses the same filter code.

### Subscription tiers (`lib/subscription.ts`)
| | Explorer | Professional | Enterprise |
|---|---|---|---|
| Company cards | 50 | all | all |
| Full profiles | 3/month | unlimited | unlimited |
| Advanced filters, save, lists, alerts, CSV | no | yes | yes |

Enterprise currently behaves exactly like Professional. Admins and active trials get full access.

### Saved items: what actually works
| Feature | Table | Live rows | Reality |
|---|---|---|---|
| Watchlist (star) | `watchlist` | 6 | Works |
| Lists | `lists`, `list_items` | 2 | Works |
| Alerts ("notify me") | `alerts` | 5 | **Rows are saved but nothing sends them.** No code delivers user alerts |
| Saved searches | `saved_searches` | 0 | **Shown on /account, but nothing in the app creates one** |

The pricing page promises alerts that never arrive. My Radar should fix this first (Phase 4), and it could be a quick win sooner.

---

## 2. Live database inventory (Navigator project)

`supabase/schema.sql` in the repo is **stale** (dated April; its enums differ from live). The live state is listed here.

**Size:** 10,997 organizations (5,972 startups, 5,028 investors); 54 on the Radar (`product_organizations` → `ai-radar`); 5,070 people.

| Table | Rows | Read access (RLS) | Relevant to V2 |
|---|---|---|---|
| organizations | 10,997 | **public** | Canonical company; also labs (`organization_type` includes `university`, `research_lab`, `public_agency`) |
| people | 5,070 | **public** | Canonical person; has `google_scholar_url`, `github_url`; no ORCID |
| organization_people | 3,777 | **public** | Founder/role links |
| legal_entities | 3,989 | staff (FTJ email) | SIREN/SIRET |
| signals | 247 | staff; app reads via service role | Company signal timeline. `organization_id NOT NULL` |
| signal_candidates | 280 (95 pending) | service role only | Company review queue |
| organization_events | 1 | staff | Mostly unused |
| organization_relationships | 0 | staff | Has `spun_out_from`, `incubated_by` |
| programs / program_editions | 59 / 118 | **public** | Already includes i-Lab, i-Nov, i-PhD. **Duplicates:** "i-Lab", "iLab", "i-Lab (Concours d'innovation)", "Concours d'innovation i-Lab…" |
| program_organizations | 4,018 | **public** | i-Lab 2,242, i-Nov 758 already linked to organizations |
| grants | 17 | staff | Company-only, separate from `funding_rounds` |
| funding_rounds | 5,148 | **public** | `funding_stage` enum **includes `grant`**: grants could be counted as rounds (needs an audit) |
| patents / patent_inventors | 0 / 0 | staff | Exist, empty, company-only |
| articles / article_organizations | 0 | staff | Unused |
| person_experience | 1 | staff | Affiliations, nearly empty |
| person_merge_map / organization_merge_map | 1,372 / 1,952 | none | Records past merges (source_db, source_id) |
| monitoring_state / runs / inbox, company_leads | — | service role only | Existing detection plumbing |
| watchlist, lists, list_items, alerts, saved_searches | small | owner only | Org-only follows |

Staff read access uses `is_navigator_team()`, which checks for a confirmed `@frenchtechjournal.com` email. Writes use `profiles.is_admin`. Extensions: `pg_trgm`, `unaccent`, `pgcrypto` (enough for fuzzy name matching).

**Do not exist:** projects, external identities (ORCID/OpenAlex/RNSR/ROR), source registry, immutable source records, ingestion cursors, a generic candidate (not tied to a company), person/project/institution follows, monitor delivery state.

---

## 3. Gaps against the V2 specification

| V2 requirement | Today | Gap | Phase |
|---|---|---|---|
| Companies preserved | ✅ | none: Phase 1 doesn't touch it | — |
| Facets: awards/programs, institutions, grants, earliest evidence, recent signal type | signal type ✅; programs on the profile only | Filters | 2, 6 |
| Signals discovery route | Admin queue only, company-only | Public feed, pre-company signals | 2 |
| People / institution / project pages | Founder page only | Researcher, lab, project pages | 3 |
| Follow person / project / institution | Org watchlist only | Generic follows | 4 |
| Saved search monitors + digests | Table only; no create, no delivery | Whole feature | 4 |
| Staff investigation console | Company-only queue | Candidate queue with the 7 states, evidence, identity proposals, audit trail | **1** |
| Source registry, immutable evidence, cursors | Per-org run log | All of it | **1** |
| Separate event / published / first_seen / ingested dates | partly (`source_published_at`, `created_at`) | Systematic | **1** |
| Grants never shown as rounds | `funding_stage = 'grant'` exists | Audit plus a separate awards model | 1 (model), 6 |
| Tier entitlements for signals / people / monitors | Company gating only | New gates | 2–4 |

---

## 4. Revised information architecture and low-fidelity screens

Top nav (later phases): **Companies** (today's `/database`, URL unchanged) · **Signals** (`/signals`) · **My Radar** (`/radar`; `/account` keeps billing and profile) · Pricing.
New detail routes: `/project/[slug]`, `/person/[slug]` (`/founder/[slug]` kept and redirected later, or kept as-is), `/institution/[slug]`.
Staff: `/admin/candidates`, `/admin/candidates/[id]`, `/admin/sources`.

**Phase 1 builds only the staff screens.** The others are wireframes for approval.

### Staff: Candidates queue (`/admin/candidates`), built in Phase 1
```
Candidates   [New 12] [Under review 3] [Watching 8] [Approved] [Rejected] [Merged]
Source: [All ▾]  AI relevance: [any ▾]  Sort: [Newest evidence ▾]
───────────────────────────────────────────────────────────────────────────────
● NeuroSeg — AI segmentation of brain MRI            i-PhD 2025 · Grand Prix
  Project · Lab: ICM (proposed) · Person: J. Martin (2 possible matches)
  AI relevance: keywords "deep learning", "segmentation"   Evidence families: 1
  Event 2025-06-12 · Published 2025-07-01 · First seen 2026-11-03     [Open →]
```

### Staff: Candidate detail, built in Phase 1
```
NeuroSeg                                   State: New ▾  [Start review] [Watch]
Why surfaced: new i-PhD 2025 laureate, AI keywords in project summary   [Reject] [Merge…]
┌ Evidence (chronological) ─────────────────────────────────────────────┐
│ 2025-06-12 event · 2025-07-01 published · i-PhD dataset (Licence Ouverte)│
│ record id ipHD-2025-0412 · hash a1f3… · [original ↗] [raw record]       │
└────────────────────────────────────────────────────────────────────────┘
┌ Identity proposals ───────────────────────────────────────────────────┐
│ Person "Julie Martin" (laureate)                                       │
│   ○ people/julie-martin-3f2a — Navigator, founder of X — name match    │
│   ○ people/julie-martin — no shared affiliation                        │
│   ○ Keep unmatched (private)                     [Confirm] [Reject]    │
│ Lab "Institut du Cerveau (ICM)" → organizations/icm (research_lab)      │
│ Company: none. Not incorporated, per this source.                      │
└────────────────────────────────────────────────────────────────────────┘
Scores (triage aids, not facts): formation likelihood — · AI relevance 0.8 · evidence confidence 0.9
Audit trail: 2026-11-03 01:40 created by ingest run #57 …
```

### Signals card, Phase 2 (wireframe)
```
[PRE-COMPANY PROJECT] [Award]                       Verified by editor ✓
NeuroSeg wins i-PhD 2025 Grand Prix
What changed: PhD project in AI MRI segmentation won a national innovation award.
Why it matters: i-PhD laureates often incorporate within 12–24 months.
Event 12 Jun 2025 · Published 1 Jul 2025 · Source: MESR open data
People: Julie Martin · Lab: ICM · Company: not yet incorporated
                                                  [☆ Follow project] [Save search]
```

### My Radar, Phase 4 (wireframe)
```
My Radar   Following (14)   Saved searches (3)   Digest: Weekly, Mondays ▾
Following: Companies 9 · People 2 · Projects 2 · Institutions 1
Saved: "BioAI awards outside Île-de-France" · weekly · 2 new since last digest  [Pause]
```

---

## 5. Proposed database changes (Phase 1, additive only)

Principles: **no existing table or column changed; new tables are staff-only** (RLS on, no policies, `REVOKE ALL FROM anon, authenticated`; read and written only by admin API routes and cron via the service role, like `signal_candidates`). Safe to run twice, with a rollback file and DB tests (same pattern as `20261028_signal_monitoring.sql`).

Files: `supabase/migrations/20261110_early_detection_foundation.sql`, `supabase/rollbacks/…`, `supabase/tests/run_early_detection_tests.sh`.

| # | Table | Purpose | Key columns / constraints |
|---|---|---|---|
| 1 | `sources` | Source registry | `slug` unique, name, owner, url, access_method, license, commercial_use_ok, cadence, rate_limit, `enabled`, `cursor JSONB`, `last_success_at`, `consecutive_failures`, notes |
| 2 | `ingestion_runs` | Per-source run log | source_id, kind (cron/manual/backfill), started/finished, `cursor_before/after`, fetched / new / changed / unchanged / failed counts, `errors JSONB`, status |
| 3 | `source_records` | Immutable observations | source_id, `external_id`, url, `content_hash`, `payload JSONB`, `event_date`, `published_at`, `first_seen_at`, `ingested_at`, `last_seen_at`, `is_backfill`; **unique (source_id, external_id, content_hash)** so re-runs are no-ops and real changes keep history |
| 4 | `ingestion_failures` | Dead letter | run_id, source_id, external_id, raw, error, attempts, resolved_at |
| 5 | `projects` | Pre-company project (not an organization) | name, slug, summary, technical_focus, `commercialization_status` (research / maturation / awarded / incorporating / incorporated / abandoned / unknown), `organization_id` NULL until a verified company is linked, `first_evidence_date`, `is_public` default false |
| 6 | `project_links` | Project ↔ person / org / program edition / project | project_id; exactly one of person_id, organization_id, program_edition_id, related_project_id (CHECK); role, start/end, `status` (proposed / verified / rejected), source_record_id |
| 7 | `awards` | Awards and grants, never equity | award_type (prize / competition / grant / label / fellowship), program_edition_id, recipient project_id / person_id / organization_id, funder_organization_id, amount, currency, award_date, edition_year, source_record_id, `is_public` default false |
| 8 | `external_identities` | ORCID, OpenAlex, RNSR, ROR, HAL, IdRef, GitHub, SIREN… | entity_type (person / organization / project), entity_id, scheme, value, `status` (proposed / verified / rejected), source_record_id; unique (scheme, value, entity_type, entity_id) |
| 9 | `detection_candidates` + `candidate_evidence` + `candidate_subjects` + `candidate_events` | Private investigation object | **candidates:** kind (project / person / company), `state` ∈ {new, under_review, watching, approved_signal, verified_company, rejected, merged}, project_id, organization_id, merged_into_id, why_surfaced, three separate scores (`formation_likelihood`, `ai_relevance`, `evidence_confidence`), assigned_to. **evidence:** candidate_id, source_record_id, `evidence_family` (dedupe key for syndicated copies). **subjects** (identity proposals): role, `proposed_name`, `proposed_affiliation`, matched person_id / organization_id or none, match_basis, confidence, status. **events:** audit trail (actor, action, from/to state, note, at) |

**Why unconfirmed people stay inside `candidate_subjects` instead of `people`:** `people` is publicly readable. An unmatched laureate's name and lab are stored privately on the candidate. A `people` row is created or linked only when an editor confirms it (Phase 2 onward).

**Labs:** reuse `organizations` with `organization_type = 'research_lab' / 'university'`. Institutions are public facts, but Phase 1 still only *proposes* a match and does not create orgs automatically.

**Existing `grants` (17 rows):** left as-is in Phase 1. Proposal for Phase 6: back-fill into `awards` and keep `grants` as a compatibility view, if you approve.

**Not in Phase 1 (designed now, built in Phase 4):** a `follows` table (entity_type, entity_id; `watchlist` migrated or mirrored) and extra columns on the existing `saved_searches` (`scope`, `frequency`, `is_active`, `min_evidence`, `channel`, `last_sent_at`) plus a `notification_log` for dedupe.

---

## 6. Sample connector and ingestion (Phase 1 code, after approval)

**Sample source: i-PhD laureates** (MESR, data.gouv.fr id `610219d02cc8bb8ce8042cfd`; Licence Ouverte v2, commercial reuse allowed with attribution; last updated 2026-09-18; also on the ESR Opendatasoft portal). It's small, yearly, has a clear award date, describes projects that are pre-company by definition, and names people and labs.

**Adapter contract** (`lib/connectors/types.ts`):
```
listPage(cursor) -> { items, nextCursor }
externalId(item)  -> stable id
normalize(item)   -> { url, eventDate, publishedAt, title, people[], labs[], project, award }
```
**Runner** (`lib/connectors/run.ts`): hash each record, then insert-if-new (idempotent). It records counts and the cursor in `ingestion_runs`, retries 3 times with backoff, and sends failures to `ingestion_failures`. `is_backfill = true` on the first import, so historical laureates never count as "new". It then calls a deterministic **candidate builder**:
- AI relevance from keyword and taxonomy-alias matching (reuses `technical_term_aliases`), with matched terms stored as evidence;
- identity proposals by normalized name (`unaccent` + trigram) against `people` and `organizations` (research_lab / university / startup);
- **never** creates organizations, people, signals or `product_organizations` rows.

Claude summarization is optional and switched off in Phase 1.

**Scheduling:** new `/api/cron/ingest-sources` behind `CRON_SECRET` and the env flag `EARLY_DETECTION_ENABLED` (off by default), plus a "Run now" button in `/admin/sources`.

**Network note:** this cloud sandbox can't reach `data.enseignementsup-recherche.gouv.fr` (blocked by its network policy); Vercel production can. Tests use saved fixtures.

### Connector feasibility matrix (first pass; terms still to be verified)
| Source | Access | License / terms | Feasibility | Phase |
|---|---|---|---|---|
| i-PhD, i-Lab, i-Nov laureates (MESR) | Opendatasoft API / CSV | Licence Ouverte v2 (i-PhD verified; others to verify) | High | 1–2 |
| Startups ESR (fr-esr-startup-esr-france) | Opendatasoft API | Licence Ouverte (to verify) | High | 2 |
| scanR | API (Elastic) | Open (to verify) | Medium (rich IDs) | 2–3 |
| OpenAlex | REST API | CC0 | High | 3 |
| HAL | REST API | Open metadata | High | 3 |
| arXiv | OAI-PMH / API | metadata free; rate limits | High | 3 |
| ANR projects and partners | data.gouv CSV | Licence Ouverte | High | 3 |
| INSEE Sirene / recherche-entreprises | API (already used) | Open | High (exists) | 4 |
| INPI RNE | API, account needed | INPI terms | Medium | 4 |
| GitHub (public) | REST API, token | ToS; public only | Medium (rate limits) | 5 |
| Hugging Face | Hub API | ToS | Medium | 5 |
| Domains / RDAP | RDAP, CT logs | Varies | Low–medium | 5 |
| Horizon Europe (CORDIS / data.gouv) | CSV | Open | High | 6 |
| France 2030 laureates | info.gouv.fr pages | No API; scraping terms unclear | Low | 6 |
| INPI patents / EPO | Datasets / OPS API | Account and terms | Medium | 7 |
| Product Hunt | API | **Commercial use needs permission** | Blocked until permission | — |
| Evertrace pages | — | Reference only, not a data source | n/a | — |

---

## 7. Phased pull requests, tests and estimates (Phase 1)

| PR | Content | Tests | Estimate |
|---|---|---|---|
| 1 | Migration + rollback + DB tests (9 tables, RLS lockdown, constraints) | Applied twice to throwaway Postgres; anon/authenticated can't read any new table; rollback then re-apply | 2–3 days |
| 2 | Connector framework + i-PhD adapter + runner + cron route (flag off) | Fixture-based: idempotent re-run (0 new), changed record (new version, no "new" event), backfill flag, retry/dead-letter, cursor saved | 3–4 days |
| 3 | Candidate builder (AI relevance, identity proposals, evidence families) | Homonym produces 2 proposals and no auto-link; non-AI laureate is skipped; **no rows written to organizations / people / signals / product_organizations** | 2–3 days |
| 4 | Staff console: `/admin/candidates`, detail, state changes with audit trail, `/admin/sources` with run health | API tests on transitions (illegal ones refused); admin-only access | 4–5 days |
| 5 | Wireframes for Signals / My Radar / People / Project / Institution, plus the end-to-end acceptance script | **Acceptance:** one sample award becomes a private project candidate linked to a person, a lab and a source, and no public company is created; existing `npm test` and `/database`, `/startup` untouched | 2–3 days |

**Total: about 13–18 development days**, plus your review time. The handoff's "weeks 1–2" is tight but achievable if you approve quickly. Identity matching quality is the main thing that could stretch it.

---

## 8. Risks and rollback

| Risk | Mitigation |
|---|---|
| Unverified leads becoming public through public-read tables | All new data lives in staff-only tables; a test asserts the anon key can't read them; nothing is written to `people` or `organizations` automatically |
| Name collision: "Signals" (company timeline) vs the V2 Signals feed | Keep the `signals` table for the company timeline; the Phase 2 feed combines approved company signals with approved project signals |
| Historical import triggering "new" alerts | `is_backfill`, separate `first_seen_at`, no alert system in Phase 1 |
| Duplicate programs (four i-Lab variants) and 2,242 i-Lab orgs already imported by the Navigator | Phase 2 dedupe task; Phase 1 only *proposes* links |
| Grants counted as rounds (`funding_stage = 'grant'`) | Audit query in Phase 1 (read-only); `awards` model separate from equity |
| Homonyms (common French names) | Proposals only; editor confirms; stricter evidence for person ↔ company matches |
| Stale `schema.sql` misleading future work | Regenerate it from live as a separate small task |
| Vercel function time limits for large backfills | Paged runs with a saved cursor; resume next run |

**Rollback:** the feature flag off stops ingestion immediately. The admin pages are new routes (just hidden). The DB rollback file drops only the new tables. No existing data is touched, so there's nothing to restore.

---

## 9. Decisions needed from you

1. **Approve the Phase 1 scope** above (staff-only foundation and console; no public pages yet).
2. **First connector:** i-PhD (recommended) or i-Lab (bigger, but overlaps the 2,242 orgs the Navigator already imported)?
3. **Unconfirmed people stay private** inside candidates until an editor confirms them. OK?
4. **Migrations:** apply first to a Supabase branch/staging copy, then to Navigator production, with your go-ahead at each step. Note that the Navigator database is shared with The Navigator product.
5. **Alerts:** subscribers can currently save alerts that are never sent. Fix now as a separate quick win, or wait for My Radar (Phase 4)?
6. **Entitlements** (§9 of the handoff): confirm the Explorer "preview" of Signals, and whether Enterprise should differ from Professional.
7. **Editorial bar** for publishing a pre-company signal (for example, one official source is enough for an award, two independent sources for anything else).

---

## 10. Decisions (3 November 2026)

1. **Scope approved:** a staff-only foundation and console, with no public pages yet. The overall goal is a system that accumulates and matches signals from different sources to discover potential founders and startups. Nothing goes live to users without an administrator validating and publishing it, and administrators need a clear way to monitor the signals.
2. **First connector:** i-PhD.
3. **Unconfirmed people** stay private inside candidates until an editor confirms them.
4. **Migrations** are applied to a Supabase branch or staging copy first, then to Navigator production, with a go-ahead at each step. The database is shared with The Navigator.
5. **Alerts:** already fixed (France-AI-Radar#89).
6. **Entitlements:** Explorer gets a preview of Signals. Enterprise stays the same as Professional for now.
7. **Editorial bar:** editors decide case by case for now.

### What changed from the plan while building
- All five planned pull requests went into one, as separate commits, because each step depends on the previous one.
- `source_records.processed_at` was added, so a candidate whose creation was interrupted is finished by the next read instead of being skipped.
- **Founding likelihood** is shown but not scored in Phase 1, since there is nothing yet to base it on. AI relevance and evidence confidence are scored.
- Gender, which the i-PhD dataset includes, is not stored.
