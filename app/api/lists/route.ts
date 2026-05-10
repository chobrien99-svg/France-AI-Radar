import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const startupId = request.nextUrl.searchParams.get("startup_id")

  const { data: userLists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!startupId) {
    return NextResponse.json({ lists: (userLists ?? []).map((l) => ({ ...l, hasItem: false })) })
  }

  const { data: listItems } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("organization_id", startupId)

  const itemListIds = new Set((listItems ?? []).map((i: { list_id: string }) => i.list_id))

  const lists = (userLists ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    hasItem: itemListIds.has(l.id),
  }))

  return NextResponse.json({ lists })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, description, is_public } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const { data, error } = await supabase
    .from("lists")
    .insert({ user_id: user.id, name: name.trim(), description: description?.trim() || null, is_public: !!is_public })
    .select("id, name, description, is_public, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
