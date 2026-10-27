import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { insertSignal } from "@/lib/signals-server"
import { FUNDING_STAGE_VALUES, SIGNAL_TYPE_VALUES } from "@/lib/monitoring/analysis"

export const runtime = "nodejs"

// Review actions on a monitoring draft (signal_candidates):
//   PATCH { ...fields }                           → save edits, stays pending
//   POST  { action: "approve", ...fields, add_funding_round? } → becomes a live signal
//   POST  { action: "reject" }

type Edits = {
  signal_type?: string
  title?: string
  description?: string | null
  signal_date?: string | null
  strength?: number | null
  funding_amount_eur?: number | null
  funding_stage?: string | null
  investors?: string | null
}

/** Picks the editable fields out of a request body, refusing bad values. */
function readEdits(body: Record<string, unknown>): { edits: Edits } | { error: string } {
  const edits: Edits = {}
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  if ("signal_type" in body) {
    if (typeof body.signal_type !== "string" || !SIGNAL_TYPE_VALUES.includes(body.signal_type)) return { error: "Unknown signal type" }
    edits.signal_type = body.signal_type
  }
  if ("title" in body) {
    const t = str(body.title)
    if (!t) return { error: "Title is required" }
    edits.title = t
  }
  if ("description" in body) edits.description = str(body.description)
  if ("signal_date" in body) {
    const d = str(body.signal_date)
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Date must be YYYY-MM-DD" }
    edits.signal_date = d
  }
  if ("strength" in body) {
    const n = body.strength === null || body.strength === "" ? null : Number(body.strength)
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 5)) return { error: "Strength must be 1 to 5" }
    edits.strength = n
  }
  if ("funding_amount_eur" in body) {
    const n = body.funding_amount_eur === null || body.funding_amount_eur === "" ? null : Number(body.funding_amount_eur)
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return { error: "Amount must be a positive number of millions" }
    edits.funding_amount_eur = n
  }
  if ("funding_stage" in body) {
    const s = str(body.funding_stage)
    if (s && !FUNDING_STAGE_VALUES.includes(s)) return { error: "Unknown funding stage" }
    edits.funding_stage = s
  }
  if ("investors" in body) edits.investors = str(body.investors)
  return { edits }
}

async function loadPending(id: string) {
  const svc = await createServiceClient()
  const { data } = await svc.from("signal_candidates").select("*").eq("id", id).maybeSingle()
  return { svc, candidate: data as Record<string, unknown> | null }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const read = readEdits(body)
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })

  const { svc, candidate } = await loadPending(id)
  if (!candidate) return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  if (candidate.status !== "pending") return NextResponse.json({ error: "This draft was already reviewed" }, { status: 409 })

  const { error } = await svc.from("signal_candidates").update(read.edits).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 })

  const { svc, candidate } = await loadPending(id)
  if (!candidate) return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  if (candidate.status !== "pending") return NextResponse.json({ error: "This draft was already reviewed" }, { status: 409 })

  const reviewed = { reviewed_by: admin.id, reviewed_at: new Date().toISOString() }

  if (action === "reject") {
    const { error } = await svc.from("signal_candidates").update({ status: "rejected", ...reviewed }).eq("id", id).eq("status", "pending")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  const read = readEdits(body)
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })
  const c = { ...candidate, ...read.edits } as Record<string, unknown>

  // Claim the draft first so two reviewers can't both publish it.
  const { data: claimed, error: claimError } = await svc.from("signal_candidates")
    .update({ ...read.edits, status: "approved", ...reviewed })
    .eq("id", id).eq("status", "pending").select("id")
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimed?.length) return NextResponse.json({ error: "This draft was already reviewed" }, { status: 409 })

  const organizationId = c.organization_id as string
  const result = await insertSignal(svc, organizationId, {
    signal_type: c.signal_type as string,
    signal_date: (c.signal_date as string | null) ?? null,
    strength: (c.strength as number | null) ?? null,
    title: c.title as string,
    description: (c.description as string | null) ?? null,
    source_url: c.source_url as string,
    source_name: (c.source_name as string | null) ?? null,
  })
  if ("error" in result) {
    // Put the draft back so it can be retried.
    await svc.from("signal_candidates").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("id", id)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  await svc.from("signal_candidates").update({ signal_id: result.id }).eq("id", id)

  let fundingRoundId: string | null = null
  let warning: string | undefined
  if (body.add_funding_round === true && c.signal_type === "fundraising") {
    const { data: round, error } = await svc.from("funding_rounds").insert({
      organization_id: organizationId,
      stage: (c.funding_stage as string | null) || "undisclosed",
      amount_eur: (c.funding_amount_eur as number | null) ?? null,   // already in millions
      announced_date: (c.signal_date as string | null) ?? null,
      source_url: c.source_url as string,
      source_name: (c.source_name as string | null) ?? null,
      notes: c.investors ? `Investors: ${c.investors}` : null,
      is_estimated: false,
    }).select("id").single()
    if (error) warning = `Signal published, but the funding round could not be added: ${error.message}`
    else fundingRoundId = round.id as string
  }

  return NextResponse.json({ ok: true, status: "approved", signalId: result.id, fundingRoundId, warning })
}
