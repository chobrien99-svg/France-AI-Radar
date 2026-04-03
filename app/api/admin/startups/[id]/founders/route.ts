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

  const { id: organization_id } = await params
  const { founder_id, role } = await request.json()
  if (!founder_id) return NextResponse.json({ error: "founder_id required" }, { status: 400 })

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("organization_people")
    .upsert(
      { organization_id, person_id: founder_id, role: role || null, is_founder: true, is_current: true },
      { onConflict: "organization_id,person_id,role" }
    )

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

  const { id: organization_id } = await params
  const founder_id = request.nextUrl.searchParams.get("founder_id")
  if (!founder_id) return NextResponse.json({ error: "founder_id required" }, { status: 400 })

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("organization_people")
    .delete()
    .eq("organization_id", organization_id)
    .eq("person_id", founder_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ unlinked: true })
}
