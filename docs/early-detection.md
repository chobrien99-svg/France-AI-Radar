# Early detection (Phase 1)

The Radar can now look for possible founders **before they have a company**: research projects, competition laureates, PhD spinouts. Phase 1 is private. Nothing it finds reaches subscribers until an editor approves and publishes it, and publishing comes in a later phase.

The plan and the decisions behind it: [`docs/early-detection/phase-1-proposal.md`](early-detection/phase-1-proposal.md).

## How it works

1. **Sources** (Admin › Sources). Each source is read in full, and every item is kept as an unchangeable record. Reading the same item again adds nothing. If the publisher changes an item, the new version is stored next to the old one.
2. **Candidates** (Admin › Candidates). Each card shows the award edition (e.g. *i-PhD 2026*), and the queue can be filtered by edition year: for a yearly award, the latest cohort is the freshest signal, even though it arrived in the history import. Items that mention AI clearly become *candidates*: private investigation files. Each one shows why it surfaced, the evidence with links to the original, and the people, labs and institutions the source names.
3. **Identity.** People and labs are only *suggested matches* to records already in the database, ranked by name similarity. Common names often have several matches. Nothing is linked until an editor clicks **Same**. A person who isn't in the database stays private on the candidate (**Not in our database**). No new person, company or Radar listing is created automatically. Confirming also marks the source's identifiers (thesis number, lab RNSR code) as verified for that record. Undoing or changing a match reverses this: the link is removed and those identifiers are downgraded (*rejected* if the match was wrong, back to *proposed* on reopen), unless another confirmed match still backs them. If the publisher later corrects a name, affiliation or identifier, the candidate follows the latest version: affected decisions are undone and the person or lab goes back to *proposed* with the corrected details. A lab the source no longer names is removed. Each correction is logged in the candidate's history.
4. **Company verified** links the project to an existing startup or corporate (labs, investors and universities are refused). Moving the candidate out of that state removes the link and restores the project's earlier status.
5. **Brand, website, LinkedIn.** A project often uses a brand before it registers a company (i-PhD laureate TATOUAI trades as Izena). Editors add the brand name, website and LinkedIn page on the candidate page; the brand also shows in the queue. Addresses are tidied up (`izena.fr` becomes `https://izena.fr/`), the LinkedIn field only accepts linkedin.com pages, and every change is kept in the history. Like the rest of the candidate, these are private, and later source updates never overwrite them.
6. **Decision.** Editors move a candidate between New, Under review, Watching, Approved (not published), Company verified, Rejected and Merged. Every move, note and identity decision is kept in the candidate's history with who did it and when.

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
- **History mode lasts until the import is complete.** If some items can't be read, the source stays in history mode: everything it reads is still marked as history, including items that are fixed later. The import completes when every unreadable item has either been read correctly on a later run, or been dismissed with **Dismiss unreadable** (if the publisher later fixes a dismissed item in a way the Radar can't recognise, it will appear as a new find). The Sources page shows whether the import is complete.
- **Later reads** (**Read now**, or the daily read) mark only genuinely new or changed items as new finds. A candidate from the history import whose source item changes afterwards becomes a new find too. It moves under *New finds only*, gets the *New find* badge and rises to the top: the queue is sorted by latest evidence.
- **The daily read** runs at 02:47 UTC for sources switched on, and only if `EARLY_DETECTION_ENABLED=1` is set in Vercel. It is off by default.
- **Failures.** A download is tried 3 times before the read is logged as failed. Items that can't be read are listed on the Sources page and tried again on the next read. A source that keeps failing is flagged in red on both pages.

## Data and access

- **Migrations:** `supabase/migrations/20261104_early_detection_foundation.sql`, `20261105_early_detection_history_state.sql` and `20261106_project_brand_links.sql`, each with a rollback in `supabase/rollbacks/`. Tests: `npm run test:db`.
- **Access:** all 12 tables are staff-only. Row-level security is on with no policies, and the public and logged-in roles have no access, so only the server (admin pages and the daily read) can use them.
- **Awards** are stored separately from funding rounds. A prize or grant is never an equity round.
- **Code:** `lib/connectors/` (reading sources), `lib/detection/` (relevance, candidates, review actions), `app/admin/candidates`, `app/admin/sources`.

## Adding a source

1. Write a connector in `lib/connectors/` following `lib/connectors/types.ts`. It needs a stable `externalId` per item, what to store, and what to propose as a candidate.
2. Register it in `lib/connectors/registry.ts`.
3. Insert its row in `detection_sources`: owner, licence, whether commercial use is allowed, update rhythm.
4. Add a test with a synthetic sample file, like `tests/early-detection.test.mjs`.
