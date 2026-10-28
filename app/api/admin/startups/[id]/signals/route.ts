import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { insertSignal, signalFromBody, updateSignalCount } from "@/lib/signals-server"

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

  const result = await insertSignal(supabase, organization_id, signalFromBody(body))
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ id: result.id }, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const signalId = body.signal_id
  if (!signalId) return NextResponse.json({ error: "signal_id required" }, { status: 400 })

  const { id: organization_id } = await params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from("signals")
    .update(signalFromBody(body))
    .eq("id", signalId)
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The date may have changed, which moves last_signal_date.
  await updateSignalCount(supabase, organization_id)
  return NextResponse.json(data)
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
  const { id: organization_id } = await params
  const { error } = await supabase.from("signals").delete().eq("id", signalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await updateSignalCount(supabase, organization_id)
  return NextResponse.json({ deleted: true })
}
