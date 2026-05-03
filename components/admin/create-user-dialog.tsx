"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

export function CreateUserDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; tier: string; invite_link?: string | null } | null>(null)

  const [form, setForm] = useState({
    email: "",
    full_name: "",
    tier: "explorer",
    send_invite: true,
  })

  async function handleCreate() {
    if (!form.email.trim()) {
      setError("Email is required")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Failed to create user")
      setLoading(false)
      return
    }

    setResult(data)
    setLoading(false)
    router.refresh()
  }

  function reset() {
    setForm({ email: "", full_name: "", tier: "explorer", send_invite: true })
    setError(null)
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button>+ Add User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="border-l-2 border-l-accent-green bg-accent-green/10 px-4 py-3">
              <p className="text-[13px] font-semibold text-accent-green">User created</p>
              <p className="mt-1 text-[13px] text-foreground">{result.email} — {result.tier}</p>
            </div>
            {result.invite_link && (
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground">
                  Share this invite link (or the user will receive an email):
                </p>
                <Input
                  readOnly
                  value={result.invite_link}
                  className="text-[12px]"
                  onFocus={(e) => e.target.select()}
                />
              </div>
            )}
            <DialogClose asChild>
              <Button variant="outline" className="w-full">Done</Button>
            </DialogClose>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted-foreground">Email *</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted-foreground">Full name</label>
              <Input
                placeholder="Optional"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted-foreground">Tier</label>
              <Select
                value={form.tier}
                onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
              >
                <option value="explorer">Explorer</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={form.send_invite}
                onChange={(e) => setForm((p) => ({ ...p, send_invite: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Send invite email
            </label>

            {error && <p className="text-[13px] text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
