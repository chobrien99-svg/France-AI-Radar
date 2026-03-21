"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DeleteFounderButton({ founderId, founderName }: { founderId: string; founderName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function del() {
    setLoading(true)
    await fetch(`/api/admin/founders/${founderId}`, { method: "DELETE" })
    router.push("/admin/founders")
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[12px] text-muted-foreground">Delete "{founderName}"?</p>
        <Button variant="destructive" size="sm" onClick={del} disabled={loading}>
          {loading ? "Deleting…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
      onClick={() => setConfirming(true)}
    >
      Delete founder
    </Button>
  )
}
