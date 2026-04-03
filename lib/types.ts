export type SignalStrength = "positive" | "warning" | "risk" | "neutral"

export type TechnologyLayer =
  | "perception"
  | "robotics"
  | "agent_platform"
  | "orchestration"
  | "vertical_ai"
  | "infrastructure"
  | "other"

export type ProductModality = "software" | "hardware" | "hybrid"

export type FundraisingStatus =
  | "preparing_for_fundraising"
  | "likely_raising_within_12_months"
  | "not_currently_raising"
  | "unknown"

export type VentureTag = {
  id: string
  tag: string
  strength: number
}

/** Map numeric tag strength to display label */
export function tagStrengthLabel(strength: number): SignalStrength {
  if (strength === 5) return "positive"
  if (strength === 1) return "risk"
  if (strength === 3) return "neutral"
  return "neutral"
}

export type OrganizationProfile = {
  investor_brief: string | null
  analyst_note: string | null
  product_description: string | null
  target_market: string | null
  competitive_landscape: string | null
  current_strategy: string | null
  business_model_hypothesis: string | null
  technical_thesis: string | null
  fundraising_signal_summary: string | null
  est_next_raise: string | null
  entity_complexity: string | null
}

export type Venture = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string | null
  country: string
  founded_date: string | null
  first_seen_at: string | null

  // Technology classification
  technology_layer: TechnologyLayer | null

  // Fundraising
  total_raised_eur: number | null
  last_round: string | null
  fundraising_status: FundraisingStatus

  // Contact & web presence
  email: string | null
  phone: string | null
  website: string | null
  linkedin_url: string | null

  // Denormalised
  signal_count: number
  last_signal_date: string | null

  // Joined relations
  organization_tags: VentureTag[]
  organization_profiles: OrganizationProfile | OrganizationProfile[] | null
}

export type Founder = {
  id: string
  full_name: string
  slug: string | null
  role: string | null
  bio: string | null
  linkedin_url: string | null
  previous_exits: number
  big_tech_employer: string | null
  academic_lab: string | null
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
}

export type VentureFounder = {
  organization_id: string
  person_id: string
  role: string | null
  people: Founder
}

export type FounderVenture = {
  person_id: string
  venture_name: string
  role: string | null
  start_year: number | null
  end_year: number | null
  outcome: string | null
}

export type VentureRelationship = {
  id: string
  parent_venture_id: string | null
  child_venture_id: string
  relationship_type: string
  description: string | null
}

export type Signal = {
  id: string
  organization_id: string
  signal_date: string
  signal_type: string
  strength: SignalStrength
  title: string
  description: string | null
}

export type VentureEvent = {
  id: string
  organization_id: string
  event_date: string
  event_type: string
  strength: SignalStrength
  title: string
  description: string | null
}

export type Product = {
  id: string
  organization_id: string
  name: string
  description: string | null
  product_type: string | null
  modality: ProductModality
  status: string
}

export type LegalEntity = {
  id: string
  organization_id: string
  legal_name: string
  legal_form: string | null
  siren: string | null
  siret: string | null
  capital_eur: number | null
  incorporation_date: string | null
  registered_city: string | null
  is_primary: boolean
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: "free" | "explorer" | "professional" | "enterprise"
  subscription_status: string
  stripe_customer_id: string | null
  subscription_period_end: string | null
}

// Backward-compat aliases (remove once all UI is updated)
export type Startup = Venture
export type StartupBadge = VentureTag
