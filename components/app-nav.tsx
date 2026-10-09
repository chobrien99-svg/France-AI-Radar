import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AnalyticsIdentifier } from "@/components/analytics-identifier"

const TIER_LABEL: Record<string, string> = {
  explorer: "Explorer",
  professional: "Pro",
  enterprise: "Enterprise",
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
  let userEmail: string | null = null
  let isAdmin = false
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("subscription_tier, email, is_admin")
      .eq("id", user.id)
      .single()
    tier = data?.subscription_tier ?? "explorer"
    userEmail = data?.email ?? user.email ?? null
    isAdmin = !!data?.is_admin
  }

  const navLink = (page: typeof activePage) =>
    activePage === page
      ? "rounded-[5px] bg-e-blue/12 px-3 py-[7px] text-[13px] font-medium text-e-blue-soft"
      : "rounded-[5px] px-3 py-[7px] text-[13px] font-medium text-tx-dm transition-colors duration-200 hover:bg-white/5 hover:text-tx-d"

  return (
    <nav className="sticky top-0 z-50 border-b border-white/9 bg-ink/95 backdrop-blur-md">
      {user && tier && (
        <AnalyticsIdentifier
          userId={user.id}
          email={userEmail}
          tier={tier}
          isAdmin={isAdmin}
        />
      )}
      <div className="page-container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center bg-e-blue text-[11px] font-extrabold text-white">
            AR
          </div>
          <span className="font-serif text-[15px] font-bold tracking-tight text-tx-d">
            AI Radar
          </span>
          <span className="ml-1 font-mono text-[11px] text-tx-dd">· FRA</span>
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-0.5 md:flex">
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
              My Account
            </Link>
          )}
        </div>

        {/* Right: tier badge + auth actions */}
        <div className="flex items-center gap-2.5">
          {user && tier ? (
            <>
              <Link
                href="/account"
                className="rounded-[3px] border border-white/20 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-tx-dm transition-colors duration-200 hover:text-tx-d"
              >
                {TIER_LABEL[tier] ?? tier}
              </Link>
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="rounded-[5px] px-3 py-1.5 text-[13px] font-medium text-tx-dm transition-colors duration-200 hover:bg-white/6 hover:text-tx-d"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-[5px] px-3 py-1.5 text-[13px] font-medium text-tx-dm transition-colors duration-200 hover:bg-white/6 hover:text-tx-d"
              >
                Log in
              </Link>
              <Link
                href="/pricing"
                className="rounded-[5px] bg-primary px-3 py-1.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-primary-container"
              >
                Get Access
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
