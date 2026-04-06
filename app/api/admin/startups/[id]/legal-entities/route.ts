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
    .from("legal_entities")
    .insert({
      organization_id,
      legal_name: body.legal_name,
      legal_form: body.legal_form || null,
      siren: body.siren || null,
      siret: body.siret || null,
      capital_eur: body.capital_eur ? Number(body.capital_eur) : null,
      incorporation_date: body.incorporation_date || null,
      registered_city: body.registered_city || null,
      naf_code: body.naf_code || null,
      naf_label: body.naf_label || null,
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

  const entityId = request.nextUrl.searchParams.get("entity_id")
  if (!entityId) return NextResponse.json({ error: "entity_id required" }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase.from("legal_entities").delete().eq("id", entityId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
