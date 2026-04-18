"use client"

import { useEffect } from "react"
import { identifyUser } from "@/lib/analytics"

interface Props {
  userId: string
  email: string | null
  tier: string
  isAdmin: boolean
}

/**
 * Call this from server components that have the user's profile loaded.
 * It will identify the user in PostHog once consent is granted.
 */
export function AnalyticsIdentifier({ userId, email, tier, isAdmin }: Props) {
  useEffect(() => {
    identifyUser(userId, { email, tier, is_admin: isAdmin })
  }, [userId, email, tier, isAdmin])

  return null
}
