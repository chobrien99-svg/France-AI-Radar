# Technical taxonomy

Implementation notes for the *France AI Radar / The Navigator — Technical Taxonomy Implementation Handoff*. The taxonomy records where a startup sits in the AI stack, what it builds, which methods it uses, which data it handles and which domains it serves. It sits alongside the existing **sector** taxonomy (the market served), which is unchanged.

| File | What it is |
|---|---|
| `supabase/migrations/20261025_technical_taxonomy.sql` | Schema, seed vocabulary, legacy backfill (additive, safe to re-run) |
| `supabase/rollbacks/20261025_technical_taxonomy.sql` | Undo, never applied automatically |
| `supabase/tests/run_taxonomy_tests.sh` | Applies the migration twice to a throwaway local Postgres, runs 36 checks, rolls back, re-applies (`npm run test:db`) |
| `tests/taxonomy.test.mjs` | Filter-semantics tests using the handoff's example searches (`npm test`) |
| `lib/taxonomy.ts` | Labels for stored values; filter rules |
| `lib/technical-profile.ts` | Loads the vocabulary and a startup's classification |

## 1. Inventory (production, Navigator project, inspected 2026-10-25)

- The live app reads the **Navigator** Supabase project (`organizations`, ~6,000 startups, 42 of them in the AI Radar via `product_organizations` → `product_catalog.slug = 'ai-radar'`).
- `organizations.technology_layer` is enum `technology_layer_type` = `infrastructure, model, application, tooling, data, other`. (`supabase/schema.sql` in the repo is stale and lists different values.) 34 organizations have a value: 26 `application`, 7 `infrastructure`, 1 `tooling`.
- Legacy field usage in the app: admin form select, admin create/update APIs (written only when non-empty), both CSV exports. No page filters on it.
- Sectors: `sectors` + `organization_sectors` (`is_primary`, partial unique index for one primary). RLS: public read, admin write (`auth.uid() IN (SELECT id FROM profiles WHERE is_admin)`).
- `organization_tags`: free-form tags, Navigator-team read. Left untouched.
- `organization_profiles`: one row per organization (unique `organization_id`), narrative fields, Navigator-team read. The single-select technology fields were added here rather than in a new table.
- No existing evidence/provenance table (signals carry their own `source_url`), so each classification link carries its own evidence fields.
- `update_updated_at_column()` trigger function exists and is reused.
- No tables with the new names existed. The migration still checks, and stops if one appears with a different shape.

## 2. Schema

| Table | Purpose |
|---|---|
| `technical_layers` | The 12 primary layers. `slug` (stable), `label`, `description`, `display_order`, `is_active` |
| `technical_terms` | Specializations, methods, modalities, domains. One canonical `facet` per term, `family` (specialization groups), `parent_term_id`, `is_active`, `display_order` |
| `technical_term_aliases` | Synonyms/abbreviations for search. `normalized_alias` (lower-cased, trimmed, generated) is unique |
| `organization_technical_layers` | `is_primary` (≤ 1 per organization via partial unique index, zero allowed), plus secondary layers. Unique `(organization_id, layer_id)` |
| `organization_technical_terms` | `relationship_kind` = `develops` / `uses` / `researches`, `is_core`. Unique `(organization_id, term_id, relationship_kind)` |
| `organization_technology_claims` | Proprietary-technology flags. Unique `(organization_id, claim)` |
| `organization_profiles` + 4 columns | `ai_product_role`, `technology_positioning`, `technology_maturity` (CHECK-constrained text), `technology_differentiation` (≤ 1000 chars) |

Every link row has `evidence_status` (`verified` / `reported` / `inferred` / `unverified`, default `unverified`), `source_url` and `source_note`. Admin-entered links start as `reported`. Backfilled links are `inferred`.

**Retiring terms:** set `is_active = false`. Retired terms disappear from the editor's picker but stay on existing records. A term in use cannot be deleted (FK `RESTRICT`). Adding a term is a row insert in `technical_terms` (Supabase table editor or SQL); no schema change.

**Primary layer is not required** at database level or in the editor: unknown stays unset, and pages show "Not yet classified".

**RLS:** same model as sectors (public read, admin insert/update/delete). The app writes with the service role after its own admin check.

## 3. Canonical facet mapping

The handoff's seed lists overlap. Each concept gets one canonical facet; the other phrasing becomes an alias so search still finds it.

| Handoff phrase (list) | Canonical term (facet) | Why |
|---|---|---|
| Graph AI / Graph Neural Networks (spec) | Graph Neural Networks (method) | A learning approach; "Graph AI", "GNN" are aliases |
| Hybrid and Symbolic Reasoning (spec) | Symbolic Reasoning (method) | Same concept as the method; alias kept |
| Causal AI (spec) | Causal Inference (method) | Same concept; alias kept |
| Explainable AI (spec) | Explainability / Interpretability (method) | Handoff's normalization note; "XAI" alias |
| Predictive Modeling (spec) | Predictive Modeling (method) | Handoff's normalization note; added to methods |
| Probabilistic Modeling (spec) | Bayesian / Probabilistic Modeling (method) | Same concept |
| Physics-Informed Machine Learning (spec, 4.6) | Physics-Informed Machine Learning (method) | Listed in both; one term |
| Computational Biology (spec) | Computational Biology (domain) | Handoff's normalization note |
| Imitation and Reinforcement Learning (spec, 4.6) | Robot Learning (spec), alias | The methods exist separately (Imitation Learning, Reinforcement Learning); the robotics capability is Robot Learning |
| Retrieval-Augmented Generation (method) | Retrieval-Augmented Generation (spec) | Investors search for companies building RAG; "uses" covers consumers |
| Fine-Tuning (method) | Fine-Tuning and Post-Training (spec) | Same concept; "uses" covers consumers |

Kept as separate terms on purpose (different facets, different questions): *Genomics and Transcriptomics* (capability) vs *Genomic* / *Transcriptomic* (data); *Medical Imaging AI* vs *Medical Imaging* (data); *Drug Discovery AI* (what they build) vs *Drug Discovery* (field served); *Mechanistic Biology* (spec) vs *Mechanistic Modeling* (method); *Model Compression* vs *Model Distillation* (narrower method).

Hierarchy (`parent_term_id`): Coding, Computer-Use, Browser and Web, Vertical, and Autonomous Research Agents sit under **AI Agents**. Autonomous Scientific Agents sit under Autonomous Research Agents, and Digital Twins in Biology under Digital Twins. Filtering on a parent also matches its descendants. "Agentic AI" is an alias of AI Agents, not a term of its own.

Seed totals: 12 layers, 70 specializations, 16 methods, 18 modalities, 15 domains, 77 aliases.

## 4. Legacy backfill report

Only one mapping is unambiguous: **`application` on an AI Radar startup → primary layer AI-Native Applications**, stored as `inferred` with a note so it reads as unverified until reviewed. 18 startups: CineoAI, Framage, Granit, Lavernna, Morphism, Nextlab (Vigicap), Praxy.ai, Previously, PunkMarket, Skalrun AI, Sqalie, StreamClipping AI, Uncovr, UnitPort, Vauban-X, Vestia, Vinotech, Vocaneo. *Worth a second look:* UnitPort and Vauban-X may belong under Embodied AI & Robotics.

**Not mapped (needs an editor's call).** Suggestions only, nothing applied:

| Organization | Legacy | AI Radar | Suggested layer |
|---|---|---|---|
| Axone | infrastructure | yes | Compute & Hardware (neuromorphic chips) |
| Jemba | infrastructure | yes | AI-Native Applications? (industrial ML software) |
| Katrix.AI | infrastructure | yes | Embodied AI & Robotics? (perception for autonomous systems) |
| Neutrogen Technologies | infrastructure | yes | Unclear: tritium production, check AI relevance |
| Phyntec | infrastructure | yes | Unclear: blockchain + AI |
| Signéva | infrastructure | yes | Agent Infrastructure & Orchestration? (cognitive architecture) |
| Aurels | tooling | yes | AI Security, Safety & Governance (intent firewall for agents) |
| Mistral AI | infrastructure | no | Foundation Models |
| Agryco, Alan, Crosscall, HR Path, Locala, ManoMano, Sekoia, Yubo | application | no | Not AI Radar companies; mostly not AI-native, left unset |

Re-run the report at any time:

```sql
SELECT o.name, o.technology_layer, l.label AS primary_layer, x.evidence_status
FROM organizations o
LEFT JOIN organization_technical_layers x ON x.organization_id = o.id AND x.is_primary
LEFT JOIN technical_layers l ON l.id = x.layer_id
WHERE o.technology_layer IS NOT NULL
ORDER BY (x.id IS NULL) DESC, o.name;
```

## 5. Application changes

- **Admin editor** (`/admin/startups/[id]/edit`): a new *Technical classification* block below Sectors. Primary layer (nullable), secondary layers (excluding the primary), one keyboard-searchable picker per facet (matches labels, aliases and definitions; specializations grouped by family with definitions shown), relationship (develops/uses/researches), "core to the product", evidence status, source URL and note on every link, and proprietary-technology checkboxes with evidence. Each change saves on its own via `/api/admin/startups/[id]/technical`. The main form's legacy *Technology layer* select is replaced by Positioning, Product role, Maturity and Differentiation. The legacy column keeps its value.
- **Startup page:** a *Technical profile* section with the primary layer prominent, secondary layers separate, positioning/role/maturity, chips grouped by facet (★ = core; "uses", "inferred" and "unverified" are marked), claims and differentiation (claims and differentiation are blurred like other Professional fields). The *On file* box always states the technical layer, or "Not yet classified".
- **Database filters** (Professional, like Sector): Primary technical layer, *Include secondary layers*, Technical specializations (grouped by family), Core AI methods, Data modalities, Target domains, and *Develops it (not just uses it)*. Each group appears only once at least one startup is classified on it, so nothing changes visually before data exists. Filter state lives in the URL (`layer`, `layerscope=any`, `spec`, `method`, `modality`, `domain`, `develops=1`), so searches are shareable. Free-text search also matches term labels and aliases ("RAG", "Agentic AI", "VLA").
- **CSV exports:** the Database export adds primary/secondary layers and the four facets. The single-startup export adds a *Technical profile* section with relationship and evidence per row.

### Filter semantics

- Across dimensions: AND. Within one dimension: OR.
- Layer filter: primary only, unless *Include secondary layers* is ticked.
- *Develops it*: specializations and methods only match `develops` or `researches` links (handoff example 3). Modalities and domains are unaffected.
- A parent term matches its descendants.
- Unclassified startups never match a selected value. Each dimension offers an explicit *Unclassified* option once it is in use.
- Counts are over the whole Radar and use the same rules as filtering.

## 6. Rollout

1. Review this branch.
2. Back up first (Supabase dashboard → Database → Backups, or `pg_dump` of `public`).
3. Apply `supabase/migrations/20261025_technical_taxonomy.sql` to the Navigator project. Then check: 12 layers, 119 terms, 77 aliases, 18 backfilled links.
4. Deploy the app. (The code also tolerates the migration not having been applied yet: technical queries return nothing and the new UI stays hidden, while saving a classification would show an error.)
5. Classify representative companies (stealth, foundation model, agent, biology, infrastructure). Then check the editor's save/reload/clear, the profile display and the filters.
6. In a later, separately reviewed migration: deprecate `organizations.technology_layer` once nothing reads it.

There is no feature-flag system in the repo. The new filters stay invisible until data exists, which works as a natural gate.

## 7. Regression and rollback plan

- Existing routes, tables and columns are unchanged. The legacy layer is still exported (as "Technology Layer (legacy)").
- Checks run on this branch: `npm test` (9 filter tests), `npm run test:db` (36 database checks: seeds, idempotency, backfill, uniqueness, one primary, check constraints, FKs, `updated_at`, RLS for anon/member/admin, rollback and re-apply), `tsc`, `next build`.
- **Rollback:** run `supabase/rollbacks/20261025_technical_taxonomy.sql`. It drops the six new tables and four profile columns, which **deletes every classification entered since**, so export first if it matters. Then deploy the previous app version, or leave this one: it degrades to hiding the technical UI.
