import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { findOrCreateInvestor, linkInvestor } from "@/lib/investors"

export const runtime = "nodejs"

// funding_rounds.amount_eur is shared with Navigator and stored in millions
// of euros (5 = €5M). The admin form takes the full euro amount.
const AMOUNT_MULTIPLIER = 1_000_000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: organization_id } = await params
  const body = await request.json()
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from("funding_rounds")
    .insert({
      organization_id,
      stage: body.stage,
      amount_eur: body.amount_eur ? Number(body.amount_eur) / AMOUNT_MULTIPLIER : null,
      announced_date: body.announced_date || null,
      source_url: body.source_url || null,
      source_name: body.source_name || null,
      notes: body.notes || null,
      is_estimated: body.is_estimated ?? false,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Investors typed with the round: [{ name, is_lead }]
  const investors: { investor_id: string; name: string; is_lead: boolean }[] = []
  const typed = Array.isArray(body.investors) ? (body.investors as { name?: unknown; is_lead?: unknown }[]) : []
  try {
    for (const inv of typed.slice(0, 20)) {
      if (typeof inv?.name !== "string" || !inv.name.trim()) continue
      const investor = await findOrCreateInvestor(supabase, inv.name)
      await linkInvestor(supabase, data.id, investor, inv.is_lead === true)
      investors.push({ investor_id: investor.id, name: investor.name, is_lead: inv.is_lead === true })
    }
  } catch (e) {
    return NextResponse.json({ ...data, investors, error: `Round saved, but ${(e as Error).message}` }, { status: 201 })
  }
  return NextResponse.json({ ...data, investors }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const roundId = request.nextUrl.searchParams.get("round_id")
  if (!roundId) return NextResponse.json({ error: "round_id required" }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase.from("funding_rounds").delete().eq("id", roundId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
