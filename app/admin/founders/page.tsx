import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export default async function AdminFoundersPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  const { data: founders } = await supabase
    .from("people")
    .select("id, full_name, slug, role, is_repeat_founder, has_phd, has_big_tech_background, big_tech_employer, created_at")
    .order("full_name")

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Founders</h1>
        </div>
        <Button asChild>
          <Link href="/admin/founders/new">+ Add Founder</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Default role</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Pedigree</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(founders ?? []).map((f) => {
              const badges: string[] = []
              if (f.big_tech_employer) badges.push(f.big_tech_employer)
              else if (f.has_big_tech_background) badges.push("Big Tech")
              if (f.has_phd) badges.push("PhD")
              if (f.is_repeat_founder) badges.push("Repeat")

              return (
                <tr key={f.id} className="bg-background hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{f.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{f.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.role ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <span key={b} className="badge-signal badge-signal-neutral text-[10px]">{b}</span>
                      ))}
                      {!badges.length && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/founders/${f.id}/edit`}>Edit</Link>
                      </Button>
                      {f.slug && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/founder/${f.slug}`} target="_blank">View →</Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!founders?.length && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            No founders yet.{" "}
            <Link href="/admin/founders/new" className="underline">Add the first one.</Link>
          </div>
        )}
      </div>
    </div>
  )
}
