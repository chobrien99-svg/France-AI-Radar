"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ChangePassword() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

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

    setSuccess(true)
    setNewPassword("")
    setConfirmPassword("")
    setSaving(false)
    setTimeout(() => setSuccess(false), 5000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="metric-label">New password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
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
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit" disabled={saving}>
          {saving ? "Updating..." : "Update Password"}
        </Button>
        {success && <p className="text-[12px] font-medium text-accent-green">Password updated</p>}
        {error && <p className="text-[12px] text-destructive">{error}</p>}
      </div>
    </form>
  )
}
