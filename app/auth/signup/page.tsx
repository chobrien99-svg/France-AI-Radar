"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Events } from "@/lib/analytics"

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    Events.signupStarted()

    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      Events.signupCompleted(authData.user.id)
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-accent-green/10">
            <span className="text-xl text-accent-green">✓</span>
          </div>
          <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">Check your email</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then choose a plan to get started.
          </p>
          <Link href="/pricing" className="text-[13px] font-medium text-primary hover:underline">
            View plans →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-[13px] font-bold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
              AR
            </div>
            <span className="font-serif text-sm font-semibold text-foreground">AI Radar</span>
          </Link>
        </div>

        <div className="data-card-compact bg-card p-6">
          <h1 className="mb-1 font-serif text-lg font-semibold text-foreground">Create account</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Start tracking the French AI ecosystem.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="metric-label" htmlFor="fullName">
                Full name
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

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
              <label className="metric-label" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
