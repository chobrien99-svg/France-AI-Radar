"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function SourceControls({ slug, enabled, neverRead }: { slug: string; enabled: boolean; neverRead: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function toggle() {
    setBusy("toggle")
    setMessage(null)
    const res = await fetch(`/api/admin/sources/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setMessage(data.error ?? "Something went wrong")
    router.refresh()
  }

  async function run(kind: "manual" | "backfill") {
    setBusy(kind)
    setMessage(null)
    const res = await fetch(`/api/admin/sources/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setMessage(data.error ?? "Something went wrong")
    else setMessage(`${data.status === "failed" ? "Read failed" : "Done"}: ${data.fetched} items, ${data.newRecords} new, ${data.changedRecords} changed, ${data.candidatesCreated} new candidates${data.failedRecords ? `, ${data.failedRecords} unreadable` : ""}.${data.errors?.length && data.status === "failed" ? ` ${data.errors[0]}` : ""}`)
    router.refresh()
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(neverRead ? "backfill" : "manual")}>
          {busy === "manual" || busy === "backfill" ? "Reading…" : neverRead ? "Import history" : "Read now"}
        </Button>
        {!neverRead && (
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("backfill")} title="Re-read everything and mark what's new as history, not news">
            Re-import as history
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={toggle}>
          {busy === "toggle" ? "Saving…" : enabled ? "Switch off daily read" : "Switch on daily read"}
        </Button>
      </div>
      {neverRead && <p className="mt-1 text-[11px] text-muted-foreground">The first read imports the source&rsquo;s history: everything found is marked as history, not news.</p>}
      {message && <p className="mt-2 text-[12px] text-foreground">{message}</p>}
    </div>
  )
}
