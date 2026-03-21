import Link from "next/link"
import { requireAdmin } from "@/lib/admin"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-primary text-[11px] font-extrabold text-primary-foreground">
            AR
          </div>
          <span className="text-[13px] font-bold tracking-tight text-foreground">Admin</span>
        </div>
        <nav className="p-2">
          <AdminLink href="/admin">Dashboard</AdminLink>
          <AdminLink href="/admin/startups">Startups</AdminLink>
        </nav>
        <div className="absolute bottom-4 left-0 w-52 px-2">
          <AdminLink href="/">← Back to site</AdminLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-background p-8">
        {children}
      </main>
    </div>
  )
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  )
}
