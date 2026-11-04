# Embeddable cohort infographics

A live, interactive graphic for one programme edition (a cohort), built to be embedded in articles on other sites.

**Address:** `https://www.franceairadar.com/embed/program/<edition-slug>`, for example `/embed/program/future-40-2026`.

## What it shows

Every company linked to the edition (`program_organizations`), with filters by theme, base and a search box. Six charts redraw with the filters: themes, founding years, funding stage, base, backers that appear twice or more, and every disclosed round. Clicking a company opens its card: description, base, founding year, founders, rounds, backers, programmes, website, and links to our own coverage.

The data is read from the database on every load, so editors' changes show straight away. Only public facts are shown: no SIREN, email, phone or notes.

| On the graphic | Where it comes from |
|---|---|
| Theme | `program_organizations.group_label` on the company's membership of that edition (empty = "Other"). Editors can change it per cohort. Up to 8 themes get a colour. |
| Based | `organizations.country` plus legal entities: a French company; a foreign parent (main entity abroad) with the team in France; HQ abroad with a French entity; or HQ abroad. |
| Founded | `organizations.founded_year`, or the year the main legal entity was registered. |
| Funding stage | The furthest round reached (grants left out). A later undisclosed or strategic round doesn't take a company back. A company with no rounds and the tag "Bootstrapped" shows as bootstrapped. |
| Rounds | `funding_rounds`, in the currency announced (`currency_original` / `amount_original`), otherwise `amount_eur` (stored in millions). Grants without an amount are left out of the list. |
| Backers | Round investors, plus programmes of type accelerator (e.g. Y Combinator). "Business Angels" is left out. |
| Programmes | The company's other programme memberships. Memberships marked `verification_status = 'private'` (known to editors, not public) are never shown. |
| Founders | `organization_people` with `is_founder`. |
| Our coverage | The Radar profile when the company is on the Radar, and `funding_rounds.ftj_url` (French Tech Journal articles). |

## Publishing a new cohort

Nothing is embeddable until an editor turns it on. Add the edition to `lib/embed/editorial.ts` with `enabled: true`, a kicker, title and dek, and optionally headline figures credited to an outside source (e.g. Station F's own cohort figures). Company facts always come from the database, never from this file.

Then check the edition's companies have a theme (`group_label`), and open the address above.

## Embed code

Only administrators get the embed code: open the graphic's address directly on franceairadar.com while logged in as an admin, and click **Embed this graphic (admins only)** at the bottom. Readers never see the button, and it never appears inside an article.

```html
<iframe src="https://www.franceairadar.com/embed/program/future-40-2026" title="The Future 40, mapped (France AI Radar)" style="display:block;width:max(100%,75vw);max-width:100vw;margin-left:calc((100% - max(100%,75vw)) / 2);min-height:900px;border:0" loading="lazy"></iframe>
<script>addEventListener("message",function(e){if(e.origin!=="https://www.franceairadar.com"||!e.data||e.data.type!=="far-embed:height")return;document.querySelectorAll('iframe[src^="https://www.franceairadar.com/embed/"]').forEach(function(f){if(f.contentWindow===e.source)f.style.height=e.data.height+"px"})});</script>
```

- **Width:** the frame breaks out of the article column to 75% of the window, centred on the column, and is never narrower than the column (full width on phones). This assumes the article column is centred on the page.
- **Height:** the graphic tells the host page its height (`postMessage`, type `far-embed:height`) and the script resizes the frame, so readers never see a second scrollbar. Without the script it still works, at the `min-height`.

## Where it can be shown

Browsers only display the graphic inside pages from our own sites: frenchtechjournal.com and franceairadar.com (`Content-Security-Policy: frame-ancestors`, set in `next.config.ts` from `lib/embed/hosts.ts`). Copying the iframe code onto another site shows nothing. To allow another site (a staging site, a partner), add it to `EMBED_ALLOWED_ORIGINS` in the Vercel environment (comma-separated, e.g. `https://staging.frenchtechjournal.com`) and redeploy.

Embed pages show no cookie banner and load no analytics, and they are kept out of search results (`noindex`).

Code: `app/embed/program/[slug]/page.tsx`, `components/embed/cohort-infographic.tsx`, `lib/embed/cohort.ts`, `app/embed/embed.css`. Tests: `tests/embed-cohort.test.mjs`.
