# Enterprise API (Stage 1: read-only REST, pilot)

Read-only access to companies **published on France AI Radar** for licensed
Enterprise customers. Plan and decisions: `docs/enterprise-api/stage-0-audit.md`.

## Status

| | |
|---|---|
| Endpoints | `GET /v1/companies`, `/v1/companies/{id}`, `/v1/signals`, `/v1/taxonomy`, `/v1/openapi.json` |
| Switched on? | **Off until a key is configured.** With `ENTERPRISE_API_KEYS` empty, every `/v1` URL answers 404. |
| Database changes | None. The API reads with the server-side service client; no new grants or schemas. |
| Not yet | Change feed (`/v1/changes`, `/v1/snapshot`, Stage 2), per-customer accounts and usage metering (Stage 3), MCP (Stage 4). |

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

Until the change feed ships, a client can keep a CRM current by polling
`/v1/companies?updated_since=<last run>` and `/v1/signals?updated_since=<last run>`.
A company's `updated_at` moves when anything in its public record changes
(rounds, investors, founders, sectors, technology, programmes, signals).
Use `updated_since` for signals, not `since`: `since` filters on the signal's
own date, so a signal approved today about last month would be missed.
Polling does not report removals (a withdrawn company or deleted signal);
Stage 2's change feed does.

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
