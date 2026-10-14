"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const TIER_OPTIONS = [
  { value: "explorer", label: "Explorer" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
]

const TRIAL_LENGTHS = [7, 14, 30, 60, 90]

const STATUS_CLASS: Record<string, string> = {
  active: "badge-signal badge-signal-positive",
  trialing: "badge-signal badge-signal-positive",
  past_due: "badge-signal badge-signal-warning",
  canceled: "badge-signal badge-signal-risk",
  inactive: "badge-signal badge-signal-neutral",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface Props {
  id: string
  email: string
  fullName: string | null
  tier: string
  status: string
  createdAt: string
  periodEnd: string | null
  trialEndsAt: string | null
  hasStripe: boolean
  isAdmin: boolean
}

export function UserRow({
  id,
  email,
  fullName,
  tier: initialTier,
  status,
  createdAt,
  periodEnd,
  trialEndsAt,
  hasStripe,
  isAdmin: initialIsAdmin,
}: Props) {
  const router = useRouter()
  const [tier, setTier] = useState(initialTier)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [saving, setSaving] = useState(false)
  const [trialFormOpen, setTrialFormOpen] = useState(false)
  const [trialDays, setTrialDays] = useState(30)
  const [trialTier, setTrialTier] = useState(initialTier === "explorer" ? "professional" : initialTier)
  const [error, setError] = useState<string | null>(null)

  async function updateUser(fields: Record<string, unknown>) {
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to update.")
      setSaving(false)
      return false
    }

    setSaving(false)
    router.refresh()
    return true
  }

  async function handleTierChange(newTier: string) {
    const prev = tier
    setTier(newTier)
    const ok = await updateUser({ subscription_tier: newTier })
    if (!ok) setTier(prev)
  }

  const isTrial = status === "trialing"
  const trialExpired = isTrial && !!trialEndsAt && new Date(trialEndsAt) <= new Date()
  // Paying Stripe customers can't be put on a trial (the API refuses too).
  const canGiveTrial = !(status === "active" && hasStripe)

  async function handleStartTrial() {
    const ok = await updateUser({ trial_days: trialDays, subscription_tier: trialTier })
    if (ok) {
      setTier(trialTier)
      setTrialFormOpen(false)
    }
  }

  async function handleEndTrial() {
    if (!confirm(`End the free trial for ${email}? They lose access immediately.`)) return
    await updateUser({ end_trial: true })
  }

  async function handleAdminToggle() {
    const newValue = !isAdmin
    setIsAdmin(newValue)
    const ok = await updateUser({ is_admin: newValue })
    if (!ok) setIsAdmin(!newValue)
  }

  async function handleDelete() {
    if (!confirm(`Delete user ${email}? This permanently removes their account and all associated data.`)) return
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to delete.")
      setSaving(false)
      return
    }

    router.refresh()
  }

  return (
    <tr className="bg-background hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-3">
        <p className="font-semibold text-foreground">{email}</p>
        {fullName && <p className="text-[11px] text-muted-foreground">{fullName}</p>}
        {hasStripe && <p className="text-[10px] text-muted-foreground">Stripe linked</p>}
      </td>
      <td className="px-4 py-3">
        <Select
          className="h-8 w-[140px] text-[12px]"
          value={tier}
          onChange={(e) => handleTierChange(e.target.value)}
          disabled={saving}
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </td>
      <td className="px-4 py-3">
        <span className={trialExpired ? STATUS_CLASS.inactive : STATUS_CLASS[status] ?? STATUS_CLASS.inactive}>
          {isTrial ? (trialExpired ? "trial ended" : "free trial") : status}
        </span>
        {isTrial && trialEndsAt && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {trialExpired ? "Ended" : "Ends"} {formatDate(trialEndsAt)}
          </p>
        )}
        {!isTrial && periodEnd && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Renews {formatDate(periodEnd)}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(createdAt)}</td>
      <td className="px-4 py-3">
        <Button
          variant={isAdmin ? "default" : "outline"}
          size="sm"
          className="text-[11px]"
          onClick={handleAdminToggle}
          disabled={saving}
        >
          {isAdmin ? "Admin" : "Grant"}
        </Button>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          {trialFormOpen ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                aria-label="Trial plan"
                className="h-8 w-[120px] text-[11px]"
                value={trialTier}
                onChange={(e) => setTrialTier(e.target.value)}
                disabled={saving}
              >
                {TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <Select
                aria-label="Trial length"
                className="h-8 w-[150px] text-[11px]"
                value={String(trialDays)}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                disabled={saving}
              >
                {TRIAL_LENGTHS.map((d) => (
                  <option key={d} value={d}>{d} days from today</option>
                ))}
              </Select>
              <Button size="sm" className="text-[11px]" onClick={handleStartTrial} disabled={saving}>
                {isTrial && !trialExpired ? "Extend" : "Start"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px]"
                onClick={() => setTrialFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          ) : (
            canGiveTrial && (
              <Button
                variant="outline"
                size="sm"
                className="text-[11px]"
                onClick={() => setTrialFormOpen(true)}
                disabled={saving}
              >
                {isTrial && !trialExpired ? "Extend trial" : "Free trial"}
              </Button>
            )
          )}
          {isTrial && !trialExpired && !trialFormOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-muted-foreground"
              onClick={handleEndTrial}
              disabled={saving}
            >
              End trial
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  )
}
