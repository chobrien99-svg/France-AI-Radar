import Link from "next/link"
import { requireAdmin } from "@/lib/admin"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-secondary">
        <div className="flex h-14 items-center gap-2.5 px-4" style={{ borderBottom: '1px solid rgba(193, 199, 206, 0.25)' }}>
          <div className="flex h-6 w-6 items-center justify-center bg-primary text-[11px] font-extrabold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
            AR
          </div>
          <span className="font-serif text-[13px] font-bold tracking-tight text-foreground">Admin</span>
        </div>
        <nav className="p-2">
          <AdminLink href="/admin">Dashboard</AdminLink>
          <AdminLink href="/admin/startups">Startups</AdminLink>
          <AdminLink href="/admin/founders">Founders</AdminLink>
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
      className="flex items-center border-l-4 border-transparent px-3 py-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-300 hover:border-l-primary hover:bg-accent hover:text-foreground"
    >
      {children}
    </Link>
  )
}
