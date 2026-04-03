"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  startupId: string
  initialSaved: boolean
  isLoggedIn: boolean
}

export function SaveButton({ startupId, initialSaved, isLoggedIn }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/auth/login")
      return
    }
    setLoading(true)
    const optimistic = !saved
    setSaved(optimistic)
    try {
      if (optimistic) {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_id: startupId }),
        })
      } else {
        await fetch(`/api/watchlist?organization_id=${startupId}`, { method: "DELETE" })
      }
      router.refresh()
    } catch {
      setSaved(!optimistic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-[13px]"
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
    >
      <Bookmark
        className="mr-1.5 h-3.5 w-3.5"
        fill={saved ? "currentColor" : "none"}
      />
      {saved ? "Saved" : "Save"}
    </Button>
  )
}
