import { redirect } from "next/navigation"
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

  // PKCE: hand the code to a Route Handler, which can set the session cookies
  // (a page can't).
  if (params.code) {
    const qs = new URLSearchParams({ code: params.code, next })
    redirect(`/auth/exchange?${qs.toString()}`)
  }

  return <ClientFragmentHandler next={next} />
}
