export type SignalStrength = "positive" | "warning" | "risk" | "neutral"

export type StartupBadge = {
  id: string
  label: string
  strength: SignalStrength
}

export type Startup = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string | null
  country: string
  sector: string
  stage: string
  founded_date: string | null
  first_seen_date: string | null
  investor_brief: string | null
  product_description: string | null
  target_market: string | null
  competitive_landscape: string | null
  total_raised_eur: number | null
  last_round: string | null
  est_next_raise: string | null
  funding_notes: string | null
  signal_count: number
  last_signal_date: string | null
  startup_badges: StartupBadge[]
}

export type Founder = {
  id: string
  startup_id: string
  name: string
  role: string | null
  bio: string | null
  founder_signals: string[]
  linkedin_url: string | null
}

export type Signal = {
  id: string
  startup_id: string
  signal_date: string
  signal_type: string
  strength: SignalStrength
  title: string
  description: string | null
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: "free" | "explorer" | "professional" | "enterprise"
  subscription_status: string
}
