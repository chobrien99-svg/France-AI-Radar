"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DeleteStartupButton({ startupId, startupName }: { startupId: string; startupName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function softDelete() {
    setLoading(true)
    await fetch(`/api/admin/startups/${startupId}`, { method: "DELETE" })
    router.push("/admin/startups")
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[12px] text-muted-foreground">Hide "{startupName}"?</p>
        <Button variant="destructive" size="sm" onClick={softDelete} disabled={loading}>
          {loading ? "Hiding…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirming(true)}>
      Hide startup
    </Button>
  )
}
