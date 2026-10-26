"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { CLAIMS, EVIDENCE_STATUSES, FACETS, MATURITIES, POSITIONINGS, PRODUCT_ROLES, RELATIONSHIP_KINDS, labelFor } from "@/lib/taxonomy"
import { FUNDING_STAGES, FUNDRAISING_STATUSES, PROGRAM_TYPES, SIGNAL_TYPES, type Issue, type NormalizedDraft } from "@/lib/startup-import"

type CheckResponse = {
  ok: boolean
  errors: Issue[]
  warnings: Issue[]
  draft: NormalizedDraft | null
  matchedFounders?: number[]
  created?: { id: string; slug: string }
}

const STRENGTH_LABEL: Record<number, string> = { 5: "Strong", 3: "Moderate", 2: "Neutral", 1: "Weak" }
const eur = (n: number | null) => (n === null ? null : `€${n.toLocaleString("en-GB")}`)

export function StartupImport() {
  const [text, setText] = useState("")
  const [checked, setChecked] = useState<CheckResponse | null>(null)
  const [checkedText, setCheckedText] = useState("")
  const [busy, setBusy] = useState<"check" | "create" | null>(null)
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  async function send(mode: "check" | "create") {
    setBusy(mode)
    setRequestError(null)
    try {
      const res = await fetch("/api/admin/startups/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
      })
      const data = (await res.json().catch(() => null)) as CheckResponse | null
      if (!data) {
        setRequestError(`The server answered ${res.status} without details.`)
      } else if (data.created) {
        setCreated(data.created)
      } else {
        setChecked(data)
        setCheckedText(text)
      }
    } catch {
      setRequestError("Could not reach the server. Check your connection and try again.")
    }
    setBusy(null)
  }

  if (created) {
    return (
      <div className="border-l-2 border-l-primary bg-accent p-5">
        <p className="text-[14px] font-semibold text-foreground">Draft startup created</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          It is saved as a <b>Draft</b>, so it is not visible on the site yet. Review it in the editor, then set its status to Published.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild><Link href={`/admin/startups/${created.id}/edit`}>Open in the editor</Link></Button>
          <Button variant="outline" onClick={() => { setCreated(null); setChecked(null); setText("") }}>Import another</Button>
        </div>
      </div>
    )
  }

  const stale = checked && checkedText !== text
  const canCreate = checked?.ok && !stale && busy === null

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Claude draft</label>
        <Textarea
          className="min-h-[220px] font-mono text-[12px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Paste the whole Claude reply, or just the block that starts with ```json and contains \"france-ai-radar/startup-draft@1\"."}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => send("check")} disabled={!text.trim() || busy !== null}>
            {busy === "check" ? "Checking…" : "Check draft"}
          </Button>
          <Button type="button" onClick={() => send("create")} disabled={!canCreate}>
            {busy === "create" ? "Creating…" : "Create draft startup"}
          </Button>
          {stale && <span className="text-[12px] text-muted-foreground">The text changed since the last check. Check again before creating.</span>}
        </div>
        {requestError && <p className="mt-2 text-[12px] text-destructive">{requestError}</p>}
      </div>

      {checked && !stale && <CheckResult result={checked} />}
    </div>
  )
}

// ------------------------------------------------------------------
// Result of a check: issues first, then a preview of what will be saved
// ------------------------------------------------------------------

function CheckResult({ result }: { result: CheckResponse }) {
  const { errors, warnings, draft } = result
  return (
    <div className="space-y-5">
      {errors.length > 0 && (
        <IssueList tone="error" title={`${errors.length} problem${errors.length > 1 ? "s" : ""} to fix before importing`} issues={errors} />
      )}
      {errors.length === 0 && (
        <div className="border-l-2 border-l-primary bg-accent px-4 py-3 text-[13px] text-foreground">
          Ready to import. Review the preview below; the startup will be created as a <b>Draft</b>.
        </div>
      )}
      {warnings.length > 0 && (
        <IssueList tone="warning" title={`${warnings.length} note${warnings.length > 1 ? "s" : ""}: items adjusted or skipped`} issues={warnings} />
      )}
      {draft && <Preview draft={draft} matchedFounders={result.matchedFounders ?? []} />}
    </div>
  )
}

function IssueList({ tone, title, issues }: { tone: "error" | "warning"; title: string; issues: Issue[] }) {
  return (
    <div className={`border-l-2 px-4 py-3 ${tone === "error" ? "border-l-destructive bg-destructive/5" : "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30"}`}>
      <p className={`text-[13px] font-semibold ${tone === "error" ? "text-destructive" : "text-foreground"}`}>{title}</p>
      <ul className="mt-2 space-y-1">
        {issues.map((i, n) => (
          <li key={n} className="text-[12px] text-foreground">
            {i.path && <code className="mr-1.5 text-[11px] text-muted-foreground">{i.path}</code>}
            {i.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Separator className="mb-3" />
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

/** One label/value line; empty values read "Unknown" so gaps are visible */
function Line({ k, v }: { k: string; v: React.ReactNode }) {
  const empty = v === null || v === undefined || v === ""
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 text-[13px]">
      <span className="text-muted-foreground">{k}</span>
      <span className={empty ? "text-muted-foreground italic" : "whitespace-pre-line text-foreground"}>{empty ? "Unknown" : v}</span>
    </div>
  )
}

function Evidence({ e }: { e: { evidence_status: string; source_url: string | null; source_note: string | null } }) {
  return (
    <span className="text-[11px] text-muted-foreground">
      {" · "}{labelFor(EVIDENCE_STATUSES, e.evidence_status)}
      {e.source_note && ` · ${e.source_note}`}
      {e.source_url && <> · <a className="underline" href={e.source_url} target="_blank" rel="noopener noreferrer">source</a></>}
    </span>
  )
}

function Preview({ draft, matchedFounders }: { draft: NormalizedDraft; matchedFounders: number[] }) {
  const { organization: o, profile: p } = draft
  return (
    <div className="space-y-5 border border-border p-5">
      <p className="text-[14px] font-semibold text-foreground">Preview: what will be saved</p>

      <Section title="Core">
        <Line k="Company name" v={o.name} />
        <Line k="Slug (URL)" v={`/startup/${o.slug}`} />
        <Line k="City" v={[o.city, o.secondary_city].filter(Boolean).join(" & ")} />
        <Line k="Country" v={o.country} />
        <Line k="Status" v="Draft (not visible)" />
        <Line k="Founded date" v={o.founded_date} />
        <Line k="First seen at" v={`${o.first_seen_at} (import date)`} />
      </Section>

      <Section title="Contact & web presence">
        <Line k="Website" v={o.website} />
        <Line k="LinkedIn URL" v={o.linkedin_url} />
        <Line k="Email" v={o.email} />
        <Line k="Phone" v={o.phone} />
      </Section>

      <Section title="Narrative & product">
        <Line k="Description (public)" v={o.description} />
        <Line k="Product description" v={p.product_description} />
        <Line k="Target market" v={p.target_market} />
        <Line k="Competitive landscape" v={p.competitive_landscape} />
        <Line k="Technical thesis" v={p.technical_thesis} />
      </Section>

      <Section title="Technical classification">
        <Line k="1. Primary layer" v={draft.primaryLayer && <>{draft.primaryLayer.label}<Evidence e={draft.primaryLayer} /></>} />
        <Line k="2. Secondary layers" v={draft.secondaryLayers.length ? draft.secondaryLayers.map((l) => <div key={l.layer_id}>{l.label}<Evidence e={l} /></div>) : null} />
        {FACETS.map((f, i) => {
          const items = draft.terms.filter((t) => t.facet === f.value)
          return (
            <Line
              key={f.value}
              k={`${i + 3}. ${f.label}`}
              v={items.length ? items.map((t) => (
                <div key={`${t.term_id}-${t.relationship_kind}`}>
                  {t.label} <span className="text-[11px] text-muted-foreground">({labelFor(RELATIONSHIP_KINDS, t.relationship_kind)}{t.is_core ? ", core" : ""})</span><Evidence e={t} />
                </div>
              )) : null}
            />
          )
        })}
        <Line k="7. AI product role" v={labelFor(PRODUCT_ROLES, p.ai_product_role)} />
        <Line k="8. Differentiation" v={p.technology_differentiation} />
        <Line k="9. Proprietary technology" v={draft.claims.length ? draft.claims.map((c) => <div key={c.claim}>{labelFor(CLAIMS, c.claim)}<Evidence e={c} /></div>) : null} />
        <Line k="10. Maturity" v={labelFor(MATURITIES, p.technology_maturity)} />
        <Line k="11. Positioning" v={labelFor(POSITIONINGS, p.technology_positioning)} />
      </Section>

      <Section title="Strategy & fundraising">
        <Line k="Current strategy" v={p.current_strategy} />
        <Line k="Business model" v={p.business_model_hypothesis} />
        <Line k="Total raised" v={eur(o.total_raised_eur)} />
        <Line k="Last round" v={o.last_round} />
        <Line k="Est. next raise" v={p.est_next_raise} />
        <Line k="Fundraising status" v={labelFor(FUNDRAISING_STATUSES, o.fundraising_status)} />
        <Line k="Signal summary" v={p.fundraising_signal_summary} />
      </Section>

      <Section title="Tags, sectors, legal, brief">
        <Line k="Signal tags" v={draft.tags.length ? draft.tags.map((t) => `${t.tag} (${STRENGTH_LABEL[t.strength] ?? t.strength})`).join(" · ") : null} />
        <Line k="Sectors" v={draft.sectors.length ? draft.sectors.map((s) => `${s.name}${s.is_primary ? " (primary)" : ""}`).join(" · ") : null} />
        <Line k="Entity complexity" v={p.entity_complexity} />
        <Line k="Investor brief" v={p.investor_brief} />
        <Line k="Why this matters" v={p.analyst_note} />
      </Section>

      <Section title={`Founders (${draft.founders.length})`}>
        {draft.founders.length === 0 && <Line k="Founders" v={null} />}
        {draft.founders.map((f, i) => (
          <Line
            key={f.full_name}
            k={f.full_name}
            v={<>{f.role ?? "Role unknown"} · {matchedFounders.includes(i) ? "links the existing profile" : "new founder profile"}{f.person.short_bio ? ` · ${f.person.short_bio}` : ""}</>}
          />
        ))}
      </Section>

      <Section title={`Signals, grants, funding, programs, legal entities`}>
        <Line k={`Signals (${draft.signals.length})`} v={draft.signals.length ? draft.signals.map((s, i) => <div key={i}>{s.signal_date ?? "undated"} · {labelFor(SIGNAL_TYPES, s.signal_type)} · {s.title}{s.strength ? ` · strength ${s.strength}` : ""}</div>) : null} />
        <Line k={`Grants (${draft.grants.length})`} v={draft.grants.length ? draft.grants.map((g, i) => <div key={i}>{g.grant_name}{g.granting_body ? ` · ${g.granting_body}` : ""}{g.amount_eur !== null ? ` · ${eur(g.amount_eur)}` : ""}</div>) : null} />
        <Line k={`Funding rounds (${draft.fundingRounds.length})`} v={draft.fundingRounds.length ? draft.fundingRounds.map((r, i) => <div key={i}>{labelFor(FUNDING_STAGES, r.stage)}{r.amount_eur !== null ? ` · ${eur(r.amount_eur)}` : ""}{r.announced_date ? ` · ${r.announced_date}` : ""}{r.is_estimated ? " · estimated" : ""}</div>) : null} />
        <Line k={`Programs (${draft.programs.length})`} v={draft.programs.length ? draft.programs.map((pr, i) => <div key={i}>{pr.program_name} · {labelFor(PROGRAM_TYPES, pr.program_type)}{pr.year ? ` · ${pr.year}` : ""}</div>) : null} />
        <Line k={`Legal entities (${draft.legalEntities.length})`} v={draft.legalEntities.length ? draft.legalEntities.map((e, i) => <div key={i}>{e.legal_name}{e.legal_form ? ` (${e.legal_form})` : ""}{e.siren ? ` · SIREN ${e.siren}` : ""}</div>) : null} />
      </Section>
    </div>
  )
}
