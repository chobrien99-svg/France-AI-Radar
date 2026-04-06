import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

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
      amount_eur: body.amount_eur ? Number(body.amount_eur) : null,
      announced_date: body.announced_date || null,
      source_url: body.source_url || null,
      source_name: body.source_name || null,
      notes: body.notes || null,
      is_estimated: body.is_estimated ?? false,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
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
