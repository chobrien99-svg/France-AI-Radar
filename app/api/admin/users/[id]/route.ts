import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const ALLOWED_TIERS = ["explorer", "professional", "enterprise"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createServiceClient()

  const updateFields: Record<string, unknown> = {}

  if (body.subscription_tier && ALLOWED_TIERS.includes(body.subscription_tier)) {
    updateFields.subscription_tier = body.subscription_tier
  }

  if (typeof body.is_admin === "boolean") {
    updateFields.is_admin = body.is_admin
  }

  if (body.subscription_status) {
    updateFields.subscription_status = body.subscription_status
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  updateFields.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("profiles")
    .update(updateFields)
    .eq("id", id)
    .select("id, email, subscription_tier, is_admin, subscription_status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
