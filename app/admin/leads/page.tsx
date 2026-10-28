import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { LeadActions, LeadResearchButton, LeadsToolbar } from "@/components/admin/lead-actions"
import { pappersUrl } from "@/lib/monitoring/parse"
import { researchPerDay } from "@/lib/leads/vet"

const TABS = [
  { value: "new", label: "To vet" },
  { value: "added", label: "Added" },
  { value: "ignored", label: "Ignored" },
] as const

type Lead = {
  siren: string
  name: string | null
  list_name: string | null
  is_new_company: boolean
  status: "new" | "added" | "ignored"
  first_seen_at: string
  naf_code: string | null
  naf_label: string | null
  legal_form: string | null
  created_on: string | null
  city: string | null
  employer: boolean | null
  directors: { name: string; role: string | null; isCompany: boolean }[] | null
  score: number | null
  score_reasons: string[] | null
  checked_at: string | null
  research: {
    error?: string
    verdict?: "startup" | "consultancy" | "unclear"
    confidence?: number
    summary?: string
    website?: string | null
    founders?: string[]
    links?: { title: string; url: string }[]
  } | null
  researched_at: string | null
}

const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })

function scoreStyle(score: number | null) {
  if (score == null) return "bg-muted text-muted-foreground"
  if (score >= 70) return "bg-emerald-600 text-white"
  if (score >= 40) return "bg-amber-500 text-white"
  return "bg-muted text-muted-foreground"
}

const VERDICT_LABEL = { startup: "Looks like a startup", consultancy: "Looks like a service business", unclear: "Not enough found yet" } as const

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { status: requested } = await searchParams
  const status = TABS.find((t) => t.value === requested)?.value ?? "new"
  const svc = await createServiceClient()
  const [{ data, error }, { count: newCount }] = await Promise.all([
    svc.from("company_leads").select("*").eq("status", status)
      .order("score", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false })
      .limit(300),
    svc.from("company_leads").select("siren", { count: "exact", head: true }).eq("status", "new"),
  ])
  const leads = (data ?? []) as Lead[]

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Companies to vet</h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
          New companies from your Pappers alerts (stated purpose mentions artificial intelligence), best first. Each one is checked
          for free in the government company directory and scored: consulting, IT-services or training activity codes and words
          like CONSULTING or PARTNERS in the name count against; software or R&amp;D activity, several founders, or a company among
          the officers count in favour. Each night Claude also searches the web for the {researchPerDay()} best-scored ones not yet
          researched. Companies already on the site are left out. Add the real startups through{" "}
          <Link href="/admin/startups/new" className="underline">+ Add Startup</Link>, then mark them as added.
        </p>
      </div>

      <LeadsToolbar />

      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "new" ? "/admin/leads" : `/admin/leads?status=${t.value}`}
            className={`border-b-2 px-3 py-2 text-[13px] font-medium ${status === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}{t.value === "new" && newCount ? ` (${newCount})` : ""}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="border-l-2 border-l-destructive bg-card p-4 text-[13px] text-foreground">
          This list isn&rsquo;t set up yet. Run <code>supabase/migrations/20261030_pappers_webhooks.sql</code> and{" "}
          <code>20261031_company_leads_ranking.sql</code> in the Supabase SQL Editor.
        </p>
      ) : leads.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => (
            <li key={l.siren} className="bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-8 w-10 shrink-0 items-center justify-center text-[13px] font-bold ${scoreStyle(l.score)}`}
                    title="Score out of 100">
                    {l.score ?? "–"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground">
                      <a href={pappersUrl(l.siren)} target="_blank" rel="noreferrer" className="hover:underline">{l.name ?? l.siren}</a>
                      {l.is_new_company && <span className="ml-2 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Newly registered</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {[
                        `SIREN ${l.siren}`,
                        l.legal_form,
                        l.naf_code && `${l.naf_code}${l.naf_label ? ` ${l.naf_label}` : ""}`,
                        l.city,
                        l.created_on && `registered ${day(l.created_on)}`,
                        l.employer === true && "has employees",
                        l.list_name && `from “${l.list_name}”`,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {l.directors && l.directors.length > 0 && (
                      <p className="text-[12px] text-muted-foreground">
                        Officers: {l.directors.map((d) => `${d.name}${d.role ? ` (${d.role})` : ""}`).join("; ")}
                      </p>
                    )}
                  </div>
                </div>
                <LeadActions siren={l.siren} status={l.status} />
              </div>

              {l.score_reasons && l.score_reasons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                  {l.score_reasons.map((r, i) => (
                    <li key={i} className={`px-1.5 py-0.5 text-[11px] ${r.startsWith("-") ? "bg-destructive/10 text-destructive" : r.startsWith("+") ? "bg-emerald-600/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {r}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2 pl-[52px] text-[12px]">
                {l.research?.summary ? (
                  <div className="border-l-2 border-l-border pl-3 text-foreground">
                    <p className="font-medium">
                      {l.research.verdict ? VERDICT_LABEL[l.research.verdict] : "Web research"}
                      {typeof l.research.confidence === "number" && <span className="font-normal text-muted-foreground"> · confidence {Math.round(l.research.confidence * 100)}%</span>}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{l.research.summary}</p>
                    {l.research.website && (
                      <p className="mt-0.5">Website: <a href={l.research.website} target="_blank" rel="noreferrer" className="underline">{l.research.website}</a></p>
                    )}
                    {l.research.founders && l.research.founders.length > 0 && <p className="mt-0.5">People: {l.research.founders.join("; ")}</p>}
                    {l.research.links && l.research.links.length > 0 && (
                      <ul className="mt-0.5 list-disc pl-4">
                        {l.research.links.map((link) => (
                          <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer" className="underline">{link.title || link.url}</a></li>
                        ))}
                      </ul>
                    )}
                    {l.researched_at && <p className="mt-0.5 text-muted-foreground">Researched {day(l.researched_at)}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{l.research?.error ? `Research failed: ${l.research.error}` : l.checked_at ? "Not researched yet." : "Waiting for the first check."}</span>
                    {l.status === "new" && <LeadResearchButton siren={l.siren} />}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
