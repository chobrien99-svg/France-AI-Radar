"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function StartupProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="page-container py-24 text-center">
      <p className="mb-2 text-[15px] font-semibold text-foreground">
        Failed to load this startup profile
      </p>
      <p className="mb-6 text-[13px] text-muted-foreground">
        {error.message ?? "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/database">← Back to Database</Link>
        </Button>
      </div>
    </main>
  )
}
