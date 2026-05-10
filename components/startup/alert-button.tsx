"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  startupId: string
  initialAlert: boolean
  isLoggedIn: boolean
}

export function AlertButton({ startupId, initialAlert, isLoggedIn }: Props) {
  const router = useRouter()
  const [alertSet, setAlertSet] = useState(initialAlert)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/auth/login")
      return
    }
    setLoading(true)
    const optimistic = !alertSet
    setAlertSet(optimistic)
    try {
      if (optimistic) {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_id: startupId }),
        })
      } else {
        await fetch(`/api/alerts?organization_id=${startupId}`, { method: "DELETE" })
      }
      router.refresh()
    } catch {
      setAlertSet(!optimistic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      className="text-[13px]"
      variant={alertSet ? "default" : "outline"}
      onClick={toggle}
      disabled={loading}
      aria-label={alertSet ? "Remove alert" : "Set alert"}
    >
      <Bell
        className="mr-1.5 h-3.5 w-3.5"
        fill={alertSet ? "currentColor" : "none"}
      />
      {alertSet ? "Alert Set" : "Set Alert"}
    </Button>
  )
}
