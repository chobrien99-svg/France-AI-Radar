"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getConsent, setConsent, initPostHog } from "@/lib/analytics"

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = getConsent()
    if (existing === null) {
      setVisible(true)
    } else if (existing === "granted") {
      initPostHog()
    }
  }, [])

  function accept() {
    setConsent("granted")
    setVisible(false)
  }

  function reject() {
    setConsent("denied")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-[560px] border-l-2 border-l-primary bg-card p-5 shadow-md md:inset-x-auto md:right-6 md:bottom-6">
      <p className="mb-2 font-serif text-[14px] font-semibold text-foreground">
        We use cookies for analytics
      </p>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        We use privacy-friendly analytics to understand how AI Radar is used and
        improve the product. No data is sold. You can change this anytime.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Learn more
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={accept}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={reject}>
          Reject
        </Button>
      </div>
    </div>
  )
}
