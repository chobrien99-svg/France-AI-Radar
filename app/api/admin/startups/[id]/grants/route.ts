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
    .from("grants")
    .insert({
      organization_id,
      grant_name: body.grant_name,
      granting_body: body.granting_body || null,
      amount_eur: body.amount_eur ? Number(body.amount_eur) : null,
      awarded_date: body.awarded_date || null,
      program: body.program || null,
      description: body.description || null,
      source_url: body.source_url || null,
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

  const grantId = request.nextUrl.searchParams.get("grant_id")
  if (!grantId) return NextResponse.json({ error: "grant_id required" }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase.from("grants").delete().eq("id", grantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
