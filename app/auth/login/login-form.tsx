"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If explicit redirect, use it
    if (next) {
      router.push(next)
      router.refresh()
      return
    }

    // Check subscription status to decide where to send them
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, is_admin")
        .eq("id", user.id)
        .single()

      if (profile?.is_admin || profile?.subscription_status === "active") {
        router.push("/database")
      } else {
        router.push("/pricing")
      }
    } else {
      router.push("/pricing")
    }
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError("Enter your email address first.")
      return
    }
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setResetSent(true)
    setLoading(false)
  }

  if (resetSent) {
    return (
      <div className="data-card-compact bg-card p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center bg-accent-green/10">
          <span className="text-lg text-accent-green">✓</span>
        </div>
        <h1 className="mb-1 font-serif text-lg font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a password reset link to <strong>{email}</strong>. Click it to set a new password.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => { setResetSent(false); setResetMode(false) }}
        >
          ← Back to sign in
        </Button>
      </div>
    )
  }

  if (resetMode) {
    return (
      <div className="data-card-compact bg-card p-6">
        <h1 className="mb-1 font-serif text-lg font-semibold text-foreground">Reset password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1.5">
            <label className="metric-label" htmlFor="reset-email">
              Email
            </label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        <button
          className="mt-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => { setResetMode(false); setError(null) }}
        >
          ← Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="data-card-compact bg-card p-6">
      <h1 className="mb-1 font-serif text-lg font-semibold text-foreground">Sign in</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Access the French AI investor database.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="metric-label" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="metric-label" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              className="text-[11px] font-medium text-primary transition-colors hover:text-primary-container"
              onClick={() => { setResetMode(true); setError(null) }}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
