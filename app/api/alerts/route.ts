import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const organization_id = body.organization_id
  if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 })

  const { error } = await supabase
    .from("alerts")
    .insert({
      user_id: user.id,
      organization_id,
      alert_type: "signal",
      is_active: true,
    })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ alert: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alert: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const organization_id = request.nextUrl.searchParams.get("organization_id")
  if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 })

  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("user_id", user.id)
    .eq("organization_id", organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ alert: false })
}
