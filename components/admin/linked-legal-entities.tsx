"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type LegalEntity = {
  id: string
  legal_name: string
  legal_form: string | null
  siren: string | null
  siret: string | null
  capital_eur: number | null
  incorporation_date: string | null
  registered_city: string | null
  naf_code: string | null
  naf_label: string | null
}

interface Props {
  organizationId: string
  entities: LegalEntity[]
}

export function LinkedLegalEntities({ organizationId, entities: initial }: Props) {
  const router = useRouter()
  const [entities, setEntities] = useState<LegalEntity[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    legal_name: "",
    legal_form: "",
    siren: "",
    siret: "",
    capital_eur: "",
    incorporation_date: "",
    registered_city: "",
    naf_code: "",
    naf_label: "",
  })

  async function addEntity() {
    if (!form.legal_name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/legal-entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to add legal entity.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setEntities((prev) => [...prev, { ...form, id: data.id, capital_eur: form.capital_eur ? Number(form.capital_eur) : null } as LegalEntity])
    setForm({ legal_name: "", legal_form: "", siren: "", siret: "", capital_eur: "", incorporation_date: "", registered_city: "", naf_code: "", naf_label: "" })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function removeEntity(entityId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/legal-entities?entity_id=${entityId}`, { method: "DELETE" })
    setEntities((prev) => prev.filter((e) => e.id !== entityId))
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Legal Entities
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Entity"}
        </Button>
      </div>

      {entities.length > 0 ? (
        <div className="mb-4 space-y-2">
          {entities.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{e.legal_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[e.legal_form, e.siren ? `SIREN ${e.siren}` : null, e.registered_city, e.incorporation_date].filter(Boolean).join(" · ")}
                </p>
                {e.naf_code && (
                  <p className="text-[11px] text-muted-foreground">
                    NAF {e.naf_code}{e.naf_label ? ` — ${e.naf_label}` : ""}
                  </p>
                )}
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-[12px] text-muted-foreground hover:text-destructive"
                onClick={() => removeEntity(e.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No legal entities recorded yet.</p>
      )}

      {showForm && (
        <div className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Legal name *" value={form.legal_name} onChange={(e) => setForm((p) => ({ ...p, legal_name: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Legal form (e.g. SAS, SARL)" value={form.legal_form} onChange={(e) => setForm((p) => ({ ...p, legal_form: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="SIREN" value={form.siren} onChange={(e) => setForm((p) => ({ ...p, siren: e.target.value }))} />
            <Input className="text-[13px]" placeholder="SIRET" value={form.siret} onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="number" className="text-[13px]" placeholder="Capital (EUR)" value={form.capital_eur} onChange={(e) => setForm((p) => ({ ...p, capital_eur: e.target.value }))} />
            <Input type="date" className="text-[13px]" value={form.incorporation_date} onChange={(e) => setForm((p) => ({ ...p, incorporation_date: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Registered city" value={form.registered_city} onChange={(e) => setForm((p) => ({ ...p, registered_city: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="NAF code" value={form.naf_code} onChange={(e) => setForm((p) => ({ ...p, naf_code: e.target.value }))} />
            <Input className="text-[13px]" placeholder="NAF label" value={form.naf_label} onChange={(e) => setForm((p) => ({ ...p, naf_label: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={addEntity} disabled={!form.legal_name.trim() || loading}>
              Add Entity
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
