import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/** Checks admin status server-side. Redirects to / if not admin. */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  return { user, supabase }
}

/** API-level admin check. Returns user or null (does not redirect). */
export async function getAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  return profile?.is_admin ? user : null
}
