"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

export type FounderFormValues = {
  full_name: string
  slug: string
  role: string
  bio: string
  linkedin_url: string
  big_tech_employer: string
  academic_lab: string
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
  // Number of previous exits
  previous_exits: string
}

const DEFAULTS: FounderFormValues = {
  full_name: "", slug: "", role: "", bio: "", linkedin_url: "",
  big_tech_employer: "", academic_lab: "",
  has_phd: false, is_repeat_founder: false, has_big_tech_background: false,
  previous_exits: "",
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

interface Props {
  initialValues?: Partial<FounderFormValues>
  founderId?: string
}

export function FounderForm({ initialValues, founderId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FounderFormValues>({ ...DEFAULTS, ...initialValues })
  const [slugLocked, setSlugLocked] = useState(!!founderId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slugLocked) {
      setForm((prev) => ({ ...prev, slug: generateSlug(prev.full_name) }))
    }
  }, [form.full_name, slugLocked])

  const set = useCallback(
    <K extends keyof FounderFormValues>(key: K, value: FounderFormValues[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError("Name is required."); return }
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      previous_exits: form.previous_exits ? Number(form.previous_exits) : null,
    }

    const url = founderId ? `/api/admin/people/${founderId}` : "/api/admin/people"
    const method = founderId ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Something went wrong.")
      setSaving(false)
      return
    }

    const data = await res.json()
    router.push(`/admin/people/${data.id}/edit`)
    router.refresh()
  }

  function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        {children}
      </div>
    )
  }

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <div className="mb-4">
        <Separator className="mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</p>
      </div>
    )
  }

  const inputClass = "text-[13px]"

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* ── Identity ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input className={inputClass} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Marie Dupont" />
        </Field>
        <Field label="Slug (URL)">
          <div className="flex gap-2">
            <Input
              className={inputClass}
              value={form.slug}
              onChange={(e) => { setSlugLocked(true); set("slug", e.target.value) }}
              placeholder="marie-dupont"
            />
            {slugLocked && (
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-[11px]" onClick={() => setSlugLocked(false)}>
                Auto
              </Button>
            )}
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default role / title">
          <Input className={inputClass} value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="CEO & Co-founder" />
        </Field>
        <Field label="LinkedIn URL">
          <Input className={inputClass} value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." />
        </Field>
      </div>

      <Field label="Bio">
        <Textarea className="min-h-[100px] text-[13px]" value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Public biography shown on the founder profile page…" />
      </Field>

      {/* ── Pedigree ── */}
      <SectionTitle>Pedigree & Background</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Big Tech employer">
          <Input className={inputClass} value={form.big_tech_employer} onChange={(e) => set("big_tech_employer", e.target.value)} placeholder="e.g. Google, Meta, Palantir…" />
        </Field>
        <Field label="Academic lab / institution">
          <Input className={inputClass} value={form.academic_lab} onChange={(e) => set("academic_lab", e.target.value)} placeholder="e.g. INRIA, École Polytechnique…" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        {[
          { key: "has_phd" as const, label: "Has PhD" },
          { key: "is_repeat_founder" as const, label: "Repeat founder" },
          { key: "has_big_tech_background" as const, label: "Big Tech background" },
        ].map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => set(key, e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            {label}
          </label>
        ))}
      </div>

      <Field label="Previous exits (count)">
        <Input type="number" className={inputClass} value={form.previous_exits} onChange={(e) => set("previous_exits", e.target.value)} placeholder="0" min={0} />
      </Field>

      {/* ── Submit ── */}
      <Separator className="mt-6" />
      <div className="flex items-center justify-between gap-4">
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <div className="ml-auto flex gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : founderId ? "Save Changes" : "Create Person"}
          </Button>
        </div>
      </div>
    </form>
  )
}
