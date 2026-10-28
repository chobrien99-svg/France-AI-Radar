import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { LeadActions } from "@/components/admin/lead-actions"
import { pappersUrl } from "@/lib/monitoring/parse"

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
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { status: requested } = await searchParams
  const status = TABS.find((t) => t.value === requested)?.value ?? "new"
  const svc = await createServiceClient()
  const [{ data, error }, { count: newCount }] = await Promise.all([
    svc.from("company_leads").select("*").eq("status", status).order("first_seen_at", { ascending: false }).limit(300),
    svc.from("company_leads").select("siren", { count: "exact", head: true }).eq("status", "new"),
  ])
  const leads = (data ?? []) as Lead[]

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Companies to vet</h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
          Companies your Pappers alerts found (for example, new SAS companies whose stated purpose mentions artificial intelligence).
          Companies already on the site are left out. Open each on Pappers, then add the real startups through{" "}
          <Link href="/admin/startups/new" className="underline">+ Add Startup</Link> and mark them as added.
        </p>
      </div>

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
          This list isn&rsquo;t set up yet. Run <code>supabase/migrations/20261030_pappers_webhooks.sql</code> in the Supabase SQL Editor.
        </p>
      ) : leads.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-border bg-card">
          {leads.map((l) => (
            <li key={l.siren} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground">
                  <a href={pappersUrl(l.siren)} target="_blank" rel="noreferrer" className="hover:underline">{l.name ?? l.siren}</a>
                  {l.is_new_company && <span className="ml-2 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Newly registered</span>}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  SIREN {l.siren}{l.list_name ? ` · alert “${l.list_name}”` : ""} · found{" "}
                  {new Date(l.first_seen_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })}
                </p>
              </div>
              <LeadActions siren={l.siren} status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
