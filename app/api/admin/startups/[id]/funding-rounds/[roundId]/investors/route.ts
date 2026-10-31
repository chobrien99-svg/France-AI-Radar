import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { findOrCreateInvestor, linkInvestor } from "@/lib/investors"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; roundId: string }> }

async function roundOfStartup(svc: SupabaseClient, organizationId: string, roundId: string) {
  const { data } = await svc.from("funding_rounds").select("id").eq("id", roundId).eq("organization_id", organizationId).maybeSingle()
  return !!data
}

// POST { investor_id } or { name }, plus is_lead → links the investor to the round
// (a name not in the shared list creates a new investor there)
export async function POST(request: NextRequest, { params }: Params) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, roundId } = await params
  const body = (await request.json().catch(() => ({}))) as { investor_id?: unknown; name?: unknown; is_lead?: unknown }
  const svc = await createServiceClient()
  if (!(await roundOfStartup(svc, id, roundId))) return NextResponse.json({ error: "Round not found" }, { status: 404 })

  try {
    let investor: { id: string; name: string }
    if (typeof body.investor_id === "string") {
      const { data } = await svc.from("organizations").select("id, name").eq("id", body.investor_id).eq("organization_type", "investor").maybeSingle()
      if (!data) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
      investor = data
    } else if (typeof body.name === "string" && body.name.trim()) {
      investor = await findOrCreateInvestor(svc, body.name)
    } else {
      return NextResponse.json({ error: "investor_id or name required" }, { status: 400 })
    }
    await linkInvestor(svc, roundId, investor, body.is_lead === true)
    return NextResponse.json({ investor_id: investor.id, name: investor.name, is_lead: body.is_lead === true }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// DELETE ?investor_id= → unlinks the investor from the round (the investor itself stays in the shared list)
export async function DELETE(request: NextRequest, { params }: Params) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, roundId } = await params
  const investorId = request.nextUrl.searchParams.get("investor_id")
  if (!investorId) return NextResponse.json({ error: "investor_id required" }, { status: 400 })
  const svc = await createServiceClient()
  if (!(await roundOfStartup(svc, id, roundId))) return NextResponse.json({ error: "Round not found" }, { status: 404 })
  const { error } = await svc.from("funding_round_investors").delete().eq("funding_round_id", roundId).eq("investor_id", investorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
