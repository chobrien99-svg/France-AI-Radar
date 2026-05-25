// ------------------------------------------------------------------
// Tier structure: Explorer (€9) | Professional (€29) | Enterprise
// No free tier — unauthenticated users are redirected to signup.
// ------------------------------------------------------------------

/** Can view premium fields on startup profiles (investor brief, signals, founders, etc.) */
export function canAccessPremiumFields(tier: string): boolean {
  return ["professional", "enterprise"].includes(tier)
}

/** Can view full profiles (Explorer has a monthly view limit) */
export function canAccessFullProfile(tier: string): boolean {
  return ["explorer", "professional", "enterprise"].includes(tier)
}

/** Monthly profile view limit. null = unlimited. */
export function getProfileViewLimit(tier: string): number | null {
  switch (tier) {
    case "explorer":
      return 3
    case "professional":
    case "enterprise":
      return null
    default:
      return 0
  }
}

/** How many startup cards visible in the database list. null = unlimited. */
export function getStartupLimit(tier: string): number | null {
  switch (tier) {
    case "explorer":
      return 50
    case "professional":
    case "enterprise":
      return null
    default:
      return 0
  }
}

/** Can use advanced filters (sector, founder signals, signal type). */
export function canUseAdvancedFilters(tier: string): boolean {
  return ["professional", "enterprise"].includes(tier)
}

/** Can save to watchlist and create lists. */
export function canSaveAndList(tier: string): boolean {
  return ["professional", "enterprise"].includes(tier)
}

/** Can set alerts on startups. */
export function canSetAlerts(tier: string): boolean {
  return ["professional", "enterprise"].includes(tier)
}

/** Monthly CSV export limit. null = unlimited, 0 = no access. */
export function getExportLimit(tier: string): number | null {
  switch (tier) {
    case "professional":
    case "enterprise":
      return null
    default:
      return 0
  }
}

// ------------------------------------------------------------------
// Labels
// ------------------------------------------------------------------

export const TIER_LABELS: Record<string, string> = {
  explorer: "Explorer",
  professional: "Professional",
  enterprise: "Enterprise",
}

export const SECTOR_LABELS: Record<string, string> = {
  ai_agents: "AI Agents",
  robotics: "Robotics",
  bioai: "BioAI",
  deeptech: "Deep Tech",
  cybersecurity_ai: "Cybersecurity AI",
  fintech_ai: "Fintech AI",
  healthtech_ai: "Healthtech AI",
  edtech_ai: "EdTech AI",
  climate_ai: "Climate AI",
  legaltech_ai: "LegalTech AI",
  logistics_ai: "Logistics AI",
  manufacturing_ai: "Manufacturing AI",
  other: "Other",
}

export const STAGE_LABELS: Record<string, string> = {
  pre_seed: "Pre-Seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
  unknown: "Unknown",
}

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising",
  hiring_surge: "Hiring Surge",
  key_hire: "Key Hire",
  restructuring: "Restructuring",
  incorporation: "Incorporation",
  new_product: "New Product",
  pivot: "Pivot",
  expansion: "Expansion",
  partnership: "Partnership",
  founder_departure: "Founder Departure",
  talent_move: "Talent Move",
  patent_filing: "Patent Filing",
  award: "Award",
  media_mention: "Media Mention",
  regulatory: "Regulatory",
  open_source: "Open Source",
  conference: "Conference",
  other: "Other",
}

export const FOUNDER_SIGNAL_LABELS: Record<string, string> = {
  big_tech_alumni: "Big Tech Alumni",
  repeat_founder: "Repeat Founder",
  academic_spinout: "Academic Spinout",
  corporate_reboot: "Corporate Reboot",
}

export const SIGNAL_SOURCE_LABELS: Record<string, string> = {
  stealth: "Stealth",
  incorporated: "Incorporated",
  accelerator: "Accelerator",
  incubator: "Incubator",
  france_2030_laureat: "France 2030 Lauréat",
}

export function sectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] ?? sector
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}
