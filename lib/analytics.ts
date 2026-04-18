"use client"

import posthog from "posthog-js"

const CONSENT_KEY = "ai-radar-analytics-consent"

export type ConsentValue = "granted" | "denied" | null

export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(CONSENT_KEY)
  if (v === "granted" || v === "denied") return v
  return null
}

export function setConsent(value: "granted" | "denied") {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CONSENT_KEY, value)
  if (value === "granted") initPostHog()
  else optOut()
}

let initialized = false

export function initPostHog() {
  if (typeof window === "undefined" || initialized) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com"
  if (!key) return

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: false,
    loaded: () => {
      initialized = true
    },
  })
}

export function optOut() {
  if (typeof window === "undefined") return
  try {
    posthog.opt_out_capturing()
  } catch {
    // not initialized yet — fine
  }
}

// Identify a user (only call after login)
export function identifyUser(
  userId: string,
  traits: { email?: string | null; tier?: string; is_admin?: boolean } = {}
) {
  if (typeof window === "undefined") return
  if (getConsent() !== "granted") return
  try {
    posthog.identify(userId, {
      email: traits.email ?? undefined,
      subscription_tier: traits.tier,
      is_admin: traits.is_admin,
    })
  } catch {
    // ignore
  }
}

// Reset on logout
export function resetIdentity() {
  if (typeof window === "undefined") return
  try {
    posthog.reset()
  } catch {
    // ignore
  }
}

// Track a custom event
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  if (getConsent() !== "granted") return
  try {
    posthog.capture(event, properties)
  } catch {
    // ignore
  }
}

// Named events (typed wrappers)
export const Events = {
  signupStarted: () => trackEvent("signup_started"),
  signupCompleted: (userId: string) => trackEvent("signup_completed", { userId }),
  checkoutStarted: (tier: string, interval: "monthly" | "annual") =>
    trackEvent("checkout_started", { tier, interval }),
  upgradeClicked: (source: string, tier?: string) =>
    trackEvent("upgrade_clicked", { source, current_tier: tier }),
  profileViewed: (slug: string, tier: string) =>
    trackEvent("profile_viewed", { startup_slug: slug, tier }),
  profileViewLimitHit: (tier: string) =>
    trackEvent("profile_view_limit_hit", { tier }),
  exportAttempted: (slug: string, tier: string) =>
    trackEvent("export_attempted", { startup_slug: slug, tier }),
  exportCompleted: (slug: string) =>
    trackEvent("export_completed", { startup_slug: slug }),
  alertSet: (slug: string) => trackEvent("alert_set", { startup_slug: slug }),
  watchlistAdded: (slug: string) => trackEvent("watchlist_added", { startup_slug: slug }),
}
