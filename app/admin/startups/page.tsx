import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export default async function AdminStartupsPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  const { data: startups } = await supabase
    .from("organizations")
    .select("id, name, slug, status, signal_count, created_at, product_organizations!inner(product_catalog!inner(slug))")
    .eq("product_organizations.product_catalog.slug", "ai-radar")
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Startups</h1>
        </div>
        <Button asChild>
          <Link href="/admin/startups/new">+ Add Startup</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
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
            {(startups ?? []).map((s) => (
              <tr key={s.id} className="bg-background hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.slug}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.signal_count}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge-signal ${s.status === "active" ? "badge-signal-positive" : "badge-signal-neutral"}`}
                  >
                    {s.status === "active" ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/startups/${s.id}/edit`}>Edit</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/startup/${s.slug}`} target="_blank">View →</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!startups?.length && (
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
