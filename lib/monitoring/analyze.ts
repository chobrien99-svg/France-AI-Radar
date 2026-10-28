import Anthropic from "@anthropic-ai/sdk"
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, buildPrompt, validateAnalysis, type Analysis, type CompanyContext } from "@/lib/monitoring/analysis"
import type { FoundItem } from "@/lib/monitoring/parse"

// Classification is a short, high-volume task, so a fast, inexpensive model
// at low effort is the default. MONITOR_MODEL switches it without a deploy
// (e.g. claude-sonnet-5-5 if relevance judgements need more care).
const MODEL = process.env.MONITOR_MODEL || "claude-haiku-5-5"

let client: Anthropic | null = null

export function analysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/** Asks Claude whether the item is about the startup and drafts the signal. */
export async function analyzeItem(
  company: CompanyContext,
  item: FoundItem,
  today: string,
): Promise<{ analysis: Analysis } | { error: string }> {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 2 })
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildPrompt(company, item) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
    })
    if (response.stop_reason === "refusal") return { error: "model declined to analyse this item" }
    if (response.stop_reason === "max_tokens") return { error: "answer was cut off" }
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return { error: "no answer" }
    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      return { error: "answer was not JSON" }
    }
    return validateAnalysis(parsed, item, today)
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: "ANTHROPIC_API_KEY is invalid" }
    if (err instanceof Anthropic.RateLimitError) return { error: "rate limited by the Claude API" }
    if (err instanceof Anthropic.APIError) return { error: `Claude API error ${err.status ?? ""}`.trim() }
    return { error: err instanceof Error ? err.message : "analysis failed" }
  }
}
