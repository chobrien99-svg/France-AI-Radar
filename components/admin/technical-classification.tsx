"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  CLAIMS, EVIDENCE_STATUSES, FACETS, RELATIONSHIP_KINDS, familyLabel,
  type Facet, type RelationshipKind, type TechTerm,
} from "@/lib/taxonomy"
import type { Evidence, TechnicalProfile, Vocabulary } from "@/lib/technical-profile"

interface Props {
  organizationId: string
  profile: TechnicalProfile
  vocab: Vocabulary
}

/** What a newly added term usually means for each facet; editable per link */
const DEFAULT_KIND: Record<Facet, RelationshipKind> = {
  specialization: "develops",
  method: "uses",
  modality: "uses",
  domain: "develops",
}

/** Admin-entered links start as "reported"; "verified" needs a source the editor has checked */
const NEW_LINK_EVIDENCE = { evidence_status: "reported" }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] font-semibold text-muted-foreground">{children}</p>
}

export function TechnicalClassification({ organizationId, profile, vocab }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = `/api/admin/startups/${organizationId}/technical`

  /** Save one change, then re-read the page so every section shows stored state */
  async function save(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const res = await fetch(method === "DELETE" ? `${url}?type=${body.type}&id=${body.id}` : url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Could not save.")
    }
    setBusy(false)
    router.refresh()
    return res.ok
  }

  const linkedLayerIds = new Set([profile.primary?.layer.id, ...profile.secondary.map((l) => l.layer.id)])
  const layerChoices = vocab.layers.filter((l) => l.isActive || l.id === profile.primary?.layer.id)
  const secondaryChoices = vocab.layers.filter((l) => l.isActive && !linkedLayerIds.has(l.id))

  return (
    // Rendered inside the startup form: every control here saves through its own API call,
    // and none of them submits the surrounding form.
    <div className="border border-border p-4">
      <div className="mb-1">
        <p className="text-[12px] font-semibold text-foreground">Technical classification</p>
      </div>
      <p className="mb-5 text-[12px] text-muted-foreground">
        Where the startup sits in the AI stack and what it builds. Each change here saves immediately. Leave anything
        unknown empty rather than guessing; record a source for substantive claims.
      </p>

      {/* ── Layers ── */}
      <div className="space-y-5">
        <div>
          <SectionLabel>Primary technical layer</SectionLabel>
          <Select
            className="text-[13px]"
            value={profile.primary?.layer.id ?? ""}
            disabled={busy}
            onChange={(e) => save("POST", { type: "primary", layer_id: e.target.value || null, ...NEW_LINK_EVIDENCE })}
          >
            <option value="">— Unknown / not yet classified —</option>
            {layerChoices.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            What the company develops and sells, not the tools it merely consumes.
            {profile.primary?.layer.description ? ` ${profile.primary.layer.label}: ${profile.primary.layer.description}.` : ""}
          </p>
          {profile.primary && (
            <EvidenceFields key={profile.primary.id} value={profile.primary} disabled={busy} onSave={(f) => save("PATCH", { type: "layer", id: profile.primary!.id, ...f })} />
          )}
        </div>

        <div>
          <SectionLabel>Secondary technical layers</SectionLabel>
          {profile.secondary.length > 0 && (
            <div className="mb-2 space-y-2">
              {profile.secondary.map((l) => (
                <LinkCard key={l.id} title={l.layer.label} muted={!l.layer.isActive} disabled={busy} onRemove={() => save("DELETE", { type: "layer", id: l.id })}>
                  <EvidenceFields value={l} disabled={busy} onSave={(f) => save("PATCH", { type: "layer", id: l.id, ...f })} />
                </LinkCard>
              ))}
            </div>
          )}
          {secondaryChoices.length > 0 && (
            <Select
              className="text-[13px]"
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && save("POST", { type: "layer", layer_id: e.target.value, ...NEW_LINK_EVIDENCE })}
            >
              <option value="">+ Add a secondary layer (only where it genuinely develops technology)</option>
              {secondaryChoices.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
          )}
        </div>

        {/* ── Terms, one block per facet ── */}
        {FACETS.map((f) => (
          <TermFacet
            key={f.value}
            facet={f.value}
            label={f.label}
            links={profile.terms.filter((t) => t.term.facet === f.value)}
            terms={vocab.terms.filter((t) => t.facet === f.value)}
            disabled={busy}
            onAdd={(term) => save("POST", { type: "term", term_id: term.id, relationship_kind: DEFAULT_KIND[f.value], ...NEW_LINK_EVIDENCE })}
            onSave={(id, fields) => save("PATCH", { type: "term", id, ...fields })}
            onRemove={(id) => save("DELETE", { type: "term", id })}
          />
        ))}

        {/* ── Proprietary technology ── */}
        <div>
          <SectionLabel>Proprietary technology (claims needing evidence)</SectionLabel>
          <div className="space-y-2">
            {CLAIMS.map((c) => {
              const link = profile.claims.find((x) => x.claim === c.value)
              return (
                <div key={c.value} className={link ? "border-l-2 border-l-border bg-card p-3" : "px-1"}>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={!!link}
                      disabled={busy}
                      onChange={() => (link ? save("DELETE", { type: "claim", id: link.id }) : save("POST", { type: "claim", claim: c.value, ...NEW_LINK_EVIDENCE }))}
                    />
                    <span className={link ? "font-semibold text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  </label>
                  {link && <EvidenceFields value={link} disabled={busy} onSave={(f) => save("PATCH", { type: "claim", id: link.id, ...f })} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}

// ------------------------------------------------------------------
// One facet: linked terms plus a keyboard-searchable picker
// ------------------------------------------------------------------

function TermFacet({
  facet, label, links, terms, disabled, onAdd, onSave, onRemove,
}: {
  facet: Facet
  label: string
  links: TechnicalProfile["terms"]
  terms: TechTerm[]
  disabled: boolean
  onAdd: (term: TechTerm) => Promise<boolean>
  onSave: (id: string, fields: Record<string, unknown>) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const linkedIds = new Set(links.map((l) => l.term.id))
  const q = query.trim().toLowerCase()
  const matches = terms.filter(
    (t) =>
      t.isActive &&
      !linkedIds.has(t.id) &&
      (!q || [t.label, t.definition ?? "", ...t.aliases].some((s) => s.toLowerCase().includes(q)))
  )

  async function pick(term: TechTerm) {
    if (await onAdd(term)) {
      setQuery("")
      setActive(0)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); if (open && matches[active]) pick(matches[active]) }
    else if (e.key === "Escape") { setOpen(false) }
  }

  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {links.length > 0 && (
        <div className="mb-2 space-y-2">
          {links.map((l) => (
            <LinkCard
              key={l.id}
              title={l.term.label}
              subtitle={facet === "specialization" ? familyLabel(l.term.family) : undefined}
              muted={!l.term.isActive}
              disabled={disabled}
              onRemove={() => onRemove(l.id)}
            >
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Select
                  className="h-8 w-auto text-[12px]"
                  value={l.kind}
                  disabled={disabled}
                  onChange={(e) => onSave(l.id, { relationship_kind: e.target.value })}
                  aria-label="Relationship"
                >
                  {RELATIONSHIP_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </Select>
                <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={l.isCore} disabled={disabled} onChange={(e) => onSave(l.id, { is_core: e.target.checked })} />
                  Core to the product
                </label>
              </div>
              <EvidenceFields value={l} disabled={disabled} onSave={(f) => onSave(l.id, f)} />
            </LinkCard>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          className="text-[13px]"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {open && matches.length > 0 && (
          <div role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-border bg-card shadow-md">
            {matches.map((t, i) => (
              <div key={t.id}>
                {facet === "specialization" && t.family !== matches[i - 1]?.family && (
                  <p className="px-3 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{familyLabel(t.family)}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`block w-full px-3 py-1.5 text-left ${i === active ? "bg-accent" : "hover:bg-accent"}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(t)}
                >
                  <span className="text-[13px] text-foreground">{t.label}</span>
                  {t.definition && <span className="block text-[11px] text-muted-foreground">{t.definition}</span>}
                </button>
              </div>
            ))}
          </div>
        )}
        {open && query.trim() && matches.length === 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">No matching term. New terms are added to the controlled vocabulary in Supabase.</p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Shared bits
// ------------------------------------------------------------------

function LinkCard({
  title, subtitle, muted, disabled, onRemove, children,
}: {
  title: string
  subtitle?: string
  muted?: boolean
  disabled: boolean
  onRemove: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="border-l-2 border-l-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {title}
            {muted && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(retired term)</span>}
          </p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-[12px] text-muted-foreground hover:text-destructive" onClick={onRemove} disabled={disabled}>
          Remove
        </Button>
      </div>
      {children}
    </div>
  )
}

/** Enter saves the field (via blur) instead of submitting the surrounding startup form */
function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault()
    e.currentTarget.blur()
  }
}

/** Evidence status, source link and note. Text saves when the field loses focus. */
function EvidenceFields({ value, disabled, onSave }: { value: Evidence; disabled: boolean; onSave: (fields: Record<string, unknown>) => void }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
      <Select
        className="h-8 w-auto text-[12px]"
        value={value.evidenceStatus}
        disabled={disabled}
        onChange={(e) => onSave({ evidence_status: e.target.value })}
        aria-label="Evidence status"
      >
        {EVIDENCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </Select>
      <Input
        className="h-8 text-[12px]"
        placeholder="Source URL (paper, repo, docs…)"
        defaultValue={value.sourceUrl ?? ""}
        disabled={disabled}
        onKeyDown={blurOnEnter}
        onBlur={(e) => e.target.value.trim() !== (value.sourceUrl ?? "") && onSave({ source_url: e.target.value })}
      />
      <Input
        className="h-8 text-[12px]"
        placeholder="Source note"
        defaultValue={value.sourceNote ?? ""}
        disabled={disabled}
        onKeyDown={blurOnEnter}
        onBlur={(e) => e.target.value.trim() !== (value.sourceNote ?? "") && onSave({ source_note: e.target.value })}
      />
    </div>
  )
}
