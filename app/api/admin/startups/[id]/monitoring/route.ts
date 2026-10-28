import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { runMonitoring } from "@/lib/monitoring/run"

export const runtime = "nodejs"
export const maxDuration = 120

// Monitoring for one startup:
//   PATCH { enabled?, search_aliases?, exclude_terms? } → save settings
//   POST                                                → "Check now": run the monitor for this startup only

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

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const svc = await createServiceClient()
  const summary = await runMonitoring(svc, { kind: "manual", organizationId: id, deadline: Date.now() + 90_000 })
  return NextResponse.json({ ...summary, candidateIds: undefined })
}
