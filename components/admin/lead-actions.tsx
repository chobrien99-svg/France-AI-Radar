"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type Status = "new" | "added" | "ignored"

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

/** Ignore / Mark as added (or Put back) for one company on the "to vet" list. */
export function LeadActions({ siren, status }: { siren: string; status: Status }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function set(next: Status) {
    setBusy(true)
    setError(null)
    const { ok, data } = await call(`/api/admin/leads/${siren}`, { method: "PATCH", body: JSON.stringify({ status: next }) })
    setBusy(false)
    if (!ok) return setError(String(data.error ?? "Could not save"))
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

/** Web research on one company now (about $0.05). */
export function LeadResearchButton({ siren }: { siren: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function research() {
    setBusy(true)
    setError(null)
    const { ok, data } = await call(`/api/admin/leads/${siren}`, { method: "POST", body: JSON.stringify({ action: "research" }) })
    setBusy(false)
    if (!ok) return setError(String(data.error ?? "Research failed"))
    router.refresh()
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={research}>
        {busy ? "Searching the web… (up to a minute)" : "Research now"}
      </Button>
      {error && <span className="text-destructive">{error}</span>}
    </>
  )
}

/** Add companies by SIREN (pasted from a Pappers alert email) and run the checks now. */
export function LeadsToolbar() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState<"add" | "check" | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: "add" | "check") {
    setBusy(action)
    setMessage(null)
    const { ok, data } = await call("/api/admin/leads", { method: "POST", body: JSON.stringify(action === "add" ? { action, sirens: text } : { action }) })
    setBusy(null)
    if (!ok) return setMessage(String(data.error ?? "Failed"))
    const errors = Array.isArray(data.errors) ? (data.errors as string[]) : []
    const parts = [
      action === "add" && `Added ${data.added ?? 0}`,
      action === "add" && Number(data.alreadyOnSite) > 0 && `${data.alreadyOnSite} already on the site`,
      action === "add" && Number(data.alreadyListed) > 0 && `${data.alreadyListed} already listed`,
      `checked ${data.checked ?? 0}`,
      `researched ${data.researched ?? 0}`,
    ].filter(Boolean)
    setMessage(`${parts.join(", ")}.${errors.length ? ` ${errors.slice(0, 3).join(" · ")}` : ""}`)
    if (action === "add") setText("")
    router.refresh()
  }

  return (
    <div className="mb-6 space-y-2 bg-card p-4">
      <label className="text-[12px] font-medium text-foreground" htmlFor="lead-sirens">Add companies by SIREN</label>
      <textarea
        id="lead-sirens"
        className="block h-16 w-full border border-border bg-background p-2 text-[13px]"
        placeholder="Paste SIRENs or the list from a Pappers alert email, e.g. Clara Solutions (131 609 539)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy !== null || !text.trim()} onClick={() => run("add")}>
          {busy === "add" ? "Adding and checking…" : "Add and check"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("check")}>
          {busy === "check" ? "Checking… (up to two minutes)" : "Check now"}
        </Button>
        {message && <p className="text-[12px] text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}
