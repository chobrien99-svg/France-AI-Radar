import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

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
