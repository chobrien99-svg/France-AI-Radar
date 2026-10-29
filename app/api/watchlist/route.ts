import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isRadarOrg } from "@/lib/radar-data"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const organization_id = body.organization_id || body.startup_id
  if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 })
  if (typeof organization_id !== "string" || !(await isRadarOrg(await createServiceClient(), organization_id))) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: user.id, organization_id })

  if (error) {
    if (error.code === "23505") {
      // Already saved — treat as success
      return NextResponse.json({ saved: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const organization_id = request.nextUrl.searchParams.get("organization_id") || request.nextUrl.searchParams.get("startup_id")
  if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 })

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("organization_id", organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: false })
}
