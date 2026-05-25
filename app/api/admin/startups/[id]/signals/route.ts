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
    .from("signals")
    .insert({
      organization_id,
      signal_type: body.signal_type,
      signal_date: body.signal_date || null,
      strength: body.strength ? Number(body.strength) : null,
      title: body.title,
      description: body.description || null,
      source_url: body.source_url || null,
      source_name: body.source_name || null,
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

  const signalId = request.nextUrl.searchParams.get("signal_id")
  if (!signalId) return NextResponse.json({ error: "signal_id required" }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase.from("signals").delete().eq("id", signalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
