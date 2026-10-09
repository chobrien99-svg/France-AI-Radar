"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "./icons"
import { trackEvent } from "@/lib/analytics"

/** Optimistic on/off toggle backed by a POST / DELETE endpoint */
function useToggle(initial: boolean, endpoint: string, startupId: string, isLoggedIn: boolean) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/auth/login")
      return
    }
    const next = !on
    setOn(next)
    setBusy(true)
    try {
      const res = next
        ? await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organization_id: startupId }),
          })
        : await fetch(`${endpoint}?organization_id=${startupId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setOn(!next)
    } finally {
      setBusy(false)
    }
  }
  return { on, busy, toggle }
}

export function ShortlistButton({ startupId, initialSaved, isLoggedIn }: { startupId: string; initialSaved: boolean; isLoggedIn: boolean }) {
  const { on, busy, toggle } = useToggle(initialSaved, "/api/watchlist", startupId, isLoggedIn)
  return (
    <button type="button" className={"r2-btn s" + (on ? " on" : "")} onClick={toggle} disabled={busy} aria-pressed={on}>
      <Icon name={on ? "star-on" : "star"} size={14} />
      {on ? "Shortlisted" : "Shortlist"}
    </button>
  )
}

export function AlertToggle({ startupId, initialAlert, isLoggedIn }: { startupId: string; initialAlert: boolean; isLoggedIn: boolean }) {
  const { on, busy, toggle } = useToggle(initialAlert, "/api/alerts", startupId, isLoggedIn)
  return (
    <button type="button" className={"r2-btn s" + (on ? " on" : "")} onClick={toggle} disabled={busy} aria-pressed={on}>
      <Icon name={on ? "bell-on" : "bell"} size={14} />
      {on ? "Alert set" : "Alert"}
    </button>
  )
}

export function ShareButtonV2({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}/startup/${slug}?ref=share`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} — AI Radar`, text: `Check out ${name} on France AI Radar`, url })
        trackEvent("share_completed", { slug, method: "native" })
        return
      } catch {
        // cancelled — fall back to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      trackEvent("share_completed", { slug, method: "clipboard" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this link:", url)
    }
  }

  return (
    <button type="button" className="r2-btn s" onClick={share}>
      <Icon name="share" size={14} />
      {copied ? "Link copied" : "Share"}
    </button>
  )
}
