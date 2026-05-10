"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

const USER_TYPE_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "vc", label: "VC / Venture Capital" },
  { value: "business_angel", label: "Business Angel" },
  { value: "corporate", label: "Corporate / Strategic" },
  { value: "founder", label: "Founder" },
  { value: "other", label: "Other" },
]

interface Props {
  initialValues: {
    full_name: string
    title: string
    company: string
    user_type: string
  }
}

export function ProfileEditor({ initialValues }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to save.")
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="metric-label">Name</label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="metric-label">Title</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Partner, Analyst, CTO"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="metric-label">Company / Organization</label>
          <Input
            value={form.company}
            onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
            placeholder="e.g. Partech, BPI, Dassault"
          />
        </div>
        <div className="space-y-1.5">
          <label className="metric-label">I am a...</label>
          <Select
            value={form.user_type}
            onChange={(e) => setForm((p) => ({ ...p, user_type: e.target.value }))}
          >
            {USER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
        {saved && (
          <p className="text-[12px] text-accent-green font-medium">Saved</p>
        )}
        {error && (
          <p className="text-[12px] text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
