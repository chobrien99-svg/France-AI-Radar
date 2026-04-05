import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  explorer: "Explorer",
  professional: "Pro",
  enterprise: "Enterprise",
}

const TIER_CLASS: Record<string, string> = {
  free: "badge-signal badge-signal-neutral",
  explorer: "badge-signal badge-signal-neutral",
  professional: "badge-signal badge-signal-positive",
  enterprise: "badge-signal badge-signal-positive",
}

export async function AppNav({
  activePage,
}: {
  activePage?: "home" | "database" | "pricing" | "account"
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let tier: string | null = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single()
    tier = data?.subscription_tier ?? "free"
  }

  const navLink = (page: typeof activePage) =>
    activePage === page
      ? `px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-wide text-primary border-b-2 border-primary`
      : `px-3.5 py-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-300 hover:text-foreground`

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md" style={{ borderBottom: '1px solid rgba(193, 199, 206, 0.25)' }}>
      <div className="page-container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center bg-primary text-[12px] font-extrabold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
            AR
          </div>
          <span className="font-serif text-[15px] font-bold tracking-tight text-foreground">
            AI Radar
          </span>
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-1 md:flex">
          <Link href="/" className={navLink("home")}>
            Home
          </Link>
          <Link href="/database" className={navLink("database")}>
            Database
          </Link>
          <Link href="/pricing" className={navLink("pricing")}>
            Pricing
          </Link>
          {user && (
            <Link href="/account" className={navLink("account")}>
              Account
            </Link>
          )}
        </div>

        {/* Right: tier badge + auth actions */}
        <div className="flex items-center gap-2.5">
          {user && tier ? (
            <>
              <Link
                href="/account"
                className={`${TIER_CLASS[tier] ?? TIER_CLASS.free} hover:opacity-80 transition-opacity duration-300`}
              >
                {TIER_LABEL[tier] ?? tier}
              </Link>
              <form action="/auth/signout" method="POST">
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
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
  )
}
