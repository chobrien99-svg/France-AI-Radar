// Web research on one company to vet: Claude searches the web (Anthropic's
// server-side web search tool) for a website, the founders, a product,
// fundraising or press, and judges whether it looks like an AI product
// startup rather than a consultancy or a freelancer. LinkedIn is never
// fetched; public profiles only show up as ordinary search results.
import Anthropic from "@anthropic-ai/sdk"
import type { DirectoryFacts } from "@/lib/leads/parse"

// Web search with result filtering needs a Sonnet- or Opus-class model.
const MODEL = process.env.LEAD_RESEARCH_MODEL || "claude-sonnet-5-5"
/** Searches per company; each search is billed (about $0.01). */
const MAX_SEARCHES = 3

export type Research = {
  verdict: "startup" | "consultancy" | "unclear"
  confidence: number
  summary: string
  website: string | null
  founders: string[]
  links: { title: string; url: string }[]
  researchedWith: string
}

const SYSTEM = `You help the editors of the France AI Radar, a database of French AI startups, decide which newly registered companies to look at.
You get one company from the French register. Search the web for it and report what you find.
Look for: its website, its founders (public profiles in search results are fine; do not try to open LinkedIn), a product or demo, fundraising, incubator or accelerator programmes, and press coverage.
Then judge: "startup" if it builds its own AI product or technology; "consultancy" if it sells AI consulting, training, integration or freelance services, or is a holding or solo service business; "unclear" if there is not enough public information yet (common for companies registered in the last weeks).
Companies with the same name are common: only use results that match the company's city, founders or activity, and say so when unsure.
Be factual and brief. Never invent a website, a person or a link.`

const ANSWER_FORMAT = `

When you have finished searching, reply with only a JSON object (no prose, no code fence) with these keys:
- verdict (string, one of: startup, consultancy, unclear)
- confidence (number from 0 to 1)
- summary (string, two or three sentences in English: what it does and what evidence you found)
- website (string or null: the company's own site, only if found)
- founders (array of strings: "Name, role" for people found)
- links (array of {"title", "url"}: up to 5 of the most useful pages you found)`

function prompt(siren: string, name: string, facts: DirectoryFacts | null): string {
  const lines = [
    `Company: ${name}`,
    `SIREN: ${siren}`,
    facts?.createdOn && `Registered: ${facts.createdOn}`,
    facts?.legalForm && `Legal form: ${facts.legalForm}`,
    facts?.nafCode && `Activity code: ${facts.nafCode}${facts.nafLabel ? ` (${facts.nafLabel})` : ""}`,
    facts?.city && `City: ${facts.city}`,
    facts?.directors.length ? `Officers: ${facts.directors.map((d) => `${d.name}${d.role ? ` (${d.role})` : ""}`).join("; ")}` : null,
    "Its stated business purpose mentions artificial intelligence (that is why it was flagged).",
  ]
  return lines.filter(Boolean).join("\n") + ANSWER_FORMAT
}

const webUrl = (v: unknown) => (typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim().slice(0, 500) : null)
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

/** Checks Claude's answer; only links that appeared in the search results are kept. */
export function validateResearch(raw: unknown, seenUrls: Set<string>): Omit<Research, "researchedWith"> | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "answer was not an object" }
  const r = raw as Record<string, unknown>
  const verdict = r.verdict
  if (verdict !== "startup" && verdict !== "consultancy" && verdict !== "unclear") return { error: "unknown verdict" }
  const confidence = typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1 ? r.confidence : null
  if (confidence === null) return { error: "confidence missing" }
  const summary = text(r.summary, 1200)
  if (!summary) return { error: "summary missing" }
  const seen = (u: string | null) => (u && seenUrls.has(u) ? u : null)
  const website = webUrl(r.website)
  const host = (u: string) => {
    try {
      return new URL(u).host
    } catch {
      return null
    }
  }
  return {
    verdict,
    confidence,
    summary,
    // A website Claude names must be one of the pages the search returned, or on the same host.
    website: website && [...seenUrls].some((u) => host(u) === host(website)) ? website : null,
    founders: (Array.isArray(r.founders) ? r.founders : []).map((f) => text(f, 200)).filter((f): f is string => Boolean(f)).slice(0, 8),
    links: (Array.isArray(r.links) ? r.links : [])
      .map((l) => (l && typeof l === "object" ? { title: text((l as Record<string, unknown>).title, 200) ?? "", url: seen(webUrl((l as Record<string, unknown>).url)) } : null))
      .filter((l): l is { title: string; url: string } => Boolean(l?.url))
      .slice(0, 5),
  }
}

function extractJson(s: string): unknown {
  const start = s.indexOf("{")
  const end = s.lastIndexOf("}")
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object")
  return JSON.parse(s.slice(start, end + 1))
}

let client: Anthropic | null = null

export async function researchCompany(siren: string, name: string, facts: DirectoryFacts | null): Promise<Research | { error: string }> {
  client ??= new Anthropic({ timeout: 120_000, maxRetries: 1 })
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt(siren, name, facts) }]
  const tools: Anthropic.ToolUnion[] = [{
    type: "web_search_20260209",
    name: "web_search",
    max_uses: MAX_SEARCHES,
    user_location: { type: "approximate", country: "FR" },
  }]
  const seenUrls = new Set<string>()
  try {
    let response: Anthropic.Message | null = null
    // The server-side search loop can pause; resume it a couple of times at most.
    for (let turn = 0; turn < 3; turn++) {
      response = await client.messages.create({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages, tools, output_config: { effort: "low" } })
      for (const block of response.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) if (result.type === "web_search_result") seenUrls.add(result.url)
        }
      }
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
    const checked = validateResearch(parsed, seenUrls)
    return "error" in checked ? checked : { ...checked, researchedWith: MODEL }
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
