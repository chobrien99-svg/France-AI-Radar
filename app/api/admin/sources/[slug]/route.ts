import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { ADAPTERS } from "@/lib/connectors/registry"
import { runSource } from "@/lib/connectors/run"

export const runtime = "nodejs"
export const maxDuration = 300

// Admin › Sources:
//   PATCH { enabled: boolean }          → include in (or leave out of) the daily run
//   POST  { kind: "manual" | "backfill" } → read the source now
// A "backfill" marks everything it finds as history: candidates are created
// for review but flagged as old, not news.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { slug } = await params
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 })
  const svc = await createServiceClient()
  const { data, error } = await svc.from("detection_sources").update({ enabled: body.enabled }).eq("slug", slug).select("id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: "Source not found" }, { status: 404 })
  return NextResponse.json({ ok: true, enabled: body.enabled })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { slug } = await params
  if (!ADAPTERS[slug]) return NextResponse.json({ error: "No connector for this source" }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown }
  const kind = body.kind === "backfill" ? "backfill" : "manual"
  try {
    const summary = await runSource(await createServiceClient(), slug, { kind })
    return NextResponse.json(summary)
  } catch (err) {
    console.error(`[admin/sources/${slug}] run failed:`, err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Run failed" }, { status: 500 })
  }
}
