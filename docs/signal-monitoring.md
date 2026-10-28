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
| **Pappers** (paid register data) | Documents filed at the registry (minutes of a capital increase, updated statutes; often weeks before BODACC), new directors, a change of share capital, closure | Needs a SIREN and `PAPPERS_API_KEY`. Each startup's record is read once every 14 days (1 credit, about €0.12 on a pay-as-you-go pack of 500 credits for €60): roughly 90 credits a month for 42 startups. **Check now** always reads it (1 credit). Annual accounts are skipped. |
| **Pappers alerts** (watch list, webhook) | The same register events as above, sent by Pappers as they happen | Free with the Starter subscription (up to 300 companies). Set `PAPPERS_WATCH_LIST_ID` and the run adds every Radar startup with a SIREN to that list. Once Pappers has sent its first message, watched startups are no longer read every 14 days. See "Pappers webhooks" below. |
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
- **Find on Pappers** (only shown when the startup has no SIREN): searches Pappers by name and lists up to five companies with their city, creation date and activity. Clicking **Use this one** saves that company as the startup's legal entity. Check the details first: names are often shared.
- **Check now**, which runs the whole check for that startup straight away. Use it after adding a startup or changing its names.

## Settings (Vercel environment variables)

| Variable | Needed | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key. Set a monthly spend limit in the Anthropic console. |
| `CRON_SECRET` | yes (already set) | Protects the nightly job's URL. |
| `RESEND_API_KEY` | for the email (already set) | Sends the morning digest. |
| `MONITOR_MODEL` | no | Another Claude model, e.g. `claude-sonnet-5-5`, if relevance needs more care. |
| `MONITOR_MAX_ANALYSES` | no | Claude calls per night; default 150. |
| `PAPPERS_API_KEY` | for Pappers | Pappers API key (moncompte.pappers.fr › API). Without it, Pappers is skipped. If the key is refused or the credits run out, the run log says so once and the other sources carry on. |
| `PAPPERS_WATCH_LIST_ID` | for Pappers alerts | ID of the Pappers surveillance list for Radar startups (shown in your Pappers account). |
| `PAPPERS_WEBHOOK_SECRET` | for Pappers alerts | Any long random string. It is part of the webhook address you give Pappers; messages without it are refused. |
| `PAPPERS_INTERVAL_DAYS` | no | Days between two reads of a startup's Pappers record; default 14. `0` stops the nightly reads (Check now still reads it). |

The schedule is in `vercel.json` (`/api/cron/monitor-signals`, 01:23 UTC). A run stops starting new startups after four minutes; the ones it didn't reach go first the next night.

## Checking it's healthy

The last run's summary is at the top of **Admin › Signals**. Click it for the list of problems, such as a feed that failed or an item Claude couldn't read. Every run is kept in the `monitoring_runs` table.

## Pappers webhooks

Pappers can post a message to the Radar instead of (or as well as) emailing you:

- **Surveillance list** (`notifications.entreprises`): a watched startup changed (capital, directors, documents filed, head office, closure, court decisions…). Each change goes through Claude and lands in **Signals to review**, labelled "Pappers (register)". Routine changes (activity code, trade names, accounts filed, BODACC notices already covered by the BODACC source) are left out.
- **Saved searches / alerts** (`notifications.veille`), such as "new SAS companies whose stated purpose mentions artificial intelligence": each company that newly matches goes to **Admin › To vet**, unless it is already on the site. Ignore it, or add it as a startup and mark it as added.

Webhook address to give Pappers (replace the secret with the value of `PAPPERS_WEBHOOK_SECRET`):

    https://www.franceairadar.com/api/webhooks/pappers?token=<PAPPERS_WEBHOOK_SECRET>

Messages are stored as received (table `monitoring_inbox`) and read by the next nightly run or **Check now**. A message about a startup outside that check waits for one that covers it. If Pappers sends the same message twice, nothing is added twice.

## Companies to vet

**Admin › To vet** lists companies found by your Pappers saved searches (or pasted in by hand with **Add companies by SIREN**, for example from a Pappers alert email), best first. Companies already on the site are left out.

Each night (after the signal check), and when you click **Check now**:

1. **Free first check.** Every new company is looked up in the government company directory (recherche-entreprises.api.gouv.fr: activity code, legal form, city, creation date, officers) and scored out of 100, starting at 50:
   - −30 consulting, IT-services or training activity (70.2x, 62.02/62.03/62.09, 74.90, 85.5x, 73.1x, 64.20);
   - −20 a word like CONSULTING, CONSEIL, PARTNERS, FORMATION, HOLDING, INVEST, GROUP or ADVISORY in the name;
   - +20 software or R&D activity (62.01, 58.2x, 72.1x, 63.1x);
   - +10 two or more officers (founders' personal holding companies count);
   - +10 another company among the officers (a studio, parent company or investor);
   - a solo founder or a domiciliation address is shown but not counted against.
   Companies registered in the last days may not be in the directory yet; they are looked up again every 3 days for 3 weeks.
   The directory also gives the **trading name** when it differs from the legal one (ORAKLIA TECHNOLOGIES trades as FIVE ANGELS), and for officers that are **holding companies** (FOURTICQ HOLDING…) the site looks up the people behind them, as you would by clicking through on Pappers.
2. **Web research.** The best-scored companies (score 40 or more) not yet researched are looked up on the web by Claude (`LEAD_RESEARCH_MODEL`, default `claude-sonnet-5-5`, with Anthropic's web search and web fetch: at most 5 searches and 3 pages read per company). It works the way an editor does: the legal name and town, then the founders' names together (including the people behind holdings), then any brand or product name that keeps coming up next to them, then the brand's own site (About or Team page) to confirm the team and collect the company's and founders' social links. A site put up last week is rarely in search results yet, so before the research starts the site tries the obvious addresses for the brand and the legal name (five-angels.com, fiveangels.fr, oraklia.ai…; free, nothing is read) and tells Claude which ones answer, skipping domains parked for sale. Claude opens the likely one and checks it is the same company.
   It returns a short summary, the brand it trades under, the website, people, profiles (LinkedIn, Instagram…) and other links, keeping only links the tools actually returned or that a page it read links to. "Looks like a startup" adds 20 points, "looks like a service business" takes 30 off; "not enough found yet" changes nothing. At most `LEAD_RESEARCH_PER_DAY` companies a day (default 10, about €0.08–0.12 each, so roughly €25–35 a month); **Research now** on a company runs it straight away. LinkedIn pages are never opened; profiles are only quoted from search results or from pages that link to them.

The score only orders the list: nothing is added, ignored or published automatically.

| Variable | Default | Purpose |
|---|---|---|
| `LEAD_RESEARCH_PER_DAY` | 10 | Companies researched on the web per day; `0` turns the research off. |
| `LEAD_RESEARCH_MODEL` | `claude-sonnet-5-5` | Model for the research (needs web search support). |
