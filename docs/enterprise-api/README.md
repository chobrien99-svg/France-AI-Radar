# Enterprise API (Stage 1: read-only REST, pilot)

Read-only access to companies **published on France AI Radar** for licensed
Enterprise customers. Plan and decisions: `docs/enterprise-api/stage-0-audit.md`.

## Status

| | |
|---|---|
| Endpoints | `GET /v1/companies`, `/v1/companies/{id}`, `/v1/signals`, `/v1/signals/{id}`, `/v1/taxonomy`, `/v1/snapshot`, `/v1/changes`, `/v1/openapi.json` |
| Switched on? | **Off until a key is configured.** With `ENTERPRISE_API_KEYS` empty, every `/v1` URL answers 404. |
| Database changes | Stage 2 adds the change-feed tables and one function (`supabase/migrations/20261117_api_change_feed.sql`, rollback in `supabase/rollbacks/`). No trigger or change on existing tables. |
| Not yet | Per-customer accounts and usage metering (Stage 3), MCP (Stage 4). |

## Turning it on for a pilot

1. Issue a key (on any machine with the repo):
   ```bash
   node scripts/api-key.mjs acme-ventures
   ```
   It prints the key once, and an entry like `acme-ventures:3f9a…`.
2. In Vercel → project `france-ai-radar` → Settings → Environment Variables, set
   `ENTERPRISE_API_KEYS` to the entry (several entries comma-separated), for
   Preview first, then Production when you are ready. Redeploy.
3. Send the key to the customer over a secure channel. Only its hash is stored.

**Revoke** a key by removing its entry and redeploying.

## Using it

```bash
curl -H "Authorization: Bearer $FAR_API_KEY" "https://www.franceairadar.com/v1/companies?sector=artificial-intelligence&stage=seed&limit=20"
```

```bash
curl -H "Authorization: Bearer $FAR_API_KEY" "https://www.franceairadar.com/v1/companies/granit"
```

```bash
curl -H "Authorization: Bearer $FAR_API_KEY" "https://www.franceairadar.com/v1/signals?since=2026-10-01&type=fundraising"
```

- **Pagination:** responses carry `next_cursor`; pass it back as `cursor=` with the same filters. `limit` is 1–100 (default 50).
- **Sorting:** `/companies` takes `sort=updated_at` (default, newest first), `name` or `latest_signal_at`. Ties break on `id`, so pages never overlap.
- **Filters:** `q`, `sector`, `layer` (+ `layer_scope=any`), `term` (broader terms include narrower ones), `stage`, `city`, `updated_since`. Signals: `company_id`, `type`, `since`/`until` (signal date), `updated_since` (when added or edited). Valid values: `/v1/taxonomy`. Unknown parameters are rejected with `400 invalid_parameter`.
- **Errors:** `{ "error": { "code", "message", "request_id" } }` with codes `invalid_parameter`, `unauthorized`, `not_found`, `rate_limited` (with `Retry-After`), `internal`.
- **Limits:** 120 requests per minute per key (per server instance, a safety net until Stage 3 metering).
- **Units:** amounts in whole euros; timestamps UTC ISO 8601. `total_raised_eur` is the sum of the published rounds' disclosed amounts.

## Keeping a copy in sync (change feed)

1. `GET /v1/snapshot` → store `data.replay_cursor`.
2. Read every page of `/v1/companies` (and `/v1/signals` if you sync signals).
3. `GET /v1/changes?cursor=<replay_cursor>`; process the page; store `next_cursor`; repeat while `has_more`. Then poll every few minutes with the stored cursor.

For each change:
- `created` / `updated`: fetch the record at `href` and upsert it by `entity_id` (`changed_fields` lists what moved).
- `withdrawn` (no longer published) / `deleted`: remove or archive it. These events carry ids only.
- `merged`: the company now lives at `merged_into`; looking up the old id also returns the surviving company.

Guarantees: no gaps (events are numbered in commit order under a lock, and changes made while you read the snapshot are replayed); at least once (an event may arrive twice: dedupe on `event_id`, keep the highest `record_version`). History is kept 90 days; an older cursor returns `410 cursor_expired`, and you run the snapshot again.

How it works: every 10 minutes (and on demand when a client reads the feed and it is older than that), the server builds the public JSON of every published company and signal with the API's own serializer and records the differences against the last run. Customers therefore get events for exactly the fields they can see; editor-only edits never appear. Changing only `updated_at` produces no event, and renaming a company does not re-announce its signals.

## What is returned, and what never is

The field list lives in `lib/api/serialize.ts` and is checked against the
OpenAPI contract (`lib/api/openapi.ts`) by `tests/enterprise-api.test.mjs`.

- **Returned:** name, slug, Radar profile URL, descriptions, website and social links, location, founded year, stage, stealth flag, sectors, technology classification, founders (name, role, LinkedIn, short bio), published funding rounds with investors and public references (each round marked `compiled_by: "The French Tech Journal"`; links labelled by website; data-vendor links such as Pitchbook, Dealroom or Crunchbase never included), non-private programme memberships, editor-approved signals with source and evidence status.
- **Never returned:** drafts and Navigator-only companies, SIREN/SIRET and legal entities, emails and phone numbers, investor briefs and editor notes, detection candidates, private memberships, unpublished rounds, internal ids.
- **Open (decision D3):** signals cite their source (some are Pappers or LinkedIn). Confirm before the first external customer.

## Code map

| File | Role |
|---|---|
| `lib/api/load.ts` | The only database reader; applies the publication rule; 60-second cache |
| `lib/api/serialize.ts` | Field policy: internal record → public JSON |
| `lib/api/query.ts` | Filters, sorting, pagination (pure; reused by MCP later) |
| `lib/api/handler.ts` | Key check, switch-off, rate limit, errors, request id, logging |
| `lib/api/keys.ts`, `lib/api/cursor.ts`, `lib/api/params.ts` | Keys, opaque cursors, input validation |
| `lib/api/openapi.ts` | The contract, served at `/v1/openapi.json` |
| `app/v1/**/route.ts` | Thin route handlers |
