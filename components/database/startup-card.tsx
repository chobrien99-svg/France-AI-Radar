import Link from "next/link"
import { type Venture, tagStrengthLabel } from "@/lib/types"

const BADGE_CLASS: Record<string, string> = {
  positive: "badge-signal badge-signal-positive",
  warning: "badge-signal badge-signal-warning",
  risk: "badge-signal badge-signal-risk",
  neutral: "badge-signal badge-signal-neutral",
}

const DOT_CLASS: Record<string, string> = {
  positive: "bg-accent-green",
  warning: "bg-[#8a6d00]",
  risk: "bg-destructive",
  neutral: "bg-[#72787e]",
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
  sectors = [],
}: {
  venture: Venture
  sectors?: string[]
}) {
  const dotStrength = signalDotStrength(venture.organization_tags)
  const hint = takeaway(venture)

  return (
    <Link href={`/startup/${venture.slug}`} className="block">
      <div className="data-card cursor-pointer p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-serif text-[15px] font-bold tracking-tight text-foreground">
              {venture.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {[venture.cities?.name, foundedLabel(venture.founded_date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Sectors */}
        {sectors.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sectors.map((sector) => (
              <span
                key={sector}
                className="badge-signal badge-signal-neutral"
              >
                {sector}
              </span>
            ))}
          </div>
        )}

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
          <p className="font-serif text-[13px] italic leading-snug text-muted-foreground line-clamp-2">
            {hint}
          </p>
        )}

        {/* Signal footer */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
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
