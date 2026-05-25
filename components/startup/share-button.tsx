"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { trackEvent } from "@/lib/analytics"

interface Props {
  slug: string
  name: string
}

export function ShareButton({ slug, name }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/startup/${slug}?ref=share`

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} — AI Radar`,
          text: `Check out ${name} on France AI Radar`,
          url,
        })
        trackEvent("share_completed", { slug, method: "native" })
        return
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      trackEvent("share_completed", { slug, method: "clipboard" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Last resort: prompt
      window.prompt("Copy this link:", url)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-[13px]"
      onClick={handleShare}
    >
      {copied ? "Link Copied" : "Share"}
    </Button>
  )
}
