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

export type VentureOriginType =
  | "new_venture"
  | "founder_reboot"
  | "research_spinout"
  | "consultancy_evolution"
  | "venture_studio_launch"

export type TechnologyStage = "concept" | "prototype" | "pilot" | "production"

export type FundraisingStatus =
  | "preparing_for_fundraising"
  | "likely_raising_within_12_months"
  | "not_currently_raising"
  | "unknown"

export type VentureTag = {
  id: string
  label: string
  strength: SignalStrength
}

export type Venture = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string | null
  country: string
  sector: string
  stage: string
  founded_date: string | null
  first_seen_at: string | null
  incorporation_date: string | null

  // Core narrative
  investor_brief: string | null
  product_description: string | null
  target_market: string | null
  competitive_landscape: string | null

  // Strategy & intelligence
  company_origin: string | null
  current_strategy: string | null
  business_model_hypothesis: string | null
  analyst_note: string | null

  // Technology classification
  technology_layer: TechnologyLayer | null
  product_modality: ProductModality
  technical_thesis: string | null
  technology_stage: TechnologyStage | null

  // Venture origin
  venture_origin_type: VentureOriginType

  // Fundraising
  total_raised_eur: number | null
  last_round: string | null
  est_next_raise: string | null
  funding_notes: string | null
  fundraising_status: FundraisingStatus
  fundraising_signal_summary: string | null

  // Legal
  entity_complexity: string | null

  // Denormalised
  signal_count: number
  last_signal_date: string | null

  // Joined relations
  venture_tags: VentureTag[]
}

export type Founder = {
  id: string
  name: string
  role: string | null
  bio: string | null
  linkedin_url: string | null
  founder_signals: string[]
  previous_companies: string[] | null
  has_phd: boolean
  is_repeat_founder: boolean
  has_big_tech_background: boolean
}

export type VentureFounder = {
  venture_id: string
  founder_id: string
  role: string | null
  founders: Founder
}

export type FounderVenture = {
  founder_id: string
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
  venture_id: string
  signal_date: string
  signal_type: string
  strength: SignalStrength
  title: string
  description: string | null
}

export type VentureEvent = {
  id: string
  venture_id: string
  event_date: string
  event_type: string
  strength: SignalStrength
  title: string
  description: string | null
}

export type Product = {
  id: string
  venture_id: string
  name: string
  description: string | null
  product_type: string | null
  modality: ProductModality
  status: string
}

export type LegalEntity = {
  id: string
  venture_id: string
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
}

// Backward-compat aliases (remove once all UI is updated)
export type Startup = Venture
export type StartupBadge = VentureTag
