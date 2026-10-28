import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeSiren } from "@/lib/monitoring/parse"

export const runtime = "nodejs"

// A company from a Pappers saved search, on the "to vet" list:
//   PATCH { status: "added" | "ignored" | "new" } → mark it reviewed (or put it back)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siren: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const siren = normalizeSiren((await params).siren)
  if (!siren) return NextResponse.json({ error: "Not a SIREN" }, { status: 400 })
  const body = (await request.json().catch(() => ({}))) as { status?: unknown }
  if (body.status !== "added" && body.status !== "ignored" && body.status !== "new") {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 })
  }
  const reviewed = body.status === "new"
    ? { reviewed_by: null, reviewed_at: null }
    : { reviewed_by: admin.id, reviewed_at: new Date().toISOString() }
  const svc = await createServiceClient()
  const { data, error } = await svc.from("company_leads").update({ status: body.status, ...reviewed }).eq("siren", siren).select("siren, status").maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}
