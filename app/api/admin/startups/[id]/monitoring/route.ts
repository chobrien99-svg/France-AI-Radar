import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { runMonitoring } from "@/lib/monitoring/run"
import { pappersConfigured, searchCompanies } from "@/lib/monitoring/pappers"
import { normalizeSiren } from "@/lib/monitoring/parse"

export const runtime = "nodejs"
export const maxDuration = 120

// Monitoring for one startup:
//   PATCH { enabled?, search_aliases?, exclude_terms? } → save settings
//   POST                                                → "Check now": run the monitor for this startup only
//   GET ?q=<name>                                       → find the company on Pappers (costs credits)
//   POST { action: "set_siren", match }                 → save the Pappers match the admin picked

const cleanList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20) : null

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const update: Record<string, unknown> = { organization_id: id, updated_at: new Date().toISOString() }
  if (typeof body.enabled === "boolean") update.enabled = body.enabled
  const aliases = cleanList(body.search_aliases)
  if (aliases) update.search_aliases = aliases
  const excludes = cleanList(body.exclude_terms)
  if (excludes) update.exclude_terms = excludes

  const svc = await createServiceClient()
  const { data, error } = await svc.from("monitoring_state").upsert(update, { onConflict: "organization_id" }).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!pappersConfigured()) return NextResponse.json({ error: "PAPPERS_API_KEY is not set" }, { status: 400 })
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120)
  if (q.length < 2) return NextResponse.json({ error: "Type a name to search for" }, { status: 400 })
  try {
    return NextResponse.json({ matches: await searchCompanies(q) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Pappers search failed" }, { status: 502 })
  }
}

const text = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

/** Adds the picked company as the startup's primary legal entity, unless it already has a SIREN. */
async function setSiren(id: string, match: Record<string, unknown>) {
  const siren = normalizeSiren(typeof match.siren === "string" ? match.siren : null)
  const legalName = text(match.name)
  if (!siren || !legalName) return NextResponse.json({ error: "Pick a company with a valid SIREN" }, { status: 400 })
  const svc = await createServiceClient()
  const { data: existing } = await svc.from("legal_entities").select("id, siren").eq("organization_id", id)
  if ((existing ?? []).some((e: { siren: string | null }) => e.siren)) {
    return NextResponse.json({ error: "This startup already has a SIREN; edit it under Legal entities" }, { status: 409 })
  }
  const createdOn = typeof match.createdOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(match.createdOn) ? match.createdOn : null
  const capital = typeof match.capital === "number" && Number.isFinite(match.capital) ? match.capital : null
  const { data, error } = await svc.from("legal_entities").insert({
    organization_id: id,
    legal_name: legalName,
    siren,
    legal_form: text(match.legalForm),
    registered_city: text(match.city),
    incorporation_date: createdOn,
    naf_code: text(match.nafCode, 20),
    naf_label: text(match.activity),
    capital_eur: capital,
    is_primary: !(existing ?? []).length,
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, siren })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.action === "set_siren") {
    return setSiren(id, (body.match && typeof body.match === "object" ? body.match : {}) as Record<string, unknown>)
  }
  const svc = await createServiceClient()
  const summary = await runMonitoring(svc, { kind: "manual", organizationId: id, deadline: Date.now() + 90_000 })
  return NextResponse.json({ ...summary, candidateIds: undefined })
}
