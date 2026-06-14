import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getExportLimit, SIGNAL_TYPE_LABELS } from "@/lib/subscription"

export const runtime = "nodejs"

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = Array.isArray(value) ? value.join("; ") : String(value)
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatEur(amount: number | null): string {
  if (!amount) return ""
  return `€${amount.toLocaleString()}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single()

  const tier = profile?.subscription_tier ?? "explorer"
  const limit = getExportLimit(tier)

  if (limit === 0) {
    return NextResponse.json(
      { error: "CSV export requires a Professional subscription." },
      { status: 403 }
    )
  }

  const period = currentPeriod()
  if (limit !== null) {
    const { data: usage } = await supabase
      .from("export_usage")
      .select("export_count")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle()

    const used = usage?.export_count ?? 0
    if (used >= limit) {
      return NextResponse.json(
        { error: `Monthly export limit reached (${limit}/${limit}). Resets next month.`, limit, used },
        { status: 429 }
      )
    }
  }

  const svc = await createServiceClient()

  // Fetch everything in parallel
  const { data: startup } = await svc
    .from("organizations")
    .select("*, cities!organizations_city_id_fkey(name)")
    .eq("slug", slug)
    .eq("organization_type", "startup")
    .single()

  if (!startup) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 })
  }

  const orgId = startup.id

  const [
    { data: profileData },
    { data: tagsData },
    { data: peopleData },
    { data: signalsData },
    { data: grantsData },
    { data: fundingData },
    { data: programsData },
    { data: legalData },
    { data: sectorsData },
  ] = await Promise.all([
    svc.from("organization_profiles").select("*").eq("organization_id", orgId).maybeSingle(),
    svc.from("organization_tags").select("tag, strength").eq("organization_id", orgId),
    svc.from("organization_people").select("role, is_founder, people(*)").eq("organization_id", orgId),
    svc.from("signals").select("*").eq("organization_id", orgId).order("signal_date", { ascending: false }),
    svc.from("grants").select("*").eq("organization_id", orgId),
    svc.from("funding_rounds").select("*").eq("organization_id", orgId).order("announced_date", { ascending: false }),
    svc.from("program_organizations").select("membership_role, program_editions(name, cohort_label, year, programs(name, program_type))").eq("organization_id", orgId),
    svc.from("legal_entities").select("*").eq("organization_id", orgId),
    svc.from("organization_sectors").select("sectors(name)").eq("organization_id", orgId),
  ])

  // Increment export usage
  await svc.rpc("increment_export_usage", { p_user_id: user.id, p_period: period })

  // Build CSV sections
  const lines: string[] = []

  // === COMPANY OVERVIEW ===
  lines.push("=== COMPANY OVERVIEW ===")
  lines.push("")

  const city = startup.cities ? (Array.isArray(startup.cities) ? startup.cities[0]?.name : startup.cities.name) : ""
  const tags = (tagsData ?? []).map((t: { tag: string }) => t.tag).join("; ")
  const sectors = (sectorsData ?? []).map((r: Record<string, unknown>) => {
    const s = Array.isArray(r.sectors) ? r.sectors[0] : r.sectors
    return (s as { name: string } | null)?.name ?? ""
  }).filter(Boolean).join("; ")

  const companyHeaders = ["Field", "Value"]
  const companyRows: [string, string][] = [
    ["Name", startup.name],
    ["Slug", startup.slug],
    ["City", city],
    ["Country", startup.country],
    ["Founded", startup.founded_date ?? ""],
    ["First Seen", startup.first_seen_at ? formatDate(startup.first_seen_at) : ""],
    ["Status", startup.status],
    ["Website", startup.website ?? ""],
    ["LinkedIn", startup.linkedin_url ?? ""],
    ["Email", startup.email ?? ""],
    ["Phone", startup.phone ?? ""],
    ["Description", startup.description ?? ""],
    ["Technology Layer", startup.technology_layer ?? ""],
    ["Fundraising Status", startup.fundraising_status ?? ""],
    ["Total Raised (EUR)", startup.total_raised_eur ? formatEur(startup.total_raised_eur) : ""],
    ["Last Round", startup.last_round ?? ""],
    ["Signal Count", String(startup.signal_count ?? 0)],
    ["Last Signal Date", startup.last_signal_date ? formatDate(startup.last_signal_date) : ""],
    ["Tags", tags],
    ["Sectors", sectors],
  ]

  lines.push(companyHeaders.map(csvEscape).join(","))
  for (const [field, value] of companyRows) {
    lines.push(`${csvEscape(field)},${csvEscape(value)}`)
  }

  // === INVESTOR BRIEF ===
  if (profileData) {
    lines.push("")
    lines.push("=== INVESTOR BRIEF & ANALYSIS ===")
    lines.push("")
    const profileHeaders = ["Field", "Value"]
    const profileRows = [
      ["Investor Brief", profileData.investor_brief ?? ""],
      ["Analyst Note", profileData.analyst_note ?? ""],
      ["Product Description", profileData.product_description ?? ""],
      ["Target Market", profileData.target_market ?? ""],
      ["Competitive Landscape", profileData.competitive_landscape ?? ""],
      ["Technical Thesis", profileData.technical_thesis ?? ""],
      ["Current Strategy", profileData.current_strategy ?? ""],
      ["Business Model", profileData.business_model_hypothesis ?? ""],
      ["Fundraising Signal Summary", profileData.fundraising_signal_summary ?? ""],
      ["Est. Next Raise", profileData.est_next_raise ?? ""],
      ["Entity Complexity", profileData.entity_complexity ?? ""],
    ].filter((row): row is [string, string] => !!row[1])

    lines.push(profileHeaders.map(csvEscape).join(","))
    for (const [field, value] of profileRows) {
      lines.push(`${csvEscape(field)},${csvEscape(value)}`)
    }
  }

  // === FOUNDERS / TEAM ===
  const people = (peopleData ?? []).map((row: Record<string, unknown>) => {
    const p = (Array.isArray(row.people) ? row.people[0] : row.people) as Record<string, unknown> | null
    return {
      full_name: (p?.full_name as string) ?? "",
      role: (row.role as string) ?? "",
      is_founder: !!row.is_founder,
      linkedin_url: (p?.linkedin_url as string) ?? "",
      email: (p?.email as string) ?? "",
      short_bio: (p?.short_bio as string) ?? "",
      big_tech_employer: (p?.big_tech_employer as string) ?? "",
      academic_lab: (p?.academic_lab as string) ?? "",
      has_phd: !!p?.has_phd,
      is_repeat_founder: !!p?.is_repeat_founder,
      previous_exits: (p?.previous_exits as number) ?? 0,
    }
  }).filter((p) => p.full_name)

  if (people.length > 0) {
    lines.push("")
    lines.push("=== TEAM ===")
    lines.push("")
    const peopleHeaders = ["Name", "Role", "Founder", "LinkedIn", "Email", "Short Bio", "Big Tech", "Academic Lab", "PhD", "Repeat Founder", "Previous Exits"]
    lines.push(peopleHeaders.map(csvEscape).join(","))
    for (const p of people) {
      lines.push([
        csvEscape(p.full_name),
        csvEscape(p.role),
        csvEscape(p.is_founder ? "Yes" : "No"),
        csvEscape(p.linkedin_url),
        csvEscape(p.email),
        csvEscape(p.short_bio),
        csvEscape(p.big_tech_employer),
        csvEscape(p.academic_lab),
        csvEscape(p.has_phd ? "Yes" : "No"),
        csvEscape(p.is_repeat_founder ? "Yes" : "No"),
        csvEscape(p.previous_exits),
      ].join(","))
    }
  }

  // === KEY SIGNALS ===
  if (signalsData && signalsData.length > 0) {
    lines.push("")
    lines.push("=== KEY SIGNALS ===")
    lines.push("")
    const signalHeaders = ["Date", "Type", "Strength", "Title", "Description", "Source"]
    lines.push(signalHeaders.map(csvEscape).join(","))
    for (const s of signalsData) {
      lines.push([
        csvEscape(formatDate(s.signal_date)),
        csvEscape(SIGNAL_TYPE_LABELS[s.signal_type] ?? s.signal_type),
        csvEscape(s.strength),
        csvEscape(s.title),
        csvEscape(s.description),
        csvEscape(s.source_name),
      ].join(","))
    }
  }

  // === FUNDING ROUNDS ===
  if (fundingData && fundingData.length > 0) {
    lines.push("")
    lines.push("=== FUNDING ROUNDS ===")
    lines.push("")
    const fundingHeaders = ["Stage", "Amount (EUR)", "Date", "Source", "Estimated", "Notes"]
    lines.push(fundingHeaders.map(csvEscape).join(","))
    for (const r of fundingData) {
      lines.push([
        csvEscape(r.stage),
        csvEscape(r.amount_eur ? formatEur(r.amount_eur) : ""),
        csvEscape(formatDate(r.announced_date)),
        csvEscape(r.source_name),
        csvEscape(r.is_estimated ? "Yes" : "No"),
        csvEscape(r.notes),
      ].join(","))
    }
  }

  // === GRANTS ===
  if (grantsData && grantsData.length > 0) {
    lines.push("")
    lines.push("=== GRANTS & PUBLIC FUNDING ===")
    lines.push("")
    const grantHeaders = ["Grant Name", "Granting Body", "Amount (EUR)", "Date", "Program"]
    lines.push(grantHeaders.map(csvEscape).join(","))
    for (const g of grantsData) {
      lines.push([
        csvEscape(g.grant_name),
        csvEscape(g.granting_body),
        csvEscape(g.amount_eur ? formatEur(g.amount_eur) : ""),
        csvEscape(formatDate(g.awarded_date)),
        csvEscape(g.program),
      ].join(","))
    }
  }

  // === PROGRAMS ===
  if (programsData && programsData.length > 0) {
    lines.push("")
    lines.push("=== PROGRAMS & AFFILIATIONS ===")
    lines.push("")
    const progHeaders = ["Program", "Type", "Edition", "Year", "Role"]
    lines.push(progHeaders.map(csvEscape).join(","))
    for (const row of programsData) {
      const ed = Array.isArray(row.program_editions) ? row.program_editions[0] : row.program_editions
      const prog = ed ? (Array.isArray(ed.programs) ? ed.programs[0] : ed.programs) : null
      lines.push([
        csvEscape(prog?.name),
        csvEscape(prog?.program_type),
        csvEscape(ed?.cohort_label ?? ed?.name),
        csvEscape(ed?.year),
        csvEscape(row.membership_role),
      ].join(","))
    }
  }

  // === LEGAL ENTITIES ===
  if (legalData && legalData.length > 0) {
    lines.push("")
    lines.push("=== LEGAL ENTITIES ===")
    lines.push("")
    const legalHeaders = ["Legal Name", "Legal Form", "SIREN", "SIRET", "Capital (EUR)", "Incorporated", "City", "NAF Code", "NAF Label"]
    lines.push(legalHeaders.map(csvEscape).join(","))
    for (const e of legalData) {
      lines.push([
        csvEscape(e.legal_name),
        csvEscape(e.legal_form),
        csvEscape(e.siren),
        csvEscape(e.siret),
        csvEscape(e.capital_eur ? formatEur(e.capital_eur) : ""),
        csvEscape(formatDate(e.incorporation_date)),
        csvEscape(e.registered_city),
        csvEscape(e.naf_code),
        csvEscape(e.naf_label),
      ].join(","))
    }
  }

  lines.push("")
  lines.push(`Exported from France AI Radar on ${new Date().toLocaleDateString("en-GB")}`)

  const csv = lines.join("\n")
  const filename = `${startup.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-france-ai-radar.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
