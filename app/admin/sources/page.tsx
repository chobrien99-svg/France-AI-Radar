import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { ADAPTERS } from "@/lib/connectors/registry"
import { SourceControls } from "@/components/admin/source-controls"

type Row = Record<string, unknown>

const when = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }) : "never"

const STATUS: Record<string, string> = { running: "Running (or stopped unexpectedly)", succeeded: "OK", partial: "OK with problems", failed: "Failed" }

export default async function SourcesPage() {
  await requireAdmin()
  const svc = await createServiceClient()
  const [{ data: sources, error }, { data: runs }, { data: failures }] = await Promise.all([
    svc.from("detection_sources").select("*").order("name"),
    svc.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(30),
    svc.from("ingestion_failures").select("id, source_id, external_id, error, created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(50),
  ])
  const cronOn = process.env.EARLY_DETECTION_ENABLED === "1"

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin · Early detection</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Sources</h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
          Where the Radar looks for possible founders before they have a company. Each read is logged below.
          What a source finds goes to <Link href="/admin/candidates" className="underline">Candidates</Link> for review; nothing is published.
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Daily automatic read (02:47 UTC): {cronOn ? "on, for sources switched on below" : "off. Set EARLY_DETECTION_ENABLED=1 in Vercel to turn it on; you can still read a source by hand."}
        </p>
      </div>

      {error ? (
        <p className="border-l-2 border-l-destructive bg-card p-4 text-[13px] text-foreground">
          Early detection isn&rsquo;t set up in this database yet. Apply <code>supabase/migrations/20261104_early_detection_foundation.sql</code>.
        </p>
      ) : (
        <div className="space-y-4">
          {((sources ?? []) as Row[]).map((s) => {
            const last = ((runs ?? []) as Row[]).find((r) => r.source_id === s.id)
            const open = ((failures ?? []) as Row[]).filter((f) => f.source_id === s.id)
            const failing = Number(s.consecutive_failures) > 0
            return (
              <div key={s.id as string} className={`data-card p-4 ${failing ? "border-l-2 border-l-destructive" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">{s.name as string}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {s.owner as string} · {s.license as string}{s.commercial_use_ok === true ? " · commercial use allowed" : s.commercial_use_ok === false ? " · commercial use NOT allowed" : " · terms not yet checked"}
                    </p>
                  </div>
                  <span className={`text-[12px] font-medium ${s.enabled ? "text-primary" : "text-muted-foreground"}`}>{s.enabled ? "Switched on" : "Switched off"}</span>
                </div>
                <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Last read</dt><dd>{when(s.last_run_at)}{last ? ` · ${STATUS[last.status as string] ?? last.status}` : ""}</dd>
                  <dt className="text-muted-foreground">Last successful read</dt><dd>{when(s.last_success_at)}{failing ? ` · ${s.consecutive_failures} failed since` : ""}</dd>
                  {last && (<><dt className="text-muted-foreground">Last read found</dt><dd>{String(last.fetched)} items: {String(last.new_records)} new, {String(last.changed_records)} changed, {String(last.unchanged_records)} unchanged{Number(last.failed_records) ? `, ${last.failed_records} unreadable` : ""}; {String(last.candidates_created)} new candidates</dd></>)}
                  <dt className="text-muted-foreground">Publisher updates</dt><dd>{s.cadence as string}</dd>
                  {s.url ? (<><dt className="text-muted-foreground">Source page</dt><dd><a className="underline" href={s.url as string} target="_blank" rel="noopener noreferrer">open ↗</a></dd></>) : null}
                </dl>
                {s.notes ? <p className="mt-2 text-[12px] text-muted-foreground">{s.notes as string}</p> : null}
                {ADAPTERS[s.slug as string] ? (
                  <SourceControls slug={s.slug as string} enabled={!!s.enabled} neverRead={!s.last_success_at} />
                ) : (
                  <p className="mt-3 text-[12px] text-muted-foreground">No connector for this source yet.</p>
                )}
                {open.length > 0 && (
                  <details className="mt-3 text-[12px]">
                    <summary className="cursor-pointer text-muted-foreground">{open.length} item{open.length === 1 ? "" : "s"} couldn&rsquo;t be read (retried on the next read)</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {open.slice(0, 20).map((f) => <li key={f.id as string} className="break-all">{when(f.created_at)}: {f.external_id ? `${f.external_id}: ` : ""}{f.error as string}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(runs ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent reads</h2>
          <table className="w-full text-[12px]">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1 font-medium">Started</th><th className="font-medium">Kind</th><th className="font-medium">Result</th><th className="font-medium">Items</th><th className="font-medium">New / changed</th><th className="font-medium">Candidates</th></tr>
            </thead>
            <tbody>
              {((runs ?? []) as Row[]).map((r) => {
                const errs = Array.isArray(r.errors) ? (r.errors as string[]) : []
                return (
                  <tr key={r.id as string} className="border-t border-border align-top">
                    <td className="py-1">{when(r.started_at)}</td>
                    <td>{r.kind === "backfill" ? "history import" : r.kind as string}</td>
                    <td>
                      {STATUS[r.status as string] ?? (r.status as string)}
                      {errs.length > 0 && (
                        <details><summary className="cursor-pointer text-muted-foreground">{errs.length} problem{errs.length === 1 ? "" : "s"}</summary>
                          <ul className="list-disc pl-4">{errs.map((e, i) => <li key={i} className="break-all">{e}</li>)}</ul>
                        </details>
                      )}
                    </td>
                    <td>{String(r.fetched)}</td>
                    <td>{String(r.new_records)} / {String(r.changed_records)}</td>
                    <td>{String(r.candidates_created)} new, {String(r.candidates_updated)} updated</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
