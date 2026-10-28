import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeSiren } from "@/lib/monitoring/parse"
import { vetLeads } from "@/lib/leads/vet"

export const runtime = "nodejs"
export const maxDuration = 120

// The "to vet" list:
//   POST { action: "add", sirens: "131 609 539, 131976334 …" } → add companies by hand (e.g. from a Pappers alert email), then check them
//   POST { action: "check" }                                   → run the first check and today's web research now
export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; sirens?: unknown }
  const svc = await createServiceClient()
  const deadline = Date.now() + 100_000

  if (body.action === "check") return NextResponse.json(await vetLeads(svc, { deadline }))
  if (body.action !== "add" || typeof body.sirens !== "string") return NextResponse.json({ error: "Unknown action" }, { status: 400 })

  // SIRENs are 9 digits, often written in groups of three.
  const found = body.sirens.match(/\d[\d\s.]{7,12}\d/g) ?? []
  const sirens = [...new Set(found.map((s) => normalizeSiren(s)).filter((s): s is string => Boolean(s)))].slice(0, 100)
  if (!sirens.length) return NextResponse.json({ error: "No 9-digit SIREN found" }, { status: 400 })

  const { data: entities } = await svc.from("legal_entities").select("siren")
  const onSite = new Set((entities ?? []).map((e: { siren: string | null }) => normalizeSiren(e.siren)).filter(Boolean))
  const fresh = sirens.filter((s) => !onSite.has(s))
  let added = 0
  if (fresh.length) {
    const { data, error } = await svc.from("company_leads").upsert(
      fresh.map((siren) => ({ siren, list_name: "Added by hand" })),
      { onConflict: "siren", ignoreDuplicates: true },
    ).select("siren")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    added = (data ?? []).length
  }
  const vet = await vetLeads(svc, { deadline, sirens: fresh })
  return NextResponse.json({ added, alreadyOnSite: sirens.length - fresh.length, alreadyListed: fresh.length - added, ...vet })
}
