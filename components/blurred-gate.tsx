import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Events } from "@/lib/analytics"

/** Wraps a large section — shows blurred content with an overlay upgrade prompt */
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

/** Blurs inline text content — shows the structure but obscures the value */
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
      {children}
    </span>
  )
}
