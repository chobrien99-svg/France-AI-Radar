import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Events } from "@/lib/analytics"

/**
 * Wraps a large section — shows blurred content with an overlay upgrade prompt.
 * Note: the blurred children are still sent to the browser; only pass content
 * that is safe to expose, or use BlurredText for premium values.
 */
export function BlurredGate({
  children,
  canAccess,
  message = "Upgrade to Professional for full access.",
}: {
  children: React.ReactNode
  canAccess: boolean
  message?: string
}) {
  if (canAccess) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="border-l-2 border-l-primary bg-card/95 px-6 py-4 text-center backdrop-blur-sm">
          <p className="mb-2 text-[13px] font-semibold text-foreground">
            {message}
          </p>
          <Button size="sm" asChild>
            <Link href="/pricing" onClick={() => Events.upgradeClicked("blurred_gate")}>
              Upgrade
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

const FILLER =
  "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua "

/**
 * Stand-in text of roughly the same length (rounded up to 10 characters), so
 * blurred content keeps its shape without the real value ever being sent.
 */
function placeholderFor(children: React.ReactNode) {
  const length =
    typeof children === "string" || typeof children === "number" ? String(children).length : 12
  const target = Math.max(6, Math.ceil(length / 10) * 10)
  return FILLER.repeat(Math.ceil(target / FILLER.length)).slice(0, target).trim()
}

/**
 * Blurs inline text content — shows the structure but obscures the value.
 * When blurred, the real text is replaced by filler on the server: CSS blur
 * alone would still ship the value in the HTML (readable via view-source,
 * copy/paste, or search-engine crawlers).
 */
export function BlurredText({
  children,
  blur,
}: {
  children: React.ReactNode
  blur: boolean
}) {
  if (!blur) return <>{children}</>

  return (
    <span className="pointer-events-none select-none blur-[5px]" aria-hidden="true">
      {placeholderFor(children)}
    </span>
  )
}
