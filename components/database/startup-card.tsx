import Link from "next/link"
import { type Venture, tagStrengthLabel } from "@/lib/types"

type FounderSummary = {
  id: string
  full_name: string
  slug: string | null
  big_tech_employer: string | null
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
}

const BADGE_CLASS: Record<string, string> = {
  positive: "badge-signal badge-signal-positive",
  warning: "badge-signal badge-signal-warning",
  risk: "badge-signal badge-signal-risk",
  neutral: "badge-signal badge-signal-neutral",
}

const DOT_CLASS: Record<string, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  risk: "bg-rose-500",
  neutral: "bg-zinc-400",
}

function signalDotStrength(tags: Venture["organization_tags"]): string {
  if (tags.some((t) => t.strength >= 5)) return "positive"
  if (tags.some((t) => t.strength >= 3)) return "neutral"
  if (tags.some((t) => t.strength <= 1)) return "risk"
  return "neutral"
}

function takeaway(venture: Venture): string | null {
  const profile = Array.isArray(venture.organization_profiles)
    ? venture.organization_profiles[0]
    : venture.organization_profiles
  if (!profile?.investor_brief) return null
  // First sentence, max 120 chars
  const first = profile.investor_brief.split(/\.\s+/)[0]
  if (first.length <= 120) return first + "."
  return first.slice(0, 117) + "…"
}

function relativeDate(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function foundedLabel(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
}

function firstSeenLabel(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `Added ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
}

export function StartupCard({
  venture,
  founders = [],
  showContact = false,
}: {
  venture: Venture
  founders?: FounderSummary[]
  showContact?: boolean
}) {
  const dotStrength = signalDotStrength(venture.organization_tags)
  const hint = takeaway(venture)

  return (
    <Link href={`/startup/${venture.slug}`} className="block">
      <div className="data-card cursor-pointer p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-foreground">
              {venture.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {[venture.city, foundedLabel(venture.founded_date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Tags */}
        {venture.organization_tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {venture.organization_tags.slice(0, 3).map((tag) => {
              const sl = tagStrengthLabel(tag.strength)
              return (
                <span
                  key={tag.id}
                  className={BADGE_CLASS[sl] ?? BADGE_CLASS.neutral}
                >
                  {tag.tag}
                </span>
              )
            })}
          </div>
        )}

        {/* Description */}
        <p className="mb-1.5 text-[13px] leading-snug text-foreground line-clamp-2">
          {venture.description}
        </p>

        {/* Takeaway */}
        {hint && (
          <p className="text-[13px] italic leading-snug text-muted-foreground line-clamp-2">
            {hint}
          </p>
        )}

        {/* Founder summary */}
        {founders.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Founders
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {founders.map((f) => {
                const badges: string[] = []
                if (f.big_tech_employer) badges.push(f.big_tech_employer)
                else if (f.has_big_tech_background) badges.push("Big Tech")
                if (f.has_phd) badges.push("PhD")
                if (f.is_repeat_founder) badges.push("Repeat")

                return (
                  <span key={f.id} className="text-[12px] text-foreground">
                    {f.full_name}
                    {badges.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({badges.join(", ")})
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Contact row — Professional+ only */}
        {showContact && (venture.website || venture.email || venture.phone) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[12px] text-muted-foreground">
            {venture.website && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5C8 1.5 5.5 4.5 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4.5 10.5 8S8 14.5 8 14.5M1.5 8h13"/></svg>
                <span className="truncate max-w-[160px]">{venture.website.replace(/^https?:\/\//, "")}</span>
              </span>
            )}
            {venture.email && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="1"/><path d="m1.5 4 6.5 5 6.5-5"/></svg>
                <span className="truncate max-w-[200px]">{venture.email}</span>
              </span>
            )}
            {venture.phone && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5.5 2h-.25A2.25 2.25 0 0 0 3 4.25v7.5A2.25 2.25 0 0 0 5.25 14h5.5A2.25 2.25 0 0 0 13 11.75v-7.5A2.25 2.25 0 0 0 10.75 2H10.5"/></svg>
                <span>{venture.phone}</span>
              </span>
            )}
          </div>
        )}

        {/* Signal footer */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span
              className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_CLASS[dotStrength]}`}
            />
            <span>
              {venture.signal_count} signal{venture.signal_count !== 1 ? "s" : ""}
              {venture.last_signal_date
                ? ` · Last updated ${relativeDate(venture.last_signal_date)}`
                : ""}
            </span>
          </div>
          {venture.first_seen_at && (
            <span className="shrink-0 text-[11px]">
              {firstSeenLabel(venture.first_seen_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
