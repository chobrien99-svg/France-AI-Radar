"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  slug: string
  isLoggedIn: boolean
  tier: string
  /** Remaining exports this month (null = unlimited) */
  remaining: number | null
}

export function ExportCsvButton({ slug, isLoggedIn, tier, remaining }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canExport = isLoggedIn && tier !== "free"
  const exhausted = remaining !== null && remaining <= 0

  async function handleExport() {
    if (!isLoggedIn) {
      router.push("/auth/login")
      return
    }
    if (exhausted) {
      setError("Monthly export limit reached. Resets next month.")
      return
    }

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/startup/${slug}/export-csv`)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Export failed.")
      setLoading(false)
      return
    }

    // Trigger browser download
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const disposition = res.headers.get("Content-Disposition") ?? ""
    const match = disposition.match(/filename="([^"]+)"/)
    a.href = url
    a.download = match?.[1] ?? `${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
    // Refresh so remaining count updates
    router.refresh()
  }

  const label = tier === "free"
    ? "Export Card"
    : exhausted
    ? "Export limit reached"
    : remaining !== null
    ? `Export Card (${remaining} left)`
    : "Export Card"

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="text-[13px]"
        onClick={handleExport}
        disabled={loading || (isLoggedIn && exhausted)}
        title={tier === "free" ? "Upgrade to Explorer or Professional to export" : undefined}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Exporting…" : label}
      </Button>
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  )
}
