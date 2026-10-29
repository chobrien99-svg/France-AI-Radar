// Web research on one company to vet, done the way an editor would:
// search the legal name, then the founders' names (including the people
// behind founders' holding companies), look for a trading or product name
// that differs from the legal one, and open the brand's site to confirm the
// team. Uses Anthropic's server-side web search and web fetch tools, then
// judges whether it looks like an AI product startup rather than a
// consultancy or a freelancer. LinkedIn is never fetched; profiles are only
// quoted from search results or from pages that link to them.
import Anthropic from "@anthropic-ai/sdk"
import { describeOfficer, peopleOf, type DirectoryFacts } from "@/lib/leads/parse"
import { findWebsites } from "@/lib/leads/websites"

// Web search with result filtering needs a Sonnet- or Opus-class model.
const MODEL = process.env.LEAD_RESEARCH_MODEL || "claude-sonnet-5-5"
/** Searches per company; each search is billed (about $0.01). */
const MAX_SEARCHES = 5
/** Pages read per company (billed as tokens only). */
const MAX_FETCHES = 3

export type Research = {
  verdict: "startup" | "consultancy" | "unclear"
  confidence: number
  summary: string
  /** Trading or product name found online, when it differs from the legal name. */
  brand: string | null
  website: string | null
  founders: string[]
  /** Company or founder pages: LinkedIn, Instagram, X, GitHub, Welcome to the Jungle… */
  profiles: { label: string; url: string }[]
  links: { title: string; url: string }[]
  researchedWith: string
}

const SYSTEM = `You help the editors of the France AI Radar, a database of French AI startups, decide which newly registered companies to look at.
You get one company from the French register: its legal name, any trading name, town, activity and officers. Find out what it really is, the way an experienced editor would:
1. Search the legal name with the town, and any trading name given.
2. Founders often sit on the board through personal holding companies ("X HOLDING"); the people behind them are listed. Search the founders' names together, and each name with words like "IA", "intelligence artificielle", "startup" or the town.
3. New startups usually trade under a brand or product name that differs from the legal name, and the founders' own profiles are often not updated yet. Search the brand together with a founder's surname or the town, as a brand alone often matches unrelated companies. When a name keeps coming up next to the founders, search that name too.
4. A new site is often not in search results yet. When addresses built from the company's names are listed as answering, open the most likely one first. When you find the brand's or the company's website, open it (its home, About or Team page) to confirm the founders and to collect the company's social links and each founder's own profile (on team pages these are often links on photos or icons pointing to linkedin.com/in/...). When the site doesn't link a founder's profile, one search for the founder's name with "LinkedIn" usually finds it. Do not open LinkedIn pages; quote them only from search results or from pages that link to them.
Look for: website, founders, a product or demo, fundraising, incubator or accelerator programmes, press coverage.
Then judge: "startup" if it builds its own AI product or technology; "consultancy" if it sells AI consulting, training, integration or freelance services, or is a holding or solo service business; "unclear" if there is still not enough public information (common for companies registered in the last weeks).
Companies with the same name are common: only use results that match the town, the founders or the activity, and say so when unsure.
Be factual and brief. Never invent a website, a person or a link.`

const ANSWER_FORMAT = `

When you have finished searching, reply with only a JSON object (no prose, no code fence) with these keys:
- verdict (string, one of: startup, consultancy, unclear)
- confidence (number from 0 to 1)
- summary (string, two or three sentences in English: what it does and what evidence you found)
- brand (string or null: the trading or product name it uses online, if different from the legal name)
- website (string or null: the company's or brand's own site, only if found)
- founders (array of strings: "Name, role" for people found)
- profiles (array of {"label", "url"}: company pages such as LinkedIn, Instagram, X, GitHub, and each founder's own profile labelled "<Name>, LinkedIn", exactly as found)
- links (array of {"title", "url"}: up to 5 of the most useful other pages you found, such as press or programme pages)`

export function researchPrompt(siren: string, name: string, facts: DirectoryFacts | null, sites: string[] = []): string {
  const lines = [
    `Company: ${name}`,
    facts?.brand && `Trading name in the register: ${facts.brand}`,
    `SIREN: ${siren}`,
    facts?.createdOn && `Registered: ${facts.createdOn}`,
    facts?.legalForm && `Legal form: ${facts.legalForm}`,
    facts?.nafCode && `Activity code: ${facts.nafCode}${facts.nafLabel ? ` (${facts.nafLabel})` : ""}`,
    facts?.city && `City: ${facts.city}`,
    facts?.directors.length ? `Officers: ${facts.directors.map(describeOfficer).join("; ")}` : null,
    sites.length ? `Addresses built from its names that answer with a page (not checked; they may belong to someone else): ${sites.join(", ")}` : null,
    "Its stated business purpose mentions artificial intelligence (that is why it was flagged).",
  ]
  return lines.filter(Boolean).join("\n") + ANSWER_FORMAT
}

const webUrl = (v: unknown) => (typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim().slice(0, 500) : null)
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

/** What the tools actually returned: URLs of search results and fetched pages, and the text read. */
export type Evidence = { urls: Set<string>; text: string }

/**
 * Checks Claude's answer. A link is kept only when the search returned it,
 * a page it read links to it, or (for the website) a returned page is on
 * the same site. Anything else is dropped as possibly invented.
 */
export function validateResearch(raw: unknown, evidence: Evidence): Omit<Research, "researchedWith"> | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "answer was not an object" }
  const r = raw as Record<string, unknown>
  const verdict = r.verdict
  if (verdict !== "startup" && verdict !== "consultancy" && verdict !== "unclear") return { error: "unknown verdict" }
  const confidence = typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1 ? r.confidence : null
  if (confidence === null) return { error: "confidence missing" }
  const summary = text(r.summary, 1200)
  if (!summary) return { error: "summary missing" }
  const host = (u: string) => {
    try {
      return new URL(u).host.replace(/^www\./, "")
    } catch {
      return null
    }
  }
  const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "")
  const seen = (u: string | null) =>
    u && (evidence.urls.has(u) || [...evidence.urls].some((e) => bare(e) === bare(u)) || (bare(u).length >= 12 && evidence.text.includes(bare(u)))) ? u : null
  const website = webUrl(r.website)
  const listOf = (v: unknown, key: "title" | "label", max: number) =>
    (Array.isArray(v) ? v : [])
      .map((l) => (l && typeof l === "object" ? { name: text((l as Record<string, unknown>)[key], 200) ?? "", url: seen(webUrl((l as Record<string, unknown>).url)) } : null))
      .filter((l): l is { name: string; url: string } => Boolean(l?.url))
      .slice(0, max)
  return {
    verdict,
    confidence,
    summary,
    brand: text(r.brand, 120),
    // A website Claude names must be on the same site as a page the tools returned, or linked from one.
    website: website && ([...evidence.urls].some((u) => host(u) === host(website)) || seen(website)) ? website : null,
    founders: (Array.isArray(r.founders) ? r.founders : []).map((f) => text(f, 200)).filter((f): f is string => Boolean(f)).slice(0, 8),
    profiles: listOf(r.profiles, "label", 10).map((l) => ({ label: l.name, url: l.url })),
    links: listOf(r.links, "title", 5).map((l) => ({ title: l.name, url: l.url })),
  }
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
const bareUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase()

/**
 * Founders' LinkedIn profiles that the tools returned but the answer left
 * out (team pages often link them from an icon). A profile counts as a
 * founder's when its address contains their surname: linkedin.com/in/simon-fourticq-…
 */
export function founderProfiles(evidence: Evidence, people: string[], already: { url: string }[] = []): { label: string; url: string }[] {
  const urls = new Set([...evidence.urls, ...(evidence.text.match(/https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9%_-]+\/?/gi) ?? [])])
  const taken = new Set(already.map((p) => bareUrl(p.url)))
  const found: { label: string; url: string }[] = []
  const names = [...new Set(people.map((p) => p.trim()).filter(Boolean))]
  const parts = (name: string) => fold(name).split(/\s+/)
  const slugWords = (url: string) => {
    const slug = url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? ""
    try {
      return fold(decodeURIComponent(slug)).split(/[-_]/)
    } catch {
      return fold(slug).split(/[-_]/)
    }
  }
  for (const name of names) {
    const [first, ...rest] = parts(name)
    const surname = rest.at(-1) ?? ""
    if (surname.length < 3) continue
    // Two Cignonis: the first name must match too. A surname alone is enough when only one person has it.
    const shared = names.filter((n) => parts(n).at(-1) === surname).length > 1
    for (const url of urls) {
      const words = slugWords(url)
      if (!words.includes(surname) || (shared && !words.includes(first)) || taken.has(bareUrl(url))) continue
      taken.add(bareUrl(url))
      found.push({ label: `${name}, LinkedIn`, url })
    }
  }
  return found
}

function extractJson(s: string): unknown {
  const start = s.indexOf("{")
  const end = s.lastIndexOf("}")
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object")
  return JSON.parse(s.slice(start, end + 1))
}

/** Records the URLs and page text the server-side tools returned (search, fetch, and their filtering code). */
export function collectEvidence(content: Anthropic.ContentBlock[], evidence: Evidence): void {
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) if (result.type === "web_search_result") evidence.urls.add(result.url)
    } else if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
      evidence.urls.add(block.content.url)
      const source = block.content.content.source
      if (source.type === "text") evidence.text += `\n${source.data.slice(0, 200_000)}`
    } else if (block.type === "bash_code_execution_tool_result" && block.content.type === "bash_code_execution_result") {
      // Dynamic filtering runs code over the results; its output can carry the page text.
      evidence.text += `\n${block.content.stdout.slice(0, 200_000)}`
    }
  }
}

let client: Anthropic | null = null

export async function researchCompany(siren: string, name: string, facts: DirectoryFacts | null): Promise<Research | { error: string }> {
  client ??= new Anthropic({ timeout: 120_000, maxRetries: 1 })
  // Free: try five-angels.com and the like, since a week-old site rarely shows up in search yet.
  const sites = await findWebsites([facts?.brand, name]).catch(() => [])
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: researchPrompt(siren, name, facts, sites) }]
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES, user_location: { type: "approximate", country: "FR" } },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES, blocked_domains: ["linkedin.com"], max_content_tokens: 20_000 },
  ]
  const evidence: Evidence = { urls: new Set(), text: "" }
  try {
    let response: Anthropic.Message | null = null
    // The server-side search loop can pause; resume it a couple of times at most.
    for (let turn = 0; turn < 3; turn++) {
      response = await client.messages.create({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages, tools, output_config: { effort: "low" } })
      collectEvidence(response.content, evidence)
      if (response.stop_reason !== "pause_turn") break
      messages.push({ role: "assistant", content: response.content })
    }
    if (!response) return { error: "no answer" }
    if (response.stop_reason === "refusal") return { error: "the model declined" }
    if (response.stop_reason === "max_tokens") return { error: "answer was cut off" }
    const answer = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("\n")
    let parsed: unknown
    try {
      parsed = extractJson(answer)
    } catch {
      return { error: "answer was not JSON" }
    }
    const checked = validateResearch(parsed, evidence)
    if ("error" in checked) return checked
    const people = [...peopleOf(facts), ...(facts?.directors ?? []).flatMap((d) => d.people ?? []), ...checked.founders.map((f) => f.split(",")[0])]
    return { ...checked, profiles: [...checked.profiles, ...founderProfiles(evidence, people, checked.profiles)].slice(0, 10), researchedWith: MODEL }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: "ANTHROPIC_API_KEY is invalid" }
    if (err instanceof Anthropic.RateLimitError) return { error: "rate limited by the Claude API" }
    if (err instanceof Anthropic.APIError) return { error: `Claude API error ${err.status ?? ""}: ${err.message.replace(/\s+/g, " ").slice(0, 200)}` }
    return { error: err instanceof Error ? err.message : "research failed" }
  }
}

/** Research moves the first-pass score: evidence of a product up, a service business down. */
export function researchAdjustment(r: Pick<Research, "verdict" | "confidence">): { points: number; reason: string } | null {
  if (r.confidence < 0.5 || r.verdict === "unclear") return null
  return r.verdict === "startup"
    ? { points: 20, reason: "+20 web research: looks like an AI product startup" }
    : { points: -30, reason: "-30 web research: looks like a consultancy or service business" }
}
