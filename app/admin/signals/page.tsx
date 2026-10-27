import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { SignalReview, type Candidate } from "@/components/admin/signal-review"

const TABS = [
  { value: "pending", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "dismissed", label: "Dismissed by Claude" },
] as const

export default async function SignalsReviewPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { status: requested } = await searchParams
  const status = TABS.some((t) => t.value === requested) ? requested! : "pending"
  const svc = await createServiceClient()

  const [{ data: rows, error }, { data: lastRun }, { count: pendingCount }] = await Promise.all([
    svc.from("signal_candidates")
      .select("*, organizations(name, slug)")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(status === "pending" ? 300 : 100),
    svc.from("monitoring_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    svc.from("signal_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ])

  const candidates: Candidate[] = (rows ?? []).map((r: Record<string, unknown>) => {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as { name: string; slug: string } | null
    return { ...(r as unknown as Candidate), organization_name: org?.name ?? "Unknown startup", organization_slug: org?.slug ?? null }
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Signals to review</h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
          Each night the Radar checks every startup in the official register (BODACC), the French tech press and Google News.
          Claude drafts a signal for each credible find. Nothing below is public until you approve it.
        </p>
        {lastRun && <LastRun run={lastRun as Record<string, unknown>} />}
      </div>

      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "pending" ? "/admin/signals" : `/admin/signals?status=${t.value}`}
            className={`border-b-2 px-3 py-2 text-[13px] font-medium ${status === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}{t.value === "pending" && pendingCount ? ` (${pendingCount})` : ""}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="border-l-2 border-l-destructive bg-card p-4 text-[13px] text-foreground">
          The review queue isn&rsquo;t set up yet. Run <code>supabase/migrations/20261028_signal_monitoring.sql</code> in the Supabase SQL Editor.
        </p>
      ) : (
        <>
          {status === "dismissed" && (
            <p className="mb-4 text-[12px] text-muted-foreground">
              Items Claude judged to be about a namesake, or not credible enough. They are kept so they aren&rsquo;t read again,
              and you can still approve one if Claude got it wrong.
            </p>
          )}
          <SignalReview candidates={candidates} status={status} />
        </>
      )}
    </div>
  )
}

function LastRun({ run }: { run: Record<string, unknown> }) {
  const when = new Date(String(run.started_at)).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  const errors = Array.isArray(run.errors) ? (run.errors as string[]) : []
  return (
    <details className="mt-3 text-[12px] text-muted-foreground">
      <summary className="cursor-pointer">
        Last check: {when} ({run.kind === "manual" ? "manual" : "nightly"}), {String(run.orgs_checked)} startups, {String(run.items_analyzed)} items read,{" "}
        {String(run.candidates_created)} drafts{errors.length ? `, ${errors.length} problem${errors.length === 1 ? "" : "s"}` : ""}
        {!run.finished_at ? " (did not finish)" : ""}
      </summary>
      {errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {errors.map((e, i) => <li key={i} className="break-all">{e}</li>)}
        </ul>
      )}
    </details>
  )
}
