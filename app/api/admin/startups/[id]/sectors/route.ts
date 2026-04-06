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

  // Find or create the sector
  let sectorId = body.sector_id as string | null

  if (!sectorId && body.sector_name) {
    const { data: existing } = await supabase
      .from("sectors")
      .select("id")
      .eq("name", body.sector_name)
      .maybeSingle()

    if (existing) {
      sectorId = existing.id
    } else {
      const slug = body.sector_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const { data: newSector, error: secErr } = await supabase
        .from("sectors")
        .insert({ name: body.sector_name, slug })
        .select("id")
        .single()
      if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 })
      sectorId = newSector.id
    }
  }

  if (!sectorId) {
    return NextResponse.json({ error: "Either sector_id or sector_name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("organization_sectors")
    .insert({
      organization_id,
      sector_id: sectorId,
      is_primary: body.is_primary ?? false,
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
  const { error } = await supabase.from("organization_sectors").delete().eq("id", linkId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
