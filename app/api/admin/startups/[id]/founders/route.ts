import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/** Link a founder to a startup */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: startup_id } = await params
  const { founder_id, role } = await request.json()
  if (!founder_id) return NextResponse.json({ error: "founder_id required" }, { status: 400 })

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("startup_founders")
    .upsert({ startup_id, founder_id, role: role || null }, { onConflict: "startup_id,founder_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ linked: true })
}

/** Unlink a founder from a startup */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: startup_id } = await params
  const founder_id = request.nextUrl.searchParams.get("founder_id")
  if (!founder_id) return NextResponse.json({ error: "founder_id required" }, { status: 400 })

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("startup_founders")
    .delete()
    .eq("startup_id", startup_id)
    .eq("founder_id", founder_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ unlinked: true })
}
