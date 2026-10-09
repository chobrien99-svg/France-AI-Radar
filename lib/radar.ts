import { SIGNAL_TYPE_LABELS } from "@/lib/subscription"

// ------------------------------------------------------------------
// Display helpers shared by the v2 database and profile pages
// ------------------------------------------------------------------

/** Colour per signal type (keys are the `signal_type` enum values) */
const SIGNAL_COLORS: Record<string, string> = {
  fundraising: "#B45E2E",
  key_hire: "#8A6A12",
  hiring_surge: "#8A6A12",
  talent_move: "#8A6A12",
  pivot: "#8A6A12",
  patent_filing: "#B23F3F",
  patent_ip: "#B23F3F",
  regulatory: "#B23F3F",
  restructuring: "#3E5D77",
  advisory_formation: "#3E5D77",
  conference: "#3E5D77",
  media_mention: "#3E5D77",
  new_product: "#3F6B54",
  product_launch: "#3F6B54",
  partnership: "#3F6B54",
  expansion: "#3F6B54",
  open_source: "#3F6B54",
  award: "#3F6B54",
  founder_departure: "#51575C",
  incorporation: "#51575C",
  other: "#51575C",
}

export function signalColor(type: string): string {
  return SIGNAL_COLORS[type] ?? "#51575C"
}

export function signalLabel(type: string): string {
  return SIGNAL_TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

/** Two-letter monogram, e.g. "NovaMind AI" → "NM", "Dr. Claire Dumont" → "CD" */
export function initials(name: string): string {
  const clean = name.replace(/^Dr\.?\s*/i, "").replace(/\.AI$/i, "").replace(/\sAI$/, "").trim() || name
  const words = clean.split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  const caps = clean.match(/[A-Z]/g) ?? []
  if (caps.length >= 2) return caps[0] + caps[1]
  return clean[0].toUpperCase() + (clean[1] ?? "").toLowerCase()
}

const TONES = ["dark", "light", "clay", "dark", "blue", "light"] as const
export type Tone = (typeof TONES)[number]

/** Stable monogram tile colour for a slug */
export function toneFor(slug: string): Tone {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

export function formatDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short", year: "numeric" })
}

/** "today", "4d ago", "5w ago", "3mo ago" */
export function relativeDate(iso: string | null): string {
  if (!iso) return "—"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days < 14) return `${days}d ago`
  if (days < 90) return `${Math.floor(days / 7)}w ago`
  if (days < 730) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function formatEur(amount: number | null): string {
  if (!amount) return "Undisclosed"
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`
  return `€${amount}`
}

/** Normalise the free-text `last_round` column into a stage label */
export function stageFrom(lastRound: string | null): string {
  const r = (lastRound ?? "").toLowerCase()
  if (!r.trim() || r.trim() === "—") return "Undisclosed"
  if (/pre[-\s]?seed/.test(r)) return "Pre-seed"
  if (/series\s*a/.test(r)) return "Series A"
  if (/series\s*[b-z]/.test(r)) return "Series B+"
  if (/seed/.test(r)) return "Seed"
  if (/grant|subvention|bpi/.test(r)) return "Grant"
  return "Other"
}

export type FounderFlags = {
  has_big_tech_background: boolean
  has_phd: boolean
  is_repeat_founder: boolean
  previous_exits: number | null
  academic_lab: string | null
}

/** Background tags shown on founder cards and used as a filter */
export function founderTags(f: FounderFlags): string[] {
  const tags: string[] = []
  if (f.has_big_tech_background) tags.push("Big Tech")
  if (f.has_phd) tags.push("PhD")
  else if (f.academic_lab) tags.push("Academic")
  if (f.is_repeat_founder) tags.push("Repeat")
  if ((f.previous_exits ?? 0) > 0) tags.push("Exit")
  return tags
}

/** Read a query-string value that may be repeated (?sector=a&sector=b) or comma-joined */
export function paramList(val: string | string[] | undefined): string[] {
  if (!val) return []
  return (Array.isArray(val) ? val : [val]).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean)
}

export function paramOne(val: string | string[] | undefined): string {
  return (Array.isArray(val) ? val[0] : val) ?? ""
}

/** Sort options for the database tabs (shared by the server page and the client toolbar) */
export const SORTS = {
  startups: [
    { value: "latest", label: "Latest signal" },
    { value: "az", label: "A–Z" },
    { value: "signals", label: "Most signals" },
  ],
  founders: [
    { value: "latest", label: "Latest signal" },
    { value: "az", label: "A–Z" },
  ],
} as const
