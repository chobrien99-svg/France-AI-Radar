"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function WatchlistRemoveButton({ startupId }: { startupId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    setLoading(true)
    await fetch(`/api/watchlist?organization_id=${startupId}`, { method: "DELETE" })
    router.refresh()
    setLoading(false)
  }

  return (
    <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground hover:text-destructive" onClick={remove} disabled={loading}>
      Remove
    </Button>
  )
}
