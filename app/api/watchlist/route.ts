import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { startup_id } = await request.json()
  if (!startup_id) return NextResponse.json({ error: "startup_id required" }, { status: 400 })

  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: user.id, startup_id })

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

  const startup_id = request.nextUrl.searchParams.get("startup_id")
  if (!startup_id) return NextResponse.json({ error: "startup_id required" }, { status: 400 })

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("startup_id", startup_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: false })
}
