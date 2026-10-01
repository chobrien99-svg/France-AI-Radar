import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignupRecorder } from "./signup-recorder"

export const dynamic = "force-dynamic"

// Brief stop for brand-new OAuth users (see /auth/exchange): records the
// signup in analytics, then continues to `next`.
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; method?: string }>
}) {
  const params = await searchParams
  const nextParam = params.next ?? "/database"
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/database"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
      <SignupRecorder userId={user.id} method={params.method === "google" ? "google" : "email"} next={next} />
    </div>
  )
}
