"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FUNDING_STAGES, SIGNAL_TYPES } from "@/lib/startup-import"

export type Candidate = {
  id: string
  organization_id: string
  organization_name: string
  organization_slug: string | null
  source: "bodacc" | "press_rss" | "google_news"
  source_url: string
  source_name: string | null
  source_published_at: string | null
  raw_title: string
  raw_excerpt: string | null
  signal_type: string
  title: string
  description: string | null
  signal_date: string | null
  strength: number | null
  funding_amount_eur: number | null
  funding_stage: string | null
  investors: string | null
  confidence: number | null
  ai_reasoning: string | null
  possible_duplicate_signal_id: string | null
  status: "pending" | "approved" | "rejected" | "dismissed"
  reviewed_at: string | null
  created_at: string
}

type Form = {
  signal_type: string
  title: string
  description: string
  signal_date: string
  strength: string
  funding_amount_eur: string
  funding_stage: string
  investors: string
  add_funding_round: boolean
}

const SOURCE_LABELS: Record<Candidate["source"], string> = {
  bodacc: "Official register",
  press_rss: "Press",
  google_news: "Google News",
}

const typeLabel = (v: string) => SIGNAL_TYPES.find((t) => t.value === v)?.label ?? v

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

const toForm = (c: Candidate): Form => ({
  signal_type: c.signal_type,
  title: c.title,
  description: c.description ?? "",
  signal_date: c.signal_date ?? "",
  strength: c.strength ? String(c.strength) : "3",
  funding_amount_eur: c.funding_amount_eur != null ? String(c.funding_amount_eur) : "",
  funding_stage: c.funding_stage ?? "",
  investors: c.investors ?? "",
  add_funding_round: c.signal_type === "fundraising",
})

const toBody = (f: Form) => ({
  signal_type: f.signal_type,
  title: f.title,
  description: f.description,
  signal_date: f.signal_date || null,
  strength: f.strength ? Number(f.strength) : null,
  funding_amount_eur: f.signal_type === "fundraising" && f.funding_amount_eur ? Number(f.funding_amount_eur) : null,
  funding_stage: f.signal_type === "fundraising" && f.funding_stage ? f.funding_stage : null,
  investors: f.signal_type === "fundraising" ? f.investors : null,
})

export function SignalReview({ candidates, status }: { candidates: Candidate[]; status: string }) {
  const router = useRouter()
  const [forms, setForms] = useState<Record<string, Form>>(() => Object.fromEntries(candidates.map((c) => [c.id, toForm(c)])))
  const [done, setDone] = useState<Record<string, "approved" | "rejected">>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const visible = candidates.filter((c) => !done[c.id])
  const groups = new Map<string, Candidate[]>()
  for (const c of visible) groups.set(c.organization_id, [...(groups.get(c.organization_id) ?? []), c])

  const setField = (id: string, patch: Partial<Form>) => setForms((p) => ({ ...p, [id]: { ...p[id], ...patch } }))

  async function act(c: Candidate, action: "approve" | "reject"): Promise<boolean> {
    const f = forms[c.id]
    const res = await fetch(`/api/admin/signals/candidates/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action, ...toBody(f), add_funding_round: f.add_funding_round } : { action }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessages((m) => ({ ...m, [c.id]: data.error ?? "Something went wrong" }))
      return false
    }
    if (data.warning) window.alert(data.warning)
    setDone((d) => ({ ...d, [c.id]: action === "approve" ? "approved" : "rejected" }))
    return true
  }

  async function one(c: Candidate, action: "approve" | "reject") {
    setBusy(c.id)
    setMessages((m) => ({ ...m, [c.id]: "" }))
    await act(c, action)
    setBusy(null)
    router.refresh()
  }

  async function all(orgId: string, action: "approve" | "reject") {
    setBusy(orgId)
    for (const c of groups.get(orgId) ?? []) await act(c, action)
    setBusy(null)
    router.refresh()
  }

  if (visible.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {status === "pending" ? "Nothing to review. New finds appear here after each nightly check." : "Nothing here yet."}
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([orgId, items]) => (
        <section key={orgId}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-foreground">
              <Link href={`/admin/startups/${orgId}/edit`} className="hover:underline">{items[0].organization_name}</Link>
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">{items.length} draft{items.length === 1 ? "" : "s"}</span>
            </h2>
            {(status === "pending" || status === "dismissed") && items.length > 1 && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => all(orgId, "reject")}>Reject all</Button>
                {status === "pending" && (
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => all(orgId, "approve")}>Approve all</Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {items.map((c) => {
              const f = forms[c.id]
              const pending = status === "pending" || status === "dismissed"
              return (
                <article key={c.id} className="border-l-2 border-l-primary bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="badge-signal badge-signal-neutral text-[10px]">{SOURCE_LABELS[c.source]}</span>
                    {c.source_name && <span>{c.source_name}</span>}
                    {c.source_published_at && <span>· {formatDate(c.source_published_at)}</span>}
                    {c.confidence != null && (
                      <span className={c.confidence < 0.7 ? "font-semibold text-amber-700" : ""}>· confidence {Math.round(c.confidence * 100)}%</span>
                    )}
                    {c.possible_duplicate_signal_id && <span className="badge-signal badge-signal-warning text-[10px]">Possible duplicate</span>}
                  </div>
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[13px] font-semibold text-foreground underline-offset-2 hover:underline">
                    {c.raw_title} ↗
                  </a>
                  {c.raw_excerpt && <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">{c.raw_excerpt}</p>}
                  {c.ai_reasoning && <p className="mt-2 text-[12px] italic text-muted-foreground">Claude: {c.ai_reasoning}</p>}

                  {pending ? (
                    <div className="mt-4 space-y-3 bg-accent p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Select className="text-[13px]" value={f.signal_type} onChange={(e) => setField(c.id, { signal_type: e.target.value, add_funding_round: e.target.value === "fundraising" })}>
                          {SIGNAL_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                        <Input type="date" className="text-[13px]" value={f.signal_date} onChange={(e) => setField(c.id, { signal_date: e.target.value })} />
                        <Select className="text-[13px]" value={f.strength} onChange={(e) => setField(c.id, { strength: e.target.value })}>
                          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>Strength {n}</option>)}
                        </Select>
                      </div>
                      <Input className="text-[13px]" placeholder="Signal title *" value={f.title} onChange={(e) => setField(c.id, { title: e.target.value })} />
                      <Textarea className="min-h-[56px] text-[13px]" placeholder="Description" value={f.description} onChange={(e) => setField(c.id, { description: e.target.value })} />
                      {f.signal_type === "fundraising" && (
                        <div className="space-y-2">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Input type="number" step="0.01" min="0" className="text-[13px]" placeholder="Amount (€ millions)" value={f.funding_amount_eur} onChange={(e) => setField(c.id, { funding_amount_eur: e.target.value })} />
                            <Select className="text-[13px]" value={f.funding_stage} onChange={(e) => setField(c.id, { funding_stage: e.target.value })}>
                              <option value="">Stage unknown</option>
                              {FUNDING_STAGES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                            <Input className="text-[13px]" placeholder="Investors" value={f.investors} onChange={(e) => setField(c.id, { investors: e.target.value })} />
                          </div>
                          <label className="flex items-center gap-2 text-[12px] text-foreground">
                            <input type="checkbox" checked={f.add_funding_round} onChange={(e) => setField(c.id, { add_funding_round: e.target.checked })} />
                            Also add this to the startup&rsquo;s funding rounds
                          </label>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        {messages[c.id] && <p className="mr-auto text-[12px] text-destructive">{messages[c.id]}</p>}
                        <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => one(c, "reject")}>Reject</Button>
                        <Button size="sm" disabled={busy !== null || !f.title.trim()} onClick={() => one(c, "approve")}>
                          {busy === c.id ? "Saving…" : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-[12px] text-foreground">
                      <span className="badge-signal badge-signal-neutral mr-2 text-[10px]">{typeLabel(c.signal_type)}</span>
                      {c.title}
                      {c.reviewed_at && <span className="ml-2 text-muted-foreground">· reviewed {formatDate(c.reviewed_at)}</span>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
