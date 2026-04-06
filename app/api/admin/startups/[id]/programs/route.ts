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

  // Link org to a program edition. If edition_id is provided, use it directly.
  // Otherwise, look up or create the program and edition.
  let editionId = body.edition_id as string | null

  if (!editionId && body.program_name) {
    // Find or create the program
    let programId: string
    const { data: existingProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("name", body.program_name)
      .maybeSingle()

    if (existingProgram) {
      programId = existingProgram.id
    } else {
      const slug = body.program_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const { data: newProgram, error: progErr } = await supabase
        .from("programs")
        .insert({
          name: body.program_name,
          slug,
          program_type: body.program_type || "other",
        })
        .select("id")
        .single()
      if (progErr) return NextResponse.json({ error: progErr.message }, { status: 500 })
      programId = newProgram.id
    }

    // Find or create the edition
    const editionLabel = body.edition_label || body.program_name
    const { data: existingEdition } = await supabase
      .from("program_editions")
      .select("id")
      .eq("program_id", programId)
      .eq("cohort_label", editionLabel)
      .maybeSingle()

    if (existingEdition) {
      editionId = existingEdition.id
    } else {
      const { data: newEdition, error: edErr } = await supabase
        .from("program_editions")
        .insert({
          program_id: programId,
          name: editionLabel,
          cohort_label: editionLabel,
          year: body.year ? Number(body.year) : null,
        })
        .select("id")
        .single()
      if (edErr) return NextResponse.json({ error: edErr.message }, { status: 500 })
      editionId = newEdition.id
    }
  }

  if (!editionId) {
    return NextResponse.json({ error: "Either edition_id or program_name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("program_organizations")
    .insert({
      program_edition_id: editionId,
      organization_id,
      membership_role: body.membership_role || null,
      notes: body.notes || null,
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

  const linkId = request.nextUrl.searchParams.get("link_id")
  if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase.from("program_organizations").delete().eq("id", linkId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
