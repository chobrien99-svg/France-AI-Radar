import Link from "next/link"
import { type Venture } from "@/lib/types"
import { sectorLabel, stageLabel } from "@/lib/subscription"

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

function signalDotStrength(tags: Venture["startup_tags"]): string {
  if (tags.some((t) => t.strength === "positive")) return "positive"
  if (tags.some((t) => t.strength === "warning")) return "warning"
  if (tags.some((t) => t.strength === "risk")) return "risk"
  return "neutral"
}

function takeaway(venture: Venture): string | null {
  if (!venture.investor_brief) return null
  // First sentence, max 120 chars
  const first = venture.investor_brief.split(/\.\s+/)[0]
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

export function StartupCard({ venture }: { venture: Venture }) {
  const dotStrength = signalDotStrength(venture.startup_tags)
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
              {[venture.city, sectorLabel(venture.sector), foundedLabel(venture.founded_date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="badge-signal badge-signal-neutral shrink-0 text-[10px]">
            {stageLabel(venture.stage)}
          </span>
        </div>

        {/* Tags */}
        {venture.startup_tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {venture.startup_tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className={BADGE_CLASS[tag.strength] ?? BADGE_CLASS.neutral}
              >
                {tag.label}
              </span>
            ))}
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

        {/* Signal footer */}
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
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
      </div>
    </Link>
  )
}
