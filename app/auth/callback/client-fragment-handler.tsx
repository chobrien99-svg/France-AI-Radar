"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type State = { kind: "working" } | { kind: "error"; message: string }

export function ClientFragmentHandler({ next }: { next: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: "working" })

  useEffect(() => {
    let cancelled = false

    async function handle() {
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      if (!hash.startsWith("#")) {
        setState({ kind: "error", message: "No sign-in token found in the URL." })
        return
      }

      const params = new URLSearchParams(hash.slice(1))

      const fragmentError = params.get("error_description") ?? params.get("error")
      if (fragmentError) {
        setState({ kind: "error", message: fragmentError })
        return
      }

      const access_token = params.get("access_token")
      const refresh_token = params.get("refresh_token")
      if (!access_token || !refresh_token) {
        setState({ kind: "error", message: "Sign-in token is incomplete." })
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (cancelled) return
      if (error) {
        setState({ kind: "error", message: error.message })
        return
      }
      router.replace(next)
    }

    handle()
    return () => {
      cancelled = true
    }
  }, [router, next])

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-destructive/10">
            <span className="text-xl text-destructive">!</span>
          </div>
          <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">
            Sign-in link couldn&apos;t be completed
          </h1>
          <p className="mb-4 border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
            {state.message}
          </p>
          <a href="/auth/login" className="text-[13px] font-medium text-primary hover:underline">
            Back to sign in →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}
