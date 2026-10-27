# Signal monitoring

Every night the Radar checks each live AI Radar startup for news, has Claude
draft a signal for each credible find, and puts the drafts in a review queue
at **Admin › Signals**. Nothing reaches the public site until an admin
approves a draft. When a run finds something, admins get one email in the
morning.

## Where it looks

| Source | What it finds | Notes |
|---|---|---|
| **BODACC** (official register) | Capital increases, changes of directors, head-office moves, insolvency proceedings, deregistration | Needs a SIREN under the startup's Legal entities. Annual-accounts filings are skipped. Lags the real event by days to weeks. |
| **Tech press feeds** | Funding, launches, partnerships, hires | The list is in `lib/monitoring/feeds.ts`. A feed that stops working shows up in the run log. |
| **Google News** | Wider coverage, French and English, last 14 days | Unofficial feed; if Google changes it, the other two sources keep working. |

LinkedIn is not monitored: its terms forbid automated reading.

## What happens to each find

1. **Matching:** it must name the startup as whole words (or one of its "other names"), and contain none of its "ignore" words.
2. **Skipped if already seen:** anything already in the queue, or already used as the source of one of the startup's signals.
3. **Claude** (`claude-haiku-5-5` by default) reads the startup's profile and the item, and decides whether the item is really about this startup. If it is, Claude drafts the type, date, strength, a neutral title and description, and funding details when stated.
4. **Queued:** finds Claude rates below 50% confidence, or judges to be about a namesake, go to the **Dismissed by Claude** tab instead of the queue. That way they aren't read again, and you can still approve one if Claude got it wrong. The rest are queued. A draft is flagged **Possible duplicate** when the startup already has a signal of the same type within three weeks.

## Reviewing

On **Admin › Signals**, each draft shows the source link, Claude's reasoning and its confidence. Every field can be edited before you click **Approve**. Approving creates a normal signal, exactly as if it had been typed in by hand. For a fundraising draft, tick **Also add this to the startup's funding rounds** to create the funding round too; amounts are in millions of euros. **Reject** removes the draft from the queue, and the same article will not come back. If Claude can't read an item one night (for example, the Claude API is busy), the item is tried again the next night, including official register filings.

## Tuning a startup

The **Signal monitoring** box on each startup's edit page lets you:

- **switch the nightly check off** for that startup;
- add **other names** to search for (a brand or product name);
- add **ignore** words for namesakes. For example, a startup called "Axone" could ignore "neurone";
- **Check now**, which runs the whole check for that startup straight away. Use it after adding a startup or changing its names.

## Settings (Vercel environment variables)

| Variable | Needed | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key. Set a monthly spend limit in the Anthropic console. |
| `CRON_SECRET` | yes (already set) | Protects the nightly job's URL. |
| `RESEND_API_KEY` | for the email (already set) | Sends the morning digest. |
| `MONITOR_MODEL` | no | Another Claude model, e.g. `claude-sonnet-5-5`, if relevance needs more care. |
| `MONITOR_MAX_ANALYSES` | no | Claude calls per night; default 150. |

The schedule is in `vercel.json` (`/api/cron/monitor-signals`, 01:23 UTC). A run stops starting new startups after four minutes; the ones it didn't reach go first the next night.

## Checking it's healthy

The last run's summary is at the top of **Admin › Signals**. Click it for the list of problems, such as a feed that failed or an item Claude couldn't read. Every run is kept in the `monitoring_runs` table.
