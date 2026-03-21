"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type TagRow = { label: string; strength: "positive" | "warning" | "risk" | "neutral" }

export type StartupFormValues = {
  // Core
  name: string
  slug: string
  city: string
  country: string
  sector: string
  stage: string
  founded_date: string
  first_seen_at: string
  incorporation_date: string
  signal_source: string
  is_active: boolean
  // Contact
  website_url: string
  linkedin_url: string
  contact_email: string
  contact_phone: string
  // Narrative
  description: string
  investor_brief: string
  analyst_note: string
  // Product
  product_description: string
  target_market: string
  competitive_landscape: string
  technology_layer: string
  product_modality: string
  technical_thesis: string
  technology_stage: string
  // Strategy
  startup_origin_type: string
  company_origin: string
  current_strategy: string
  business_model_hypothesis: string
  // Fundraising
  total_raised_eur: string
  last_round: string
  est_next_raise: string
  fundraising_status: string
  fundraising_signal_summary: string
  funding_notes: string
  // Legal
  entity_complexity: string
}

const DEFAULTS: StartupFormValues = {
  name: "", slug: "", city: "", country: "France",
  sector: "ai_agents", stage: "unknown",
  founded_date: "", first_seen_at: "", incorporation_date: "",
  signal_source: "", is_active: true,
  website_url: "", linkedin_url: "", contact_email: "", contact_phone: "",
  description: "", investor_brief: "", analyst_note: "",
  product_description: "", target_market: "", competitive_landscape: "",
  technology_layer: "", product_modality: "software", technical_thesis: "", technology_stage: "",
  startup_origin_type: "new_startup", company_origin: "", current_strategy: "", business_model_hypothesis: "",
  total_raised_eur: "", last_round: "", est_next_raise: "",
  fundraising_status: "unknown", fundraising_signal_summary: "", funding_notes: "",
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
  const [newTagStrength, setNewTagStrength] = useState<TagRow["strength"]>("neutral")
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
    setTags((prev) => [...prev, { label: newTagLabel.trim(), strength: newTagStrength }])
    setNewTagLabel("")
    setNewTagStrength("neutral")
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
      incorporation_date: form.incorporation_date || null,
      signal_source: form.signal_source || null,
      technology_layer: form.technology_layer || null,
      technology_stage: form.technology_stage || null,
      tags,
    }

    const url = startupId ? `/api/admin/startups/${startupId}` : "/api/admin/startups"
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
    router.push(`/admin/startups/${data.id}/edit`)
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
          <Select value={form.is_active ? "true" : "false"} onChange={(e) => set("is_active", e.target.value === "true")}>
            <option value="true">Active (published)</option>
            <option value="false">Hidden (draft)</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sector" required>
          <Select className={inputClass} value={form.sector} onChange={(e) => set("sector", e.target.value)}>
            <option value="ai_agents">AI Agents</option>
            <option value="robotics">Robotics</option>
            <option value="bioai">BioAI</option>
            <option value="deeptech">Deep Tech</option>
            <option value="cybersecurity_ai">Cybersecurity AI</option>
            <option value="fintech_ai">Fintech AI</option>
            <option value="healthtech_ai">Healthtech AI</option>
            <option value="edtech_ai">EdTech AI</option>
            <option value="climate_ai">Climate AI</option>
            <option value="legaltech_ai">LegalTech AI</option>
            <option value="logistics_ai">Logistics AI</option>
            <option value="manufacturing_ai">Manufacturing AI</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Stage">
          <Select className={inputClass} value={form.stage} onChange={(e) => set("stage", e.target.value)}>
            <option value="pre_seed">Pre-Seed</option>
            <option value="seed">Seed</option>
            <option value="series_a">Series A</option>
            <option value="series_b_plus">Series B+</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
        <Field label="Signal Source">
          <Select className={inputClass} value={form.signal_source} onChange={(e) => set("signal_source", e.target.value)}>
            <option value="">— None —</option>
            <option value="stealth">Stealth</option>
            <option value="incorporated">Incorporated</option>
            <option value="accelerator">Accelerator</option>
            <option value="incubator">Incubator</option>
            <option value="france_2030_laureat">France 2030 Lauréat</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Founded date">
          <Input type="date" className={inputClass} value={form.founded_date} onChange={(e) => set("founded_date", e.target.value)} />
        </Field>
        <Field label="First seen at">
          <Input type="date" className={inputClass} value={form.first_seen_at} onChange={(e) => set("first_seen_at", e.target.value)} />
        </Field>
        <Field label="Incorporation date">
          <Input type="date" className={inputClass} value={form.incorporation_date} onChange={(e) => set("incorporation_date", e.target.value)} />
        </Field>
      </div>

      {/* ── Contact ── */}
      <SectionTitle>Contact & Web Presence</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website URL">
          <Input className={inputClass} value={form.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://example.com" />
        </Field>
        <Field label="LinkedIn URL">
          <Input className={inputClass} value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/..." />
        </Field>
        <Field label="Contact email">
          <Input type="email" className={inputClass} value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="hello@example.com" />
        </Field>
        <Field label="Contact phone">
          <Input type="tel" className={inputClass} value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+33 1 23 45 67 89" />
        </Field>
      </div>

      {/* ── Narrative ── */}
      <SectionTitle>Narrative</SectionTitle>
      <Field label="Description (public)">
        <Textarea className={textareaClass} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short public description shown on the card and profile…" />
      </Field>
      <Field label="Investor brief (Professional+)">
        <Textarea className="min-h-[160px] text-[13px]" value={form.investor_brief} onChange={(e) => set("investor_brief", e.target.value)} placeholder="Detailed analysis for investors…" />
      </Field>
      <Field label="Analyst note">
        <Textarea className={textareaClass} value={form.analyst_note} onChange={(e) => set("analyst_note", e.target.value)} placeholder="Why this matters / key thesis…" />
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
      <div className="grid gap-4 sm:grid-cols-3">
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
        <Field label="Product modality">
          <Select className={inputClass} value={form.product_modality} onChange={(e) => set("product_modality", e.target.value)}>
            <option value="software">Software</option>
            <option value="hardware">Hardware</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </Field>
        <Field label="Technology stage">
          <Select className={inputClass} value={form.technology_stage} onChange={(e) => set("technology_stage", e.target.value)}>
            <option value="">— None —</option>
            <option value="concept">Concept</option>
            <option value="prototype">Prototype</option>
            <option value="pilot">Pilot</option>
            <option value="production">Production</option>
          </Select>
        </Field>
      </div>
      <Field label="Technical thesis">
        <Textarea className={textareaClass} value={form.technical_thesis} onChange={(e) => set("technical_thesis", e.target.value)} />
      </Field>

      {/* ── Strategy ── */}
      <SectionTitle>Strategy & Origin</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Origin type">
          <Select className={inputClass} value={form.startup_origin_type} onChange={(e) => set("startup_origin_type", e.target.value)}>
            <option value="new_startup">New Startup</option>
            <option value="founder_reboot">Founder Reboot</option>
            <option value="research_spinout">Research Spinout</option>
            <option value="consultancy_evolution">Consultancy Evolution</option>
            <option value="venture_studio_launch">Venture Studio Launch</option>
          </Select>
        </Field>
        <Field label="Company origin">
          <Input className={inputClass} value={form.company_origin} onChange={(e) => set("company_origin", e.target.value)} placeholder="e.g. Spun out of INRIA in 2023…" />
        </Field>
      </div>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fundraising signal summary">
          <Textarea className={textareaClass} value={form.fundraising_signal_summary} onChange={(e) => set("fundraising_signal_summary", e.target.value)} />
        </Field>
        <Field label="Funding notes">
          <Textarea className={textareaClass} value={form.funding_notes} onChange={(e) => set("funding_notes", e.target.value)} />
        </Field>
      </div>

      {/* ── Tags ── */}
      <SectionTitle>Signal Tags</SectionTitle>
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[12px]"
            >
              <span className={`h-2 w-2 rounded-full ${
                tag.strength === "positive" ? "bg-emerald-500"
                : tag.strength === "warning" ? "bg-amber-500"
                : tag.strength === "risk" ? "bg-rose-500"
                : "bg-zinc-400"
              }`} />
              <span className="text-foreground">{tag.label}</span>
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                aria-label="Remove tag"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="flex-1 text-[13px]"
          value={newTagLabel}
          onChange={(e) => setNewTagLabel(e.target.value)}
          placeholder="Tag label, e.g. Series A candidate"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
        />
        <Select
          className="w-36"
          value={newTagStrength}
          onChange={(e) => setNewTagStrength(e.target.value as TagRow["strength"])}
        >
          <option value="positive">Positive</option>
          <option value="warning">Warning</option>
          <option value="risk">Risk</option>
          <option value="neutral">Neutral</option>
        </Select>
        <Button type="button" variant="outline" onClick={addTag}>
          Add Tag
        </Button>
      </div>

      {/* ── Legal ── */}
      <SectionTitle>Legal</SectionTitle>
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
            {saving ? "Saving…" : startupId ? "Save Changes" : "Create Startup"}
          </Button>
        </div>
      </div>
    </form>
  )
}
