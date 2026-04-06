"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const STAGE_OPTIONS = [
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "series_c", label: "Series C" },
  { value: "series_d_plus", label: "Series D+" },
  { value: "bridge", label: "Bridge" },
  { value: "grant", label: "Grant" },
  { value: "debt", label: "Debt" },
  { value: "convertible_note", label: "Convertible Note" },
  { value: "unknown", label: "Unknown" },
]

type FundingRound = {
  id: string
  stage: string
  amount_eur: number | null
  announced_date: string | null
  source_url: string | null
  source_name: string | null
  notes: string | null
  is_estimated: boolean
}

interface Props {
  organizationId: string
  rounds: FundingRound[]
}

export function LinkedFundingRounds({ organizationId, rounds: initial }: Props) {
  const router = useRouter()
  const [rounds, setRounds] = useState<FundingRound[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    stage: "seed",
    amount_eur: "",
    announced_date: "",
    source_url: "",
    source_name: "",
    notes: "",
    is_estimated: false,
  })

  async function addRound() {
    if (!form.stage) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/funding-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to add funding round.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setRounds((prev) => [...prev, { ...form, id: data.id, amount_eur: form.amount_eur ? Number(form.amount_eur) : null } as FundingRound])
    setForm({ stage: "seed", amount_eur: "", announced_date: "", source_url: "", source_name: "", notes: "", is_estimated: false })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function removeRound(roundId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/funding-rounds?round_id=${roundId}`, { method: "DELETE" })
    setRounds((prev) => prev.filter((r) => r.id !== roundId))
    setLoading(false)
    router.refresh()
  }

  function formatEur(amount: number | null) {
    if (!amount) return ""
    if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`
    return `€${amount}`
  }

  function stageLabel(stage: string) {
    return STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Funding Rounds
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Round"}
        </Button>
      </div>

      {rounds.length > 0 ? (
        <div className="mb-4 space-y-2">
          {rounds.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {stageLabel(r.stage)}
                  {r.amount_eur ? ` — ${formatEur(r.amount_eur)}` : ""}
                  {r.is_estimated ? " (est.)" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {[r.announced_date, r.source_name].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-[12px] text-muted-foreground hover:text-destructive"
                onClick={() => removeRound(r.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No funding rounds recorded yet.</p>
      )}

      {showForm && (
        <div className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select className="text-[13px]" value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}>
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Input type="number" className="text-[13px]" placeholder="Amount (EUR)" value={form.amount_eur} onChange={(e) => setForm((p) => ({ ...p, amount_eur: e.target.value }))} />
            <Input type="date" className="text-[13px]" value={form.announced_date} onChange={(e) => setForm((p) => ({ ...p, announced_date: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Source name (e.g. Les Echos)" value={form.source_name} onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Source URL" value={form.source_url} onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))} />
          </div>
          <Input className="text-[13px]" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input type="checkbox" checked={form.is_estimated} onChange={(e) => setForm((p) => ({ ...p, is_estimated: e.target.checked }))} className="h-4 w-4 accent-primary" />
              Amount is estimated
            </label>
            <Button type="button" onClick={addRound} disabled={!form.stage || loading}>
              Add Round
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
