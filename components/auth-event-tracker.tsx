"use client"

import { useEffect } from "react"
import { Events } from "@/lib/analytics"

/**
 * Picks up the one-shot `auth_event` cookie set by /auth/exchange when an
 * OAuth sign-in created a new account, records the signup, and clears it.
 */
export function AuthEventTracker() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)auth_event=([^;]+)/)
    if (!match) return
    document.cookie = "auth_event=; path=/; max-age=0"

    const [event, method, userId] = decodeURIComponent(match[1]).split(":")
    if (event === "signup_completed" && method === "google" && userId) {
      Events.signupCompleted(userId, "google")
    }
  }, [])

  return null
}
