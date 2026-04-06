import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  draft: { class: "badge-signal badge-signal-warning", label: "Draft" },
  active: { class: "badge-signal badge-signal-positive", label: "Published" },
  inactive: { class: "badge-signal badge-signal-neutral", label: "Inactive" },
  archived: { class: "badge-signal badge-signal-risk", label: "Archived" },
}

export default async function AdminStartupsPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  // Fetch all AI Radar startups (any status) plus any drafts not yet linked
  const [{ data: linkedStartups }, { data: unlinkedDrafts }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, status, signal_count, created_at, product_organizations!inner(product_catalog!inner(slug))")
      .eq("product_organizations.product_catalog.slug", "ai-radar")
      .eq("organization_type", "startup")
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, slug, status, signal_count, created_at")
      .eq("organization_type", "startup")
      .in("status", ["draft"])
      .order("created_at", { ascending: false }),
  ])

  // Merge, dedup by id (some drafts may already be linked)
  const linkedIds = new Set((linkedStartups ?? []).map((s: { id: string }) => s.id))
  const unlinkedOnly = (unlinkedDrafts ?? []).filter((s: { id: string }) => !linkedIds.has(s.id))
  const startups = [...(linkedStartups ?? []), ...unlinkedOnly]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Startups</h1>
        </div>
        <Button asChild>
          <Link href="/admin/startups/new">+ Add Startup</Link>
        </Button>
      </div>

      <div className="overflow-hidden border border-border/40">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Signals</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {startups.map((s) => {
              const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.draft
              return (
                <tr key={s.id} className="bg-background hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.signal_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={badge.class}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/startups/${s.id}/edit`}>Edit</Link>
                      </Button>
                      {s.status === "active" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/startup/${s.slug}`} target="_blank">View →</Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {startups.length === 0 && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            No startups yet.{" "}
            <Link href="/admin/startups/new" className="underline">
              Add the first one.
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
