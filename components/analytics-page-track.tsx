"use client"

import { useEffect } from "react"
import { Events } from "@/lib/analytics"

interface Props {
  event: "profile_viewed" | "profile_view_limit_hit"
  slug?: string
  tier: string
}

/**
 * Lightweight client tracker — mount on server-rendered pages to fire
 * a single analytics event after hydration.
 */
export function AnalyticsPageTrack({ event, slug, tier }: Props) {
  useEffect(() => {
    if (event === "profile_viewed" && slug) {
      Events.profileViewed(slug, tier)
    } else if (event === "profile_view_limit_hit") {
      Events.profileViewLimitHit(tier)
    }
  }, [event, slug, tier])

  return null
}
