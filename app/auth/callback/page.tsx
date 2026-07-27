"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"working" | "error">("working")

  useEffect(() => {
    let cancelled = false

    async function complete() {
      const supabase = createClient()
      const next = searchParams.get("next")

      // Implicit flow: tokens in the URL fragment (dashboard-sent magic links)
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get("access_token")
        const refresh_token = params.get("refresh_token")
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (cancelled) return
          if (error) {
            router.replace("/auth/login?error=auth_callback_failed")
            return
          }
          router.replace(next ?? "/database")
          return
        }
      }

      // PKCE flow: code query param (app-initiated signup/login/reset)
      const code = searchParams.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          router.replace("/auth/login?error=auth_callback_failed")
          return
        }
        router.replace(next ?? "/database")
        return
      }

      if (!cancelled) {
        setStatus("error")
        router.replace("/auth/login?error=auth_callback_failed")
      }
    }

    complete()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return <CallbackShell message={status === "error" ? "Sign-in failed. Redirecting…" : "Signing you in…"} />
}

function CallbackShell({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell message="Signing you in…" />}>
      <CallbackInner />
    </Suspense>
  )
}
