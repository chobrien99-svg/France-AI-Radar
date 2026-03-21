import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="page-container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary text-[12px] font-extrabold text-primary-foreground">
              AR
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              AI Radar
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/database"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-foreground bg-secondary"
            >
              Database
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            {user ? (
              <form action="/auth/signout" method="POST">
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/pricing">Get Access</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {children}
    </div>
  )
}
