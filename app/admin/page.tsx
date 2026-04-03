import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export default async function AdminDashboard() {
  await requireAdmin()
  const supabase = await createServiceClient()

  const [
    { count: totalStartups },
    { count: activeStartups },
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }).eq("organization_type", "startup"),
    supabase.from("organizations").select("*", { count: "exact", head: true }).eq("organization_type", "startup").eq("status", "active"),
  ])

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Dashboard</h1>
        </div>
        <Button asChild>
          <Link href="/admin/startups/new">+ Add Startup</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total startups" value={totalStartups ?? 0} />
        <StatCard label="Active / published" value={activeStartups ?? 0} />
        <StatCard label="Inactive / hidden" value={(totalStartups ?? 0) - (activeStartups ?? 0)} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Quick links</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/startups">Manage Startups →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/startups/new">Add New Startup →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/database" target="_blank">View Live Database →</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-foreground">{value}</p>
    </div>
  )
}
