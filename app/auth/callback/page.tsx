import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientFragmentHandler } from "./client-fragment-handler"

export const dynamic = "force-dynamic"

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string; error?: string; error_description?: string }>
}) {
  const params = await searchParams
  const next = params.next ?? "/database"

  if (params.error) {
    redirect(`/auth/login?error=${encodeURIComponent(params.error_description ?? params.error)}`)
  }

  if (params.code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(params.code)
    if (error) {
      redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
    }
    redirect(next)
  }

  return <ClientFragmentHandler next={next} />
}
