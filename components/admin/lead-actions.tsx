"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type Status = "new" | "added" | "ignored"

/** Ignore / Mark as added (or Put back) for one company on the "to vet" list. */
export function LeadActions({ siren, status }: { siren: string; status: Status }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function set(next: Status) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/leads/${siren}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error ?? "Could not save")
    router.refresh()
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-[12px] text-destructive">{error}</span>}
      {status === "new" ? (
        <>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => set("ignored")}>Ignore</Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => set("added")}>Mark as added</Button>
        </>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => set("new")}>Put back</Button>
      )}
    </div>
  )
}
