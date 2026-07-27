"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type CallbackState =
  | { kind: "working" }
  | { kind: "error"; message: string; detail?: string }

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<CallbackState>({ kind: "working" })

  useEffect(() => {
    let cancelled = false

    async function complete() {
      const supabase = createClient()
      const next = searchParams.get("next")

      // Implicit flow: tokens in URL fragment (dashboard-sent magic links)
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get("access_token")
        const refresh_token = params.get("refresh_token")
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (cancelled) return
          if (error) {
            setState({ kind: "error", message: "Could not set your session.", detail: error.message })
            return
          }
          router.replace(next ?? "/database")
          return
        }
      }

      // PKCE flow: code query param
      const code = searchParams.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          setState({
            kind: "error",
            message: "Could not exchange the sign-in code.",
            detail: error.message,
          })
          return
        }
        router.replace(next ?? "/database")
        return
      }

      if (!cancelled) {
        setState({
          kind: "error",
          message: "No sign-in code or token was found in the URL.",
        })
      }
    }

    complete()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

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
          <p className="mb-3 text-sm text-muted-foreground">{state.message}</p>
          {state.detail && (
            <p className="mb-4 border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
              {state.detail}
            </p>
          )}
          <a href="/auth/login" className="text-[13px] font-medium text-primary hover:underline">
            Back to sign in →
          </a>
        </div>
      </div>
    )
  }

  return <CallbackShell message="Signing you in…" />
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
