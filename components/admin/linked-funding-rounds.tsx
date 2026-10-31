"use client"

import { useEffect, useState } from "react"
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
  { value: "series_d", label: "Series D" },
  { value: "series_e", label: "Series E" },
  { value: "series_f", label: "Series F" },
  { value: "growth", label: "Growth" },
  { value: "bridge", label: "Bridge" },
  { value: "debt", label: "Debt" },
  { value: "grant", label: "Grant" },
  { value: "ipo", label: "IPO" },
  { value: "secondary", label: "Secondary" },
  { value: "undisclosed", label: "Undisclosed" },
  { value: "other", label: "Other" },
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
  investors: Investor[]
}

type Investor = { investor_id?: string; name: string; is_lead: boolean }

/**
 * Type-ahead over the shared investor list (also used by the Navigator).
 * Picking a suggestion links that investor; "Create" adds a new one.
 */
function InvestorPicker({ onPick, disabled }: { onPick: (inv: Investor) => void; disabled?: boolean }) {
  const [q, setQ] = useState("")
  const [isLead, setIsLead] = useState(false)
  const [hits, setHits] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return   // suggestions only show from 2 letters
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/admin/investors?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => setHits(Array.isArray(rows) ? rows : []))
        .catch(() => {})
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  const pick = (inv: Investor) => { onPick({ ...inv, is_lead: isLead }); setQ(""); setHits([]); setIsLead(false) }
  const exact = hits.some((h) => h.name.toLowerCase() === q.trim().toLowerCase())

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input className="text-[13px]" placeholder="Add investor (type 2+ letters)" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} />
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={isLead} onChange={(e) => setIsLead(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
          Lead
        </label>
      </div>
      {q.trim().length >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {hits.map((h) => (
            <button key={h.id} type="button" disabled={disabled} onClick={() => pick({ investor_id: h.id, name: h.name, is_lead: false })}
              className="rounded-[4px] border border-border bg-card px-2 py-1 text-[12px] hover:border-primary">
              {h.name}
            </button>
          ))}
          {!exact && (
            <button type="button" disabled={disabled} onClick={() => pick({ name: q.trim(), is_lead: false })}
              className="rounded-[4px] border border-dashed border-border px-2 py-1 text-[12px] text-muted-foreground hover:border-primary">
              Create “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function InvestorChips({ investors, onRemove, disabled }: { investors: Investor[]; onRemove: (i: number) => void; disabled?: boolean }) {
  if (!investors.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {investors.map((inv, i) => (
        <span key={`${inv.investor_id ?? inv.name}-${i}`} className="inline-flex items-center gap-1 rounded-[4px] bg-accent px-2 py-0.5 text-[12px] text-foreground">
          {inv.name}{inv.is_lead && <b className="text-[10px] uppercase tracking-wide text-primary">Lead</b>}
          <button type="button" aria-label={`Remove ${inv.name}`} disabled={disabled} onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">×</button>
        </span>
      ))}
    </div>
  )
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

  const emptyForm = {
    stage: "seed",
    amount_eur: "",
    announced_date: "",
    source_url: "",
    source_name: "",
    notes: "",
    is_estimated: false,
    investors: [] as Investor[],
  }
  const [form, setForm] = useState(emptyForm)
  const [addingTo, setAddingTo] = useState<string | null>(null)

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
    if (data.error) setError(data.error)
    setRounds((prev) => [...prev, { ...form, id: data.id, investors: data.investors ?? [], amount_eur: form.amount_eur ? Number(form.amount_eur) / 1_000_000 : null } as FundingRound])
    setForm(emptyForm)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function addInvestor(roundId: string, inv: Investor) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/startups/${organizationId}/funding-rounds/${roundId}/investors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inv.investor_id ? { investor_id: inv.investor_id, is_lead: inv.is_lead } : { name: inv.name, is_lead: inv.is_lead }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setError(body.error ?? "Failed to add the investor.")
    else {
      setRounds((prev) => prev.map((r) => r.id !== roundId ? r : {
        ...r,
        investors: [...r.investors.filter((x) => x.investor_id !== body.investor_id), { investor_id: body.investor_id, name: body.name, is_lead: body.is_lead }],
      }))
    }
    setLoading(false)
  }

  async function removeInvestor(roundId: string, investorId: string | undefined) {
    if (!investorId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/startups/${organizationId}/funding-rounds/${roundId}/investors?investor_id=${investorId}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Failed to remove the investor.")
      } else {
        setRounds((prev) => prev.map((r) => r.id !== roundId ? r : { ...r, investors: r.investors.filter((x) => x.investor_id !== investorId) }))
      }
    } catch {
      setError("Could not reach the server to remove the investor.")
    }
    setLoading(false)
  }

  async function removeRound(roundId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/funding-rounds?round_id=${roundId}`, { method: "DELETE" })
    setRounds((prev) => prev.filter((r) => r.id !== roundId))
    setLoading(false)
    router.refresh()
  }

  // amount_eur is stored in millions of euros (5 = €5M)
  function formatEur(amountInMillions: number | null) {
    if (!amountInMillions) return ""
    const amount = amountInMillions * 1_000_000
    if (amount >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(1)}B`
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
            <div key={r.id} className="flex items-start justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {stageLabel(r.stage)}
                  {r.amount_eur ? ` — ${formatEur(r.amount_eur)}` : ""}
                  {r.is_estimated ? " (est.)" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {[r.announced_date, r.source_name].filter(Boolean).join(" · ")}
                </p>
                <InvestorChips investors={r.investors} disabled={loading} onRemove={(i) => removeInvestor(r.id, r.investors[i].investor_id)} />
                {addingTo === r.id ? (
                  <div className="mt-2 max-w-md">
                    <InvestorPicker disabled={loading} onPick={(inv) => addInvestor(r.id, inv)} />
                    <button type="button" className="mt-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setAddingTo(null)}>Done</button>
                  </div>
                ) : (
                  <button type="button" className="mt-1 text-[11px] text-primary hover:underline" onClick={() => setAddingTo(r.id)}>+ Investor</button>
                )}
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
            <Input type="number" className="text-[13px]" placeholder="Amount (EUR, e.g. 5000000)" value={form.amount_eur} onChange={(e) => setForm((p) => ({ ...p, amount_eur: e.target.value }))} />
            <Input type="date" className="text-[13px]" value={form.announced_date} onChange={(e) => setForm((p) => ({ ...p, announced_date: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Source name (e.g. Les Echos)" value={form.source_name} onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Source URL" value={form.source_url} onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))} />
          </div>
          <Input className="text-[13px]" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Investors</p>
            <InvestorChips investors={form.investors} onRemove={(i) => setForm((p) => ({ ...p, investors: p.investors.filter((_, j) => j !== i) }))} />
            <div className="mt-1.5"><InvestorPicker onPick={(inv) => setForm((p) => ({ ...p, investors: [...p.investors.filter((x) => x.name.toLowerCase() !== inv.name.toLowerCase()), inv] }))} /></div>
          </div>
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
