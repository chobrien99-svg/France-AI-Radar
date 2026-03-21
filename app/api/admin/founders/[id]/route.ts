import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createServiceClient()

  const { data: founder, error } = await supabase
    .from("founders")
    .update({
      name: body.name,
      slug: body.slug,
      role: body.role || null,
      bio: body.bio || null,
      linkedin_url: body.linkedin_url || null,
      founder_signals: body.founder_signals?.length ? body.founder_signals : null,
      big_tech_employer: body.big_tech_employer || null,
      academic_lab: body.academic_lab || null,
      has_phd: !!body.has_phd,
      is_repeat_founder: !!body.is_repeat_founder,
      has_big_tech_background: !!body.has_big_tech_background,
      previous_companies: body.previous_companies?.length ? body.previous_companies : null,
      previous_exits: body.previous_exits?.length ? body.previous_exits : null,
    })
    .eq("id", id)
    .select("id, slug")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(founder)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const supabase = await createServiceClient()

  // Remove from all startup junction rows first (CASCADE would handle it, but explicit is clearer)
  await supabase.from("startup_founders").delete().eq("founder_id", id)

  const { error } = await supabase.from("founders").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
