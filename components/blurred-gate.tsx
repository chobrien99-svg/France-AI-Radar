import Link from "next/link"
import { Button } from "@/components/ui/button"

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
            <Link href="/pricing">Upgrade</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
