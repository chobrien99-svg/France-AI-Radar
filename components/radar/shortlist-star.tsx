"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "./icons"

/** Star toggle on cards and list rows — adds/removes the startup from the user's watchlist */
export function ShortlistStar({
  startupId,
  name,
  initialSaved,
}: {
  startupId: string
  name: string
  initialSaved: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const next = !saved
    setSaved(next)
    setBusy(true)
    try {
      const res = next
        ? await fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organization_id: startupId }),
          })
        : await fetch(`/api/watchlist?organization_id=${startupId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setSaved(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={"r2-ib" + (saved ? " on" : "")}
      title={saved ? "Remove from shortlist" : "Add to shortlist"}
      aria-label={saved ? `Remove ${name} from shortlist` : `Add ${name} to shortlist`}
      aria-pressed={saved}
      onClick={toggle}
    >
      <Icon name={saved ? "star-on" : "star"} />
    </button>
  )
}
