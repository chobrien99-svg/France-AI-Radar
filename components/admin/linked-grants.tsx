"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type Grant = {
  id: string
  grant_name: string
  granting_body: string | null
  amount_eur: number | null
  awarded_date: string | null
  program: string | null
  description: string | null
  source_url: string | null
}

interface Props {
  organizationId: string
  grants: Grant[]
}

export function LinkedGrants({ organizationId, grants: initial }: Props) {
  const router = useRouter()
  const [grants, setGrants] = useState<Grant[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    grant_name: "",
    granting_body: "",
    amount_eur: "",
    awarded_date: "",
    program: "",
    description: "",
    source_url: "",
  })

  async function addGrant() {
    if (!form.grant_name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to add grant.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setGrants((prev) => [...prev, { ...form, id: data.id, amount_eur: form.amount_eur ? Number(form.amount_eur) : null } as Grant])
    setForm({ grant_name: "", granting_body: "", amount_eur: "", awarded_date: "", program: "", description: "", source_url: "" })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function removeGrant(grantId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/grants?grant_id=${grantId}`, { method: "DELETE" })
    setGrants((prev) => prev.filter((g) => g.id !== grantId))
    setLoading(false)
    router.refresh()
  }

  function formatEur(amount: number | null) {
    if (!amount) return ""
    return `€${amount.toLocaleString()}`
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Grants & Public Funding
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Grant"}
        </Button>
      </div>

      {grants.length > 0 ? (
        <div className="mb-4 space-y-2">
          {grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{g.grant_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[g.granting_body, formatEur(g.amount_eur), g.awarded_date].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-[12px] text-muted-foreground hover:text-destructive"
                onClick={() => removeGrant(g.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No grants recorded yet.</p>
      )}

      {showForm && (
        <div className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Grant name *" value={form.grant_name} onChange={(e) => setForm((p) => ({ ...p, grant_name: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Granting body (e.g. Bpifrance)" value={form.granting_body} onChange={(e) => setForm((p) => ({ ...p, granting_body: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="number" className="text-[13px]" placeholder="Amount (EUR)" value={form.amount_eur} onChange={(e) => setForm((p) => ({ ...p, amount_eur: e.target.value }))} />
            <Input type="date" className="text-[13px]" value={form.awarded_date} onChange={(e) => setForm((p) => ({ ...p, awarded_date: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Program (e.g. iPhD, JEI)" value={form.program} onChange={(e) => setForm((p) => ({ ...p, program: e.target.value }))} />
          </div>
          <Input className="text-[13px]" placeholder="Source URL" value={form.source_url} onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))} />
          <div className="flex justify-end">
            <Button type="button" onClick={addGrant} disabled={!form.grant_name.trim() || loading}>
              Add Grant
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
