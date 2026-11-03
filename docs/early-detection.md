# Early detection (Phase 1)

The Radar can now look for possible founders **before they have a company**: research projects, competition laureates, PhD spinouts. Phase 1 is private. Nothing it finds reaches subscribers until an editor approves and publishes it, and publishing comes in a later phase.

The plan and the decisions behind it: [`docs/early-detection/phase-1-proposal.md`](early-detection/phase-1-proposal.md).

## How it works

1. **Sources** (Admin › Sources). Each source is read in full, and every item is kept as an unchangeable record. Reading the same item again adds nothing. If the publisher changes an item, the new version is stored next to the old one.
2. **Candidates** (Admin › Candidates). Items that mention AI clearly become *candidates*: private investigation files. Each one shows why it surfaced, the evidence with links to the original, and the people, labs and institutions the source names.
3. **Identity.** People and labs are only *suggested matches* to records already in the database, ranked by name similarity. Common names often have several matches. Nothing is linked until an editor clicks **Same**. A person who isn't in the database stays private on the candidate (**Not in our database**). No new person, company or Radar listing is created automatically.
4. **Decision.** Editors move a candidate between New, Under review, Watching, Approved (not published), Company verified, Rejected and Merged. Every move, note and identity decision is kept in the candidate's history with who did it and when.

Scores are there to sort the queue, not to decide:

- **AI relevance**: which AI terms the text uses (shown). One clear term (e.g. "apprentissage profond", "computer vision", "IA") puts it at 50%, the threshold for becoming a candidate. Related words ("algorithme", "robotique") add a little but can't reach the threshold on their own.
- **Evidence confidence**: how reliable the source is (an official government dataset is 90%).
- **Founding likelihood**: not assessed in Phase 1.

## First source: i-PhD laureates

| | |
|---|---|
| Publisher | Ministère de l'Enseignement supérieur, de la Recherche et de l'Espace, with Bpifrance |
| Data | [fr-esr-laureats-concours-i-phd](https://data.enseignementsup-recherche.gouv.fr/explore/assets/fr-esr-laureats-concours-i-phd/), about 300 laureates since 2020 |
| Licence | Licence Ouverte 2.0: commercial reuse allowed, with attribution |
| What's kept | Year, result, laureate, project name and summary, lab and its national code (RNSR), institutions, incubator, tech-transfer office, thesis number. **Gender is not kept.** |
| Not in the data | An award date (only the year), any company registration. The Radar never assumes a laureate has incorporated. |

## Running it

- **The first read is a history import.** On Admin › Sources, click **Import history**. Every laureate found is stored, and the AI-relevant ones become candidates marked *History import*, so they are never presented as news.
- **Later reads** (**Read now**, or the daily read) mark only genuinely new or changed items as new finds.
- **The daily read** runs at 02:47 UTC for sources switched on, and only if `EARLY_DETECTION_ENABLED=1` is set in Vercel. It is off by default.
- **Failures.** A download is tried 3 times before the read is logged as failed. Items that can't be read are listed on the Sources page and tried again on the next read. A source that keeps failing is flagged in red on both pages.

## Data and access

- **Migration:** `supabase/migrations/20261104_early_detection_foundation.sql`. Rollback: `supabase/rollbacks/20261104_early_detection_foundation.sql`. Tests: `npm run test:db`.
- **Access:** all 12 tables are staff-only. Row-level security is on with no policies, and the public and logged-in roles have no access, so only the server (admin pages and the daily read) can use them.
- **Awards** are stored separately from funding rounds. A prize or grant is never an equity round.
- **Code:** `lib/connectors/` (reading sources), `lib/detection/` (relevance, candidates, review actions), `app/admin/candidates`, `app/admin/sources`.

## Adding a source

1. Write a connector in `lib/connectors/` following `lib/connectors/types.ts`. It needs a stable `externalId` per item, what to store, and what to propose as a candidate.
2. Register it in `lib/connectors/registry.ts`.
3. Insert its row in `detection_sources`: owner, licence, whether commercial use is allowed, update rhythm.
4. Add a test with a synthetic sample file, like `tests/early-detection.test.mjs`.
