import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const allowedFields: Record<string, unknown> = {}
  if (body.full_name !== undefined) allowedFields.full_name = body.full_name || null
  if (body.title !== undefined) allowedFields.title = body.title || null
  if (body.company !== undefined) allowedFields.company = body.company || null
  if (body.user_type !== undefined) {
    const valid = ["vc", "business_angel", "corporate", "founder", "other"]
    allowedFields.user_type = valid.includes(body.user_type) ? body.user_type : null
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 })
  }

  allowedFields.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("profiles")
    .update(allowedFields)
    .eq("id", user.id)
    .select("id, full_name, title, company, user_type")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
