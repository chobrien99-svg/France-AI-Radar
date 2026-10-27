"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const dangerOutline = "text-destructive hover:bg-destructive hover:text-destructive-foreground"

export function DeleteStartupButton({
  startupId,
  startupName,
  soloFounders = [],
}: {
  startupId: string
  startupName: string
  /** Founders linked to this startup and no other, who would be left orphaned. */
  soloFounders?: string[]
}) {
  const router = useRouter()
  const [confirmingHide, setConfirmingHide] = useState(false)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [deleteFounders, setDeleteFounders] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function softDelete() {
    setLoading(true)
    await fetch(`/api/admin/startups/${startupId}`, { method: "DELETE" })
    router.push("/admin/startups")
    router.refresh()
  }

  async function hardDelete() {
    setLoading(true)
    setError(null)
    const qs = `mode=permanent${deleteFounders ? "&founders=orphans" : ""}`
    const res = await fetch(`/api/admin/startups/${startupId}?${qs}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? "Delete failed")
      setLoading(false)
      return
    }
    if (data._warning) window.alert(data._warning)
    router.push("/admin/startups")
    router.refresh()
  }

  const nameMatches = typed.trim().toLowerCase() === startupName.trim().toLowerCase()

  if (confirmingHide) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[12px] text-muted-foreground">Hide &ldquo;{startupName}&rdquo;?</p>
        <Button variant="destructive" size="sm" onClick={softDelete} disabled={loading}>
          {loading ? "Hiding…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmingHide(false)}>Cancel</Button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" className={dangerOutline} onClick={() => setConfirmingHide(true)}>
        Hide startup
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) { setTyped(""); setDeleteFounders(false); setError(null) }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={dangerOutline}>Delete…</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {startupName} permanently?</DialogTitle>
            <DialogDescription>
              This removes the startup and everything attached to it: profile, signals, funding rounds,
              grants, legal entities, sectors, technical classification, and any saves or lists that
              include it. It cannot be undone. To keep it but take it off the site, use Hide instead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {soloFounders.length > 0 && (
              <label className="flex items-start gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={deleteFounders}
                  onChange={(e) => setDeleteFounders(e.target.checked)}
                />
                <span>
                  Also delete {soloFounders.length === 1 ? "this founder, who isn't" : `these ${soloFounders.length} founders, who aren't`} linked
                  to any other startup: <strong>{soloFounders.join(", ")}</strong>
                </span>
              </label>
            )}

            <div>
              <p className="mb-1.5 text-[12px] text-muted-foreground">
                Type <strong className="text-foreground">{startupName}</strong> to confirm
              </p>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>

            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={hardDelete} disabled={!nameMatches || loading}>
              {loading ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
