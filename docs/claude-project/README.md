# Claude Project: startup drafting and import

**Files**
- `France_AI_Radar_Startup_Template.md`: the file to upload into the Claude Project's files. Generated; do not edit by hand.
- `template-source.md`: the instructions and output format (Parts 1–3). Edit this one.
- `sectors.json`: sector names as in the `sectors` table.

**Workflow**
1. In the Claude Project, upload a startup's documents and ask for a draft.
2. Claude returns a readable draft (sections A–R) and ends with a JSON import block (section S).
3. In the site, open **Admin › Startups › Import from Claude draft**, paste the reply (whole or just the block), click **Check draft**, review the problems and the preview, then click **Create draft startup**.
4. The startup is created as a **Draft** with its profile, technical classification and evidence, founders, signals, grants, funding rounds, programs, legal entities and sectors. Review it in the editor, then publish.

The import is all-or-nothing: if any write fails, everything it created is removed. It blocks on an already-used slug, warns on a similar name, website domain or SIREN, and links an existing founder profile when the LinkedIn URL matches. Values it cannot map (an unknown term, sector or dropdown value) are skipped and listed, never guessed.

**Keeping it in sync.** The importer (`lib/startup-import.ts`) checks drafts against the live vocabulary. After adding or retiring terms, layers or sectors, or changing the example (`tests/fixtures/startup-draft.example.json`), rebuild the template and re-upload it to the Claude Project:

```
python3 scripts/build-claude-template.py
npm test   # checks the template's example still imports cleanly
```
