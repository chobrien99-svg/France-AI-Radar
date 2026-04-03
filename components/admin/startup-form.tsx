"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { tagStrengthLabel } from "@/lib/types"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** strength is now an integer: 5=strong, 3=moderate, 2=neutral, 1=weak */
export type TagRow = { tag: string; strength: number }

const STRENGTH_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: "Strong" },
  { value: 3, label: "Moderate" },
  { value: 2, label: "Neutral" },
  { value: 1, label: "Weak" },
]

export type StartupFormValues = {
  // Core
  name: string
  slug: string
  city: string
  country: string
  founded_date: string
  first_seen_at: string
  status: string
  // Contact
  website: string
  linkedin_url: string
  email: string
  phone: string
  // Narrative
  description: string
  // Product
  product_description: string
  target_market: string
  competitive_landscape: string
  technology_layer: string
  technical_thesis: string
  // Strategy
  current_strategy: string
  business_model_hypothesis: string
  // Fundraising
  total_raised_eur: string
  last_round: string
  est_next_raise: string
  fundraising_status: string
  fundraising_signal_summary: string
  // Legal (admin-only)
  entity_complexity: string
}

const DEFAULTS: StartupFormValues = {
  name: "", slug: "", city: "", country: "France",
  founded_date: "", first_seen_at: "",
  status: "active",
  website: "", linkedin_url: "", email: "", phone: "",
  description: "",
  product_description: "", target_market: "", competitive_landscape: "",
  technology_layer: "", technical_thesis: "",
  current_strategy: "", business_model_hypothesis: "",
  total_raised_eur: "", last_round: "", est_next_raise: "",
  fundraising_status: "unknown", fundraising_signal_summary: "",
  entity_complexity: "",
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface Props {
  initialValues?: Partial<StartupFormValues>
  initialTags?: TagRow[]
  startupId?: string // if set → PATCH; otherwise → POST
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function StartupForm({ initialValues, initialTags = [], startupId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<StartupFormValues>({ ...DEFAULTS, ...initialValues })
  const [tags, setTags] = useState<TagRow[]>(initialTags)
  const [newTagLabel, setNewTagLabel] = useState("")
  const [newTagStrength, setNewTagStrength] = useState<number>(2)
  const [slugLocked, setSlugLocked] = useState(!!startupId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-generate slug from name unless manually edited or editing existing
  useEffect(() => {
    if (!slugLocked) {
      setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) }))
    }
  }, [form.name, slugLocked])

  const set = useCallback(
    <K extends keyof StartupFormValues>(key: K, value: StartupFormValues[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  function addTag() {
    if (!newTagLabel.trim()) return
    setTags((prev) => [...prev, { tag: newTagLabel.trim(), strength: newTagStrength }])
    setNewTagLabel("")
    setNewTagStrength(2)
  }

  function removeTag(i: number) {
    setTags((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) {
      setError("Name and slug are required.")
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      total_raised_eur: form.total_raised_eur ? Number(form.total_raised_eur) : null,
      founded_date: form.founded_date || null,
      first_seen_at: form.first_seen_at || null,
      technology_layer: form.technology_layer || null,
      tags,
    }

    const url = startupId ? `/api/admin/organizations/${startupId}` : "/api/admin/organizations"
    const method = startupId ? "PATCH" : "POST"

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
    router.push(`/admin/organizations/${data.id}/edit`)
    router.refresh()
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function Field({
    label,
    required,
    children,
  }: {
    label: string
    required?: boolean
    children: React.ReactNode
  }) {
    return (
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        {children}
      </div>
    )
  }

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <div className="mb-4">
        <Separator className="mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {children}
        </p>
      </div>
    )
  }

  const inputClass = "text-[13px]"
  const textareaClass = "min-h-[100px] text-[13px]"

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* ── Core ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required>
          <Input
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Mistral AI"
          />
        </Field>
        <Field label="Slug (URL)">
          <div className="flex gap-2">
            <Input
              className={inputClass}
              value={form.slug}
              onChange={(e) => { setSlugLocked(true); set("slug", e.target.value) }}
              placeholder="mistral-ai"
            />
            {slugLocked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-[11px]"
                onClick={() => { setSlugLocked(false) }}
                title="Re-sync slug from name"
              >
                Auto
              </Button>
            )}
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <Input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Paris" />
        </Field>
        <Field label="Country">
          <Input className={inputClass} value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Active (published)</option>
            <option value="inactive">Hidden (draft)</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Founded date">
          <Input type="date" className={inputClass} value={form.founded_date} onChange={(e) => set("founded_date", e.target.value)} />
        </Field>
        <Field label="First seen at">
          <Input type="date" className={inputClass} value={form.first_seen_at} onChange={(e) => set("first_seen_at", e.target.value)} />
        </Field>
      </div>

      {/* ── Contact ── */}
      <SectionTitle>Contact & Web Presence</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website">
          <Input className={inputClass} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
        </Field>
        <Field label="LinkedIn URL">
          <Input className={inputClass} value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/..." />
        </Field>
        <Field label="Email">
          <Input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="hello@example.com" />
        </Field>
        <Field label="Phone">
          <Input type="tel" className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 1 23 45 67 89" />
        </Field>
      </div>

      {/* ── Narrative ── */}
      <SectionTitle>Narrative</SectionTitle>
      <Field label="Description (public)">
        <Textarea className={textareaClass} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short public description shown on the card and profile…" />
      </Field>

      {/* ── Product ── */}
      <SectionTitle>Product & Technology</SectionTitle>
      <Field label="Product description">
        <Textarea className={textareaClass} value={form.product_description} onChange={(e) => set("product_description", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target market">
          <Textarea className={textareaClass} value={form.target_market} onChange={(e) => set("target_market", e.target.value)} />
        </Field>
        <Field label="Competitive landscape">
          <Textarea className={textareaClass} value={form.competitive_landscape} onChange={(e) => set("competitive_landscape", e.target.value)} />
        </Field>
      </div>
      <Field label="Technology layer">
        <Select className={inputClass} value={form.technology_layer} onChange={(e) => set("technology_layer", e.target.value)}>
          <option value="">— None —</option>
          <option value="perception">Perception</option>
          <option value="robotics">Robotics</option>
          <option value="agent_platform">Agent Platform</option>
          <option value="orchestration">Orchestration</option>
          <option value="vertical_ai">Vertical AI</option>
          <option value="infrastructure">Infrastructure</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Technical thesis">
        <Textarea className={textareaClass} value={form.technical_thesis} onChange={(e) => set("technical_thesis", e.target.value)} />
      </Field>

      {/* ── Strategy ── */}
      <SectionTitle>Strategy</SectionTitle>
      <Field label="Current strategy">
        <Textarea className={textareaClass} value={form.current_strategy} onChange={(e) => set("current_strategy", e.target.value)} />
      </Field>
      <Field label="Business model hypothesis">
        <Textarea className={textareaClass} value={form.business_model_hypothesis} onChange={(e) => set("business_model_hypothesis", e.target.value)} />
      </Field>

      {/* ── Fundraising ── */}
      <SectionTitle>Fundraising</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Total raised (EUR)">
          <Input type="number" className={inputClass} value={form.total_raised_eur} onChange={(e) => set("total_raised_eur", e.target.value)} placeholder="5000000" />
        </Field>
        <Field label="Last round">
          <Input className={inputClass} value={form.last_round} onChange={(e) => set("last_round", e.target.value)} placeholder="Seed — €3M — Jan 2025" />
        </Field>
        <Field label="Est. next raise">
          <Input className={inputClass} value={form.est_next_raise} onChange={(e) => set("est_next_raise", e.target.value)} placeholder="Q3 2025" />
        </Field>
      </div>
      <Field label="Fundraising status">
        <Select className={inputClass} value={form.fundraising_status} onChange={(e) => set("fundraising_status", e.target.value)}>
          <option value="unknown">Unknown</option>
          <option value="preparing_for_fundraising">Preparing for fundraising</option>
          <option value="likely_raising_within_12_months">Likely raising within 12 months</option>
          <option value="not_currently_raising">Not currently raising</option>
        </Select>
      </Field>
      <Field label="Fundraising signal summary">
        <Textarea className={textareaClass} value={form.fundraising_signal_summary} onChange={(e) => set("fundraising_signal_summary", e.target.value)} />
      </Field>

      {/* ── Tags ── */}
      <SectionTitle>Signal Tags</SectionTitle>
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tags.map((tag, i) => {
            const displayStrength = tagStrengthLabel(tag.strength)
            return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[12px]"
            >
              <span className={`h-2 w-2 rounded-full ${
                displayStrength === "positive" ? "bg-emerald-500"
                : displayStrength === "warning" ? "bg-amber-500"
                : displayStrength === "risk" ? "bg-rose-500"
                : "bg-zinc-400"
              }`} />
              <span className="text-foreground">{tag.tag}</span>
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                aria-label="Remove tag"
              >
                ×
              </button>
            </div>
          )})}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="flex-1 text-[13px]"
          value={newTagLabel}
          onChange={(e) => setNewTagLabel(e.target.value)}
          placeholder="Tag name, e.g. Series A candidate"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
        />
        <Select
          className="w-36"
          value={String(newTagStrength)}
          onChange={(e) => setNewTagStrength(Number(e.target.value))}
        >
          {STRENGTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <Button type="button" variant="outline" onClick={addTag}>
          Add Tag
        </Button>
      </div>

      {/* ── Legal ── */}
      <SectionTitle>Legal (Admin only — never shown to users)</SectionTitle>
      <Field label="Entity complexity">
        <Input className={inputClass} value={form.entity_complexity} onChange={(e) => set("entity_complexity", e.target.value)} placeholder="e.g. Single SAS, holding in Luxembourg…" />
      </Field>

      {/* ── Submit ── */}
      <Separator className="mt-6" />
      <div className="flex items-center justify-between gap-4">
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <div className="ml-auto flex gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : startupId ? "Save Changes" : "Create Organization"}
          </Button>
        </div>
      </div>
    </form>
  )
}
