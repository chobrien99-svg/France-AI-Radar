import Anthropic from "@anthropic-ai/sdk"
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, buildPrompt, validateAnalysis, type Analysis, type CompanyContext } from "@/lib/monitoring/analysis"
import type { FoundItem } from "@/lib/monitoring/parse"

// Classification is a short, high-volume task, so a fast, inexpensive model
// at low effort is the default. MONITOR_MODEL switches it without a deploy
// (e.g. claude-sonnet-5-5 if relevance judgements need more care).
const MODEL = process.env.MONITOR_MODEL || "claude-haiku-5-5"

// Used only if the API refuses the structured-output request: the same
// question, with the shape spelled out in the prompt instead.
const PLAIN_JSON_INSTRUCTION = `

Reply with only a JSON object (no prose, no code fence) with exactly these keys: ${ANALYSIS_SCHEMA.required.join(", ")}. Use null for unknown optional values.`

let client: Anthropic | null = null

export function analysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/** The API's own explanation, e.g. "output_config.format: ...", kept short for the run log. */
function apiMessage(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: unknown } } | undefined
  const msg = typeof body?.error?.message === "string" ? body.error.message : err.message
  return msg.replace(/\s+/g, " ").slice(0, 300)
}

/** First {...} block in a text answer (a model may wrap JSON in prose or a fence). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object")
  return JSON.parse(text.slice(start, end + 1))
}

/** Asks Claude whether the item is about the startup and drafts the signal. */
export async function analyzeItem(
  company: CompanyContext,
  item: FoundItem,
  today: string,
): Promise<{ analysis: Analysis } | { error: string }> {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 2 })
  const prompt = buildPrompt(company, item)

  const ask = async (structured: boolean) => {
    const response = await client!.messages.create(structured
      ? {
          model: MODEL,
          max_tokens: 4000,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: prompt }],
          output_config: { effort: "low", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
        }
      : {
          model: MODEL,
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt + PLAIN_JSON_INSTRUCTION }],
        })
    if (response.stop_reason === "refusal") return { error: "model declined to analyse this item" }
    if (response.stop_reason === "max_tokens") return { error: "answer was cut off" }
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return { error: "no answer" }
    let parsed: unknown
    try {
      parsed = structured ? JSON.parse(textBlock.text) : extractJson(textBlock.text)
    } catch {
      return { error: "answer was not JSON" }
    }
    return validateAnalysis(parsed, item, today)
  }

  const failure = (err: unknown, prefix = ""): { error: string } => {
    if (err instanceof Anthropic.AuthenticationError) return { error: "ANTHROPIC_API_KEY is invalid" }
    if (err instanceof Anthropic.RateLimitError) return { error: "rate limited by the Claude API" }
    if (err instanceof Anthropic.APIError) return { error: `${prefix}Claude API error ${err.status ?? ""}: ${apiMessage(err)}` }
    return { error: err instanceof Error ? err.message : "analysis failed" }
  }

  try {
    return await ask(true)
  } catch (err) {
    if (!(err instanceof Anthropic.BadRequestError)) return failure(err)
    // The request shape was refused (400). Log why, then try the plain form once.
    console.error("[monitoring] structured request refused:", apiMessage(err))
    try {
      return await ask(false)
    } catch (retryErr) {
      return failure(retryErr, `structured request refused (${apiMessage(err)}); plain retry: `)
    }
  }
}
