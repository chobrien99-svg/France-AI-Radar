import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { searchInvestors } from "@/lib/investors"

export const runtime = "nodejs"

// GET ?q=  → investors from the shared list whose name contains q (suggestions in the round editor)
export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const q = request.nextUrl.searchParams.get("q") ?? ""
  return NextResponse.json(await searchInvestors(await createServiceClient(), q))
}
