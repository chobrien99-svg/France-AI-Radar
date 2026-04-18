import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { UserRow } from "@/components/admin/user-row"

export const dynamic = "force-dynamic"

type UserProfile = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: string
  subscription_status: string | null
  subscription_period_end: string | null
  stripe_customer_id: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

function countByTier(users: UserProfile[], tier: string) {
  return users.filter((u) => u.subscription_tier === tier).length
}

function countActiveSubs(users: UserProfile[]) {
  return users.filter((u) =>
    ["professional", "enterprise"].includes(u.subscription_tier) &&
    u.subscription_status === "active"
  ).length
}

// Rough MRR estimate based on tier pricing
function estimateMRR(users: UserProfile[]) {
  const PRICE: Record<string, number> = {
    explorer: 9,
    professional: 29,
    enterprise: 0, // custom — not counted automatically
  }
  return users.reduce((sum, u) => {
    if (u.subscription_status !== "active") return sum
    return sum + (PRICE[u.subscription_tier] ?? 0)
  }, 0)
}

export default async function AdminUsersPage() {
  await requireAdmin()
  const supabase = await createServiceClient()

  const { data: usersRaw } = await supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, is_admin, created_at, updated_at")
    .order("created_at", { ascending: false })

  const users = (usersRaw ?? []) as UserProfile[]

  const total = users.length
  const explorerCount = countByTier(users, "explorer")
  const proCount = countByTier(users, "professional")
  const enterpriseCount = countByTier(users, "enterprise")
  const activeSubs = countActiveSubs(users)
  const mrr = estimateMRR(users)

  // New users in last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const newLast30 = users.filter((u) => new Date(u.created_at) > thirtyDaysAgo).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Users</h1>
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total users" value={total} />
        <StatCard label="New (30d)" value={newLast30} />
        <StatCard label="Active subscriptions" value={activeSubs} />
        <StatCard label="Est. MRR" value={`€${mrr}`} />
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Explorer" value={explorerCount} subtle />
        <StatCard label="Professional" value={proCount} subtle />
        <StatCard label="Enterprise" value={enterpriseCount} subtle />
      </div>

      {/* User list */}
      <div className="overflow-hidden border border-border/40">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Tier</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Admin</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <UserRow
                key={u.id}
                id={u.id}
                email={u.email ?? ""}
                fullName={u.full_name}
                tier={u.subscription_tier}
                status={u.subscription_status ?? "inactive"}
                createdAt={u.created_at}
                periodEnd={u.subscription_period_end}
                hasStripe={!!u.stripe_customer_id}
                isAdmin={u.is_admin}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            No users yet.
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, subtle = false }: { label: string; value: number | string; subtle?: boolean }) {
  return (
    <div className={`${subtle ? "border-l-2 border-l-border" : "border-l-2 border-l-primary"} bg-card p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-[24px] font-bold text-foreground">{value}</p>
    </div>
  )
}
