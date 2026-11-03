"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { STATE_LABELS, type State } from "@/lib/detection/review"

export type Subject = {
  id: string
  role: "person" | "lab" | "institution" | "support" | "company"
  proposed_name: string
  proposed_affiliation: string | null
  identifiers: Record<string, string>
  match_options: { id: string; kind: string; name: string; slug: string; score: number; type?: string }[]
  matched_person_id: string | null
  matched_organization_id: string | null
  status: "proposed" | "confirmed" | "unmatched" | "rejected"
}

const ROLE_LABELS: Record<Subject["role"], string> = {
  person: "Person", lab: "Lab", institution: "Institution", support: "Incubator / tech transfer", company: "Company",
}

async function post(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/admin/candidates/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (res.ok) return null
  const data = await res.json().catch(() => ({}))
  return data.error ?? "Something went wrong"
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function CandidateActions({ id, state, allowed }: { id: string; state: State; allowed: State[] }) {
  const router = useRouter()
  const [to, setTo] = useState<State | null>(null)
  const [note, setNote] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [mergeInto, setMergeInto] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const err = await post(id, body)
    setBusy(false)
    if (err) return setError(err)
    setTo(null)
    setNote("")
    router.refresh()
  }

  return (
    <div className="data-card space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {allowed.map((s) => (
          <Button key={s} size="sm" variant={to === s ? "default" : "outline"} onClick={() => setTo(to === s ? null : s)} disabled={busy}>
            {s === "new" ? "Back to New" : STATE_LABELS[s]}
          </Button>
        ))}
      </div>
      {to === "approved_signal" && (
        <p className="text-[12px] text-muted-foreground">Records your editorial approval. Nothing is published in Phase 1.</p>
      )}
      {to === "verified_company" && (
        <div>
          <label className="text-[12px] text-muted-foreground">Slug of the company (a startup or corporate) on the Radar or in the Navigator, e.g. <code>mistral-ai</code></label>
          <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="company-slug" />
          <p className="mt-1 text-[11px] text-muted-foreground">The project keeps all its pre-company evidence and is linked to the company. No company is created here. Moving the candidate out of this state later removes the link.</p>
        </div>
      )}
      {to === "merged" && (
        <div>
          <label className="text-[12px] text-muted-foreground">Link (or ID) of the candidate this duplicates</label>
          <Input value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} placeholder="https://…/admin/candidates/…" />
        </div>
      )}
      <div>
        <label className="text-[12px] text-muted-foreground">{to ? "Reason (optional, kept in the history)" : "Add a note to the history"}</label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <div className="flex items-center gap-2">
        {to ? (
          <Button size="sm" disabled={busy} onClick={() => submit({
            action: "state", to, note: note || null,
            organization_slug: to === "verified_company" ? orgSlug : null,
            merge_into_id: to === "merged" ? (mergeInto.match(UUID)?.[0] ?? mergeInto) : null,
          })}>
            {busy ? "Saving…" : `Move to ${to === "new" ? "New" : STATE_LABELS[to]}`}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => submit({ action: "note", note })}>
            {busy ? "Saving…" : "Add note"}
          </Button>
        )}
        <span className="text-[12px] text-muted-foreground">Current: {STATE_LABELS[state]}</span>
      </div>
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  )
}

export function SubjectDecisions({ candidateId, subjects }: { candidateId: string; subjects: Subject[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function decide(s: Subject, decision: string, optionId?: string) {
    setBusy(s.id)
    setErrors((e) => ({ ...e, [s.id]: "" }))
    const err = await post(candidateId, { action: "subject", subject_id: s.id, decision, option_id: optionId ?? null })
    setBusy(null)
    if (err) setErrors((e) => ({ ...e, [s.id]: err }))
    else router.refresh()
  }

  if (subjects.length === 0) return <p className="text-[13px] text-muted-foreground">None.</p>

  return (
    <ul className="space-y-2">
      {subjects.map((s) => {
        const matchedId = s.matched_person_id ?? s.matched_organization_id
        const matched = s.match_options.find((o) => o.id === matchedId)
        const ids = Object.entries(s.identifiers ?? {})
        return (
          <li key={s.id} className="data-card p-3 text-[13px]">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{ROLE_LABELS[s.role]}</span>
              <span className="font-semibold text-foreground">{s.proposed_name}</span>
              {s.proposed_affiliation && <span className="text-[12px] text-muted-foreground">{s.proposed_affiliation}</span>}
              {ids.length > 0 && <span className="text-[11px] text-muted-foreground">{ids.map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
            </div>

            {s.status === "confirmed" && matched ? (
              <p className="mt-1 text-[12px] text-foreground">
                Confirmed:{" "}
                {matched.kind === "person"
                  ? <Link className="underline" href={`/founder/${matched.slug}`}>{matched.name}</Link>
                  : <span className="font-medium">{matched.name}</span>}{" "}
                <button className="text-muted-foreground underline" disabled={busy === s.id} onClick={() => decide(s, "reopen")}>undo</button>
              </p>
            ) : s.status === "unmatched" || s.status === "rejected" ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {s.status === "unmatched" ? "Not in our database; kept private on this candidate." : "Rejected (misread or not relevant)."}{" "}
                <button className="underline" disabled={busy === s.id} onClick={() => decide(s, "reopen")}>undo</button>
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {s.match_options.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No similar name in our database.</p>
                ) : (
                  <>
                    <p className="text-[12px] text-muted-foreground">
                      {s.match_options.length > 1 ? "Several possible matches. Check before confirming: names are often shared." : "Possible match:"}
                    </p>
                    {s.match_options.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 text-[12px]">
                        <Button size="sm" variant="outline" className="h-7 text-[12px]" disabled={busy === s.id} onClick={() => decide(s, "confirm", o.id)}>Same</Button>
                        <span className="text-foreground">{o.name}</span>
                        <span className="text-muted-foreground">{o.type ? `${o.type} · ` : ""}{Math.round(o.score * 100)}% name similarity</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex gap-3 pt-1 text-[12px]">
                  <button className="underline" disabled={busy === s.id} onClick={() => decide(s, "unmatched")}>Not in our database</button>
                  <button className="text-muted-foreground underline" disabled={busy === s.id} onClick={() => decide(s, "reject")}>Reject name</button>
                </div>
              </div>
            )}
            {errors[s.id] && <p className="mt-1 text-[12px] text-destructive">{errors[s.id]}</p>}
          </li>
        )
      })}
    </ul>
  )
}
