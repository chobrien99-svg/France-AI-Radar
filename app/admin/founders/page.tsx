import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export default async function AdminFoundersPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  // Only show people linked to AI Radar organizations
  const { data: founders } = await supabase
    .from("organization_people")
    .select(`
      role,
      people(id, full_name, slug, is_repeat_founder, has_phd, has_big_tech_background, big_tech_employer, created_at)
    `)
    .eq("is_founder", true)
    .order("created_at", { ascending: false, referencedTable: "people" })

  // Deduplicate people (same person may be linked to multiple orgs)
  const seen = new Set<string>()
  const uniqueFounders = (founders ?? [])
    .map((row: { role: string | null; people: Record<string, unknown> | Record<string, unknown>[] | null }) => {
      const p = Array.isArray(row.people) ? row.people[0] : row.people
      if (!p || !p.id || !p.full_name) return null
      if (seen.has(p.id as string)) return null
      seen.add(p.id as string)
      return {
        id: p.id as string,
        full_name: p.full_name as string,
        slug: p.slug as string | null,
        role: row.role,
        is_repeat_founder: p.is_repeat_founder as boolean,
        has_phd: p.has_phd as boolean,
        has_big_tech_background: p.has_big_tech_background as boolean,
        big_tech_employer: p.big_tech_employer as string | null,
      }
    })
    .filter(Boolean) as Array<{
      id: string; full_name: string; slug: string | null; role: string | null;
      is_repeat_founder: boolean; has_phd: boolean; has_big_tech_background: boolean; big_tech_employer: string | null
    }>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Founders</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Showing people linked as founders to AI Radar startups
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/founders/new">+ Add Founder</Link>
        </Button>
      </div>

      <div className="overflow-hidden border border-border/40">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Pedigree</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {uniqueFounders.map((f) => {
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
        {uniqueFounders.length === 0 && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            No founders linked yet.{" "}
            <Link href="/admin/founders/new" className="underline">Add the first one.</Link>
          </div>
        )}
      </div>
    </div>
  )
}
