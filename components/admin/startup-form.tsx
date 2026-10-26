"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { tagStrengthLabel } from "@/lib/types"
import { MATURITIES, POSITIONINGS, PRODUCT_ROLES } from "@/lib/taxonomy"
import { LogoUpload } from "@/components/admin/logo-upload"

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
  secondary_city: string
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
  investor_brief: string
  analyst_note: string
  // Product
  product_description: string
  target_market: string
  competitive_landscape: string
  technical_thesis: string
  ai_product_role: string
  technology_positioning: string
  technology_maturity: string
  technology_differentiation: string
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
  name: "", slug: "", city: "", secondary_city: "", country: "France",
  founded_date: "", first_seen_at: "",
  status: "draft",
  website: "", linkedin_url: "", email: "", phone: "",
  description: "", investor_brief: "", analyst_note: "",
  product_description: "", target_market: "", competitive_landscape: "",
  technical_thesis: "",
  ai_product_role: "", technology_positioning: "", technology_maturity: "", technology_differentiation: "",
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
  initialLogoUrl?: string | null
  /** Layers, specializations, methods, modalities, domains and claims; needs a saved startup */
  technicalClassification?: React.ReactNode
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Render helpers (must be outside the component to avoid remounting)
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

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function StartupForm({ initialValues, initialTags = [], startupId, initialLogoUrl = null, technicalClassification }: Props) {
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
      tags,
    }

    const url = startupId ? `/api/admin/startups/${startupId}` : "/api/admin/startups"
    const method = startupId ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok && res.status !== 207) {
      setError(data.error ?? "Something went wrong.")
      setSaving(false)
      return
    }

    // Show warning if partial save (207)
    if (data._warning) {
      setError(`Partial save: ${data._warning}`)
    }

    setSaving(false)

    if (startupId) {
      router.refresh()
    } else {
      router.push(`/admin/startups/${data.id}/edit`)
    }
  }

  const inputClass = "text-[13px]"
  const textareaClass = "min-h-[100px] text-[13px]"

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* ── Logo ── */}
      <Field label="Logo">
        <LogoUpload startupId={startupId} name={form.name} initialUrl={initialLogoUrl} />
      </Field>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary city">
          <Input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Paris" />
        </Field>
        <Field label="Secondary city (optional)">
          <Input className={inputClass} value={form.secondary_city} onChange={(e) => set("secondary_city", e.target.value)} placeholder="e.g. San Francisco, New York" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country">
          <Input className={inputClass} value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft (not visible)</option>
            <option value="active">Published (live)</option>
            <option value="inactive">Inactive (hidden)</option>
            <option value="archived">Archived</option>
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
      <Field label="Investor brief">
        <Textarea
          className="min-h-[140px] text-[13px]"
          value={form.investor_brief}
          onChange={(e) => set("investor_brief", e.target.value)}
          placeholder="Shown at the top of the startup page (Professional). Separate paragraphs with a blank line."
        />
      </Field>
      <Field label="Why this matters (analyst note)">
        <Textarea className="min-h-[70px] text-[13px]" value={form.analyst_note} onChange={(e) => set("analyst_note", e.target.value)} placeholder="One or two sentences shown under the investor brief." />
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
      {/* ── Technical profile ── */}
      {technicalClassification ?? (
        <div className="border-l-2 border-l-primary/30 bg-accent px-4 py-3">
          <p className="text-[12px] font-semibold text-foreground">Technical classification</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Save the startup first. You can then add its primary and secondary technical layers, technical
            specializations, core AI methods, data modalities, target domains and proprietary technology here.
          </p>
        </div>
      )}
      <div>
        <p className="mb-1 text-[12px] font-semibold text-foreground">Technology profile</p>
        <p className="text-[12px] text-muted-foreground">Saved with the &ldquo;Save&rdquo; button at the bottom of the form.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Technology positioning">
          <Select className={inputClass} value={form.technology_positioning} onChange={(e) => set("technology_positioning", e.target.value)}>
            <option value="">— Unknown —</option>
            {POSITIONINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="AI product role">
          <Select className={inputClass} value={form.ai_product_role} onChange={(e) => set("ai_product_role", e.target.value)}>
            <option value="">— Unknown —</option>
            {PRODUCT_ROLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Technology maturity">
          <Select className={inputClass} value={form.technology_maturity} onChange={(e) => set("technology_maturity", e.target.value)}>
            <option value="">— Unknown —</option>
            {MATURITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Technology differentiation">
        <Textarea
          className="min-h-[70px] text-[13px]"
          maxLength={1000}
          value={form.technology_differentiation}
          onChange={(e) => set("technology_differentiation", e.target.value)}
          placeholder="What the company builds that is technically distinctive (short)…"
        />
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
          <option value="not_raising">Not raising</option>
          <option value="exploring">Exploring</option>
          <option value="actively_raising">Actively raising</option>
          <option value="closing">Closing</option>
          <option value="recently_closed">Recently closed</option>
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
              className="flex items-center gap-1.5 border-l-2 border-l-border bg-secondary px-3 py-1 text-[12px]"
            >
              <span className={`h-2 w-2 rounded-full ${
                displayStrength === "positive" ? "bg-accent-green"
                : displayStrength === "warning" ? "bg-[#8a6d00]"
                : displayStrength === "risk" ? "bg-destructive"
                : "bg-[#72787e]"
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
      <SectionTitle>Legal - Admin</SectionTitle>
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
