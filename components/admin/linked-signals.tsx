"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

const SIGNAL_TYPE_OPTIONS = [
  { value: "fundraising", label: "Fundraising" },
  { value: "hiring_surge", label: "Hiring Surge" },
  { value: "key_hire", label: "Key Hire" },
  { value: "restructuring", label: "Restructuring" },
  { value: "incorporation", label: "Incorporation" },
  { value: "new_product", label: "New Product" },
  { value: "pivot", label: "Pivot" },
  { value: "expansion", label: "Expansion" },
  { value: "partnership", label: "Partnership" },
  { value: "founder_departure", label: "Founder Departure" },
  { value: "talent_move", label: "Talent Move" },
  { value: "patent_filing", label: "Patent Filing" },
  { value: "award", label: "Award" },
  { value: "media_mention", label: "Media Mention" },
  { value: "regulatory", label: "Regulatory" },
  { value: "open_source", label: "Open Source" },
  { value: "conference", label: "Conference" },
  { value: "other", label: "Other" },
]

const STRENGTH_OPTIONS = [
  { value: "5", label: "5 — Strong" },
  { value: "4", label: "4 — Moderate-Strong" },
  { value: "3", label: "3 — Moderate" },
  { value: "2", label: "2 — Weak-Moderate" },
  { value: "1", label: "1 — Weak" },
]

type Signal = {
  id: string
  signal_type: string
  signal_date: string | null
  strength: number | null
  title: string
  description: string | null
  source_url: string | null
  source_name: string | null
}

interface Props {
  organizationId: string
  signals: Signal[]
}

function typeLabel(type: string) {
  return SIGNAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function formatDate(iso: string | null) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function LinkedSignals({ organizationId, signals: initial }: Props) {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    signal_type: "fundraising",
    signal_date: "",
    strength: "3",
    title: "",
    description: "",
    source_url: "",
    source_name: "",
  })

  async function addSignal() {
    if (!form.title.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to add signal.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setSignals((prev) => [{
      ...form,
      id: data.id,
      signal_date: form.signal_date || null,
      strength: form.strength ? Number(form.strength) : null,
      description: form.description || null,
      source_url: form.source_url || null,
      source_name: form.source_name || null,
    }, ...prev])
    setForm({ signal_type: "fundraising", signal_date: "", strength: "3", title: "", description: "", source_url: "", source_name: "" })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    signal_type: "",
    signal_date: "",
    strength: "",
    title: "",
    description: "",
    source_url: "",
    source_name: "",
  })

  function startEdit(s: Signal) {
    setEditingId(s.id)
    setEditForm({
      signal_type: s.signal_type,
      signal_date: s.signal_date?.slice(0, 10) ?? "",
      strength: s.strength ? String(s.strength) : "3",
      title: s.title,
      description: s.description ?? "",
      source_url: s.source_url ?? "",
      source_name: s.source_name ?? "",
    })
  }

  async function saveEdit() {
    if (!editingId || !editForm.title.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/signals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal_id: editingId, ...editForm }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to update signal.")
      setLoading(false)
      return
    }

    setSignals((prev) => prev.map((s) => s.id === editingId ? {
      ...s,
      signal_type: editForm.signal_type,
      signal_date: editForm.signal_date || null,
      strength: editForm.strength ? Number(editForm.strength) : null,
      title: editForm.title,
      description: editForm.description || null,
      source_url: editForm.source_url || null,
      source_name: editForm.source_name || null,
    } : s))
    setEditingId(null)
    setLoading(false)
    router.refresh()
  }

  async function removeSignal(signalId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/signals?signal_id=${signalId}`, { method: "DELETE" })
    setSignals((prev) => prev.filter((s) => s.id !== signalId))
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Key Signals
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
          {showForm ? "Cancel" : "+ Add Signal"}
        </Button>
      </div>

      {signals.length > 0 ? (
        <div className="mb-4 space-y-2">
          {signals.map((s) => editingId === s.id ? (
            <div key={s.id} className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Select className="text-[13px]" value={editForm.signal_type} onChange={(e) => setEditForm((p) => ({ ...p, signal_type: e.target.value }))}>
                  {SIGNAL_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                <Input type="date" className="text-[13px]" value={editForm.signal_date} onChange={(e) => setEditForm((p) => ({ ...p, signal_date: e.target.value }))} />
                <Select className="text-[13px]" value={editForm.strength} onChange={(e) => setEditForm((p) => ({ ...p, strength: e.target.value }))}>
                  {STRENGTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <Input className="text-[13px]" placeholder="Signal title *" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
              <Textarea className="min-h-[60px] text-[13px]" placeholder="Description" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input className="text-[13px]" placeholder="Source name" value={editForm.source_name} onChange={(e) => setEditForm((p) => ({ ...p, source_name: e.target.value }))} />
                <Input className="text-[13px]" placeholder="Source URL" value={editForm.source_url} onChange={(e) => setEditForm((p) => ({ ...p, source_url: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button type="button" size="sm" onClick={saveEdit} disabled={!editForm.title.trim() || loading}>Save</Button>
              </div>
            </div>
          ) : (
            <div key={s.id} className="flex items-start justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge-signal badge-signal-neutral text-[10px]">{typeLabel(s.signal_type)}</span>
                  {s.signal_date && (
                    <span className="text-[11px] text-muted-foreground">{formatDate(s.signal_date)}</span>
                  )}
                  {s.strength && (
                    <span className="text-[10px] text-muted-foreground">Str: {s.strength}</span>
                  )}
                </div>
                <p className="mt-1 text-[13px] font-semibold text-foreground">{s.title}</p>
                {s.description && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{s.description}</p>
                )}
                {s.source_name && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Source: {s.source_name}
                    {s.source_url && (
                      <> · <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">link</a></>
                    )}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost" size="sm"
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(s)}
                  disabled={loading}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-[12px] text-muted-foreground hover:text-destructive"
                  onClick={() => removeSignal(s.id)}
                  disabled={loading}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No signals recorded yet.</p>
      )}

      {showForm && (
        <div className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select className="text-[13px]" value={form.signal_type} onChange={(e) => setForm((p) => ({ ...p, signal_type: e.target.value }))}>
              {SIGNAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Input type="date" className="text-[13px]" value={form.signal_date} onChange={(e) => setForm((p) => ({ ...p, signal_date: e.target.value }))} />
            <Select className="text-[13px]" value={form.strength} onChange={(e) => setForm((p) => ({ ...p, strength: e.target.value }))}>
              {STRENGTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <Input className="text-[13px]" placeholder="Signal title *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <Textarea className="min-h-[60px] text-[13px]" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Source name (e.g. Les Echos)" value={form.source_name} onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Source URL" value={form.source_url} onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={addSignal} disabled={!form.title.trim() || loading}>
              Add Signal
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
