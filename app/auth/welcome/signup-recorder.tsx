"use client"

import { useEffect } from "react"
import { Events, getConsent, initPostHog } from "@/lib/analytics"

export function SignupRecorder({
  userId,
  method,
  next,
}: {
  userId: string
  method: "email" | "google"
  next: string
}) {
  useEffect(() => {
    // This runs before the layout's CookieConsent effect, so make sure
    // PostHog is set up (only if the visitor has consented).
    if (getConsent() === "granted") initPostHog()
    // Send immediately: `next` may be an external page (Stripe checkout).
    Events.signupCompleted(userId, method, { send_instantly: true })
    // Full navigation, since `next` can be an API route that redirects off-site.
    const timer = setTimeout(() => window.location.replace(next), 300)
    return () => clearTimeout(timer)
  }, [userId, method, next])

  return null
}
