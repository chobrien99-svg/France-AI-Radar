"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const PROGRAM_TYPE_OPTIONS = [
  { value: "accelerator", label: "Accelerator" },
  { value: "incubator", label: "Incubator" },
  { value: "france_2030", label: "France 2030" },
  { value: "competition", label: "Competition" },
  { value: "grant_program", label: "Grant Program" },
  { value: "government", label: "Government" },
  { value: "university", label: "University" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
]

type ProgramLink = {
  id: string
  program_name: string
  program_type: string
  edition_label: string | null
  year: number | null
  membership_role: string | null
}

interface Props {
  organizationId: string
  programs: ProgramLink[]
}

export function LinkedPrograms({ organizationId, programs: initial }: Props) {
  const router = useRouter()
  const [programs, setPrograms] = useState<ProgramLink[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    program_name: "",
    program_type: "accelerator",
    edition_label: "",
    year: "",
    membership_role: "",
  })

  async function addProgram() {
    if (!form.program_name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${organizationId}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to link program.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setPrograms((prev) => [...prev, {
      id: data.id,
      program_name: form.program_name,
      program_type: form.program_type,
      edition_label: form.edition_label || null,
      year: form.year ? Number(form.year) : null,
      membership_role: form.membership_role || null,
    }])
    setForm({ program_name: "", program_type: "accelerator", edition_label: "", year: "", membership_role: "" })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function removeProgram(linkId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/programs?link_id=${linkId}`, { method: "DELETE" })
    setPrograms((prev) => prev.filter((p) => p.id !== linkId))
    setLoading(false)
    router.refresh()
  }

  function typeLabel(type: string) {
    return PROGRAM_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Programs & Affiliations
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Program"}
        </Button>
      </div>

      {programs.length > 0 ? (
        <div className="mb-4 space-y-2">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{p.program_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[typeLabel(p.program_type), p.edition_label, p.year, p.membership_role].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-[12px] text-muted-foreground hover:text-destructive"
                onClick={() => removeProgram(p.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No programs linked yet.</p>
      )}

      {showForm && (
        <div className="space-y-3 border-l-2 border-l-primary bg-accent p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="text-[13px]" placeholder="Program name *" value={form.program_name} onChange={(e) => setForm((p) => ({ ...p, program_name: e.target.value }))} />
            <Select className="text-[13px]" value={form.program_type} onChange={(e) => setForm((p) => ({ ...p, program_type: e.target.value }))}>
              {PROGRAM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input className="text-[13px]" placeholder="Edition / cohort label" value={form.edition_label} onChange={(e) => setForm((p) => ({ ...p, edition_label: e.target.value }))} />
            <Input type="number" className="text-[13px]" placeholder="Year" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} />
            <Input className="text-[13px]" placeholder="Role (e.g. laureate, member)" value={form.membership_role} onChange={(e) => setForm((p) => ({ ...p, membership_role: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={addProgram} disabled={!form.program_name.trim() || loading}>
              Add Program
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
