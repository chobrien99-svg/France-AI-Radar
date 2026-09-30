"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    router.push("/account")
    router.refresh()
  }

  return (
    <div className="data-card-compact bg-card p-6">
      <h1 className="mb-1 font-serif text-lg font-semibold text-foreground">Choose a new password</h1>
      {email && (
        <p className="mb-4 text-sm text-muted-foreground">
          For <strong>{email}</strong>
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="metric-label">New password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <div className="space-y-1.5">
          <label className="metric-label">Confirm password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </div>
  )
}
