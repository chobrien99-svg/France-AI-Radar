"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  canExport: boolean
}

export function ExportButton({ canExport }: Props) {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!canExport) {
      window.location.href = "/pricing"
      return
    }
    setLoading(true)
    setError(null)

    const qs = searchParams.toString()
    const res = await fetch(`/api/database/export${qs ? `?${qs}` : ""}`)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Export failed.")
      setLoading(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const disposition = res.headers.get("Content-Disposition") ?? ""
    const match = disposition.match(/filename="([^"]+)"/)
    a.href = url
    a.download = match?.[1] ?? "france-ai-radar.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleClick}
        disabled={loading}
        title={canExport ? undefined : "Upgrade to Professional to export"}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Exporting…" : "Export CSV"}
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
