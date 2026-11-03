// What a source connector provides. A connector only reads and reshapes a
// source; storing, deduplicating and building candidates is the runner's job
// (lib/connectors/run.ts), so every source behaves the same way.

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** One item from a source, reshaped. `payload` is what gets hashed and stored. */
export type NormalizedItem = {
  /** Stable key for the same real-world item across runs. */
  externalId: string
  url: string | null
  title: string
  payload: Record<string, unknown>
  eventDate: string | null      // YYYY-MM-DD, only if the source gives one
  editionYear: number | null
  publishedAt: string | null    // ISO, only if the source gives one
}

export type SubjectDraft = {
  role: "person" | "lab" | "institution" | "support" | "company"
  name: string
  affiliation: string | null
  identifiers: Record<string, string>
}

/** What the connector proposes to investigate for one item. */
export type CandidateDraft = {
  sourceKey: string
  kind: "project" | "person" | "company"
  title: string
  summary: string | null
  /** Text the AI-relevance check reads. */
  relevanceText: string
  whySurfaced: string
  evidenceFamily: string
  evidenceConfidence: number | null
  firstEvidenceDate: string | null
  project: {
    name: string
    summary: string | null
    sector: string | null
    commercializationStatus: "research" | "maturation" | "awarded" | "unknown"
  } | null
  award: {
    awardType: "competition" | "prize" | "grant" | "label" | "fellowship" | "other"
    title: string
    programName: string
    programSlug: string | null
    category: string | null
    editionYear: number | null
    awardDate: string | null
    funderName: string | null
  } | null
  subjects: SubjectDraft[]
}

export type SourceAdapter = {
  slug: string
  /** Reads the whole source (or the next page after `cursor`). */
  fetchItems(fetchImpl: FetchLike, cursor: unknown): Promise<{ items: Record<string, string>[]; cursor: unknown }>
  normalize(raw: Record<string, string>): NormalizedItem
  toCandidate(item: NormalizedItem): CandidateDraft
}
