import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Exchanges a PKCE ?code= for a session. This must be a Route Handler, not a
// page: Next.js only lets Route Handlers and Server Functions set cookies, so
// exchanging the code inside a Server Component silently drops the session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/database"
  // Only allow same-site relative paths to avoid open redirects.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/database"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent("Missing sign-in code")}`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  // Password reset links always go to the reset page, whatever `next` says
  // (Supabase flags the code as a recovery when resetPasswordForEmail is used).
  // (The field is returned at runtime but missing from the published types.)
  const redirectType = (data as { redirectType?: string | null }).redirectType
  if (redirectType === "PASSWORD_RECOVERY") {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
