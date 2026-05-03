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

const STATUS_CLASS: Record<string, string> = {
  active: "badge-signal badge-signal-positive",
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
  hasStripe,
  isAdmin: initialIsAdmin,
}: Props) {
  const router = useRouter()
  const [tier, setTier] = useState(initialTier)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [saving, setSaving] = useState(false)
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
        <span className={STATUS_CLASS[status] ?? STATUS_CLASS.inactive}>
          {status}
        </span>
        {periodEnd && (
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
        <div className="flex items-center gap-2">
          {error && <p className="text-[11px] text-destructive">{error}</p>}
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
