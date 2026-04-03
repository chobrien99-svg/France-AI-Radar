import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: list_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { startup_id: organization_id } = await request.json()
  if (!organization_id) return NextResponse.json({ error: "startup_id required" }, { status: 400 })

  // Verify list ownership
  const { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("id", list_id)
    .eq("user_id", user.id)
    .single()

  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 })

  const { error } = await supabase
    .from("list_items")
    .insert({ list_id, organization_id })

  if (error) {
    if (error.code === "23505") return NextResponse.json({ added: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ added: true }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: list_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const organization_id = request.nextUrl.searchParams.get("startup_id")
  if (!organization_id) return NextResponse.json({ error: "startup_id required" }, { status: 400 })

  // Verify list ownership
  const { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("id", list_id)
    .eq("user_id", user.id)
    .single()

  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 })

  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", list_id)
    .eq("organization_id", organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ removed: true })
}
