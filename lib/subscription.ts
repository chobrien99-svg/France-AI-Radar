export function canAccessFullProfile(tier: string): boolean {
  return ["professional", "enterprise"].includes(tier)
}

export function getStartupLimit(tier: string): number | null {
  switch (tier) {
    case "free":
      return 10
    case "explorer":
      return 50
    case "professional":
      return null
    case "enterprise":
      return null
    default:
      return 10
  }
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
  key_hire: "Key Hire",
  restructuring: "Restructuring",
  patent_ip: "Patent / IP",
  pivot: "Pivot",
  product_launch: "Product Launch",
  partnership: "Partnership",
  founder_departure: "Founder Departure",
  advisory_formation: "Advisory Formation",
  incorporation: "Incorporation",
}

export const FOUNDER_SIGNAL_LABELS: Record<string, string> = {
  big_tech_alumni: "Big Tech Alumni",
  repeat_founder: "Repeat Founder",
  academic_spinout: "Academic Spinout",
  corporate_reboot: "Corporate Reboot",
}

export function sectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] ?? sector
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}
