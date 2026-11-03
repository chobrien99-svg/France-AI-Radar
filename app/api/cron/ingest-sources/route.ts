import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { ADAPTERS } from "@/lib/connectors/registry"
import { runSource } from "@/lib/connectors/run"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// Daily Early Detection run (see vercel.json): reads every source switched on
// in Admin › Sources. Off unless EARLY_DETECTION_ENABLED=1 is set in Vercel,
// so deploying this code changes nothing until you decide.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (process.env.EARLY_DETECTION_ENABLED !== "1") {
    return NextResponse.json({ skipped: "EARLY_DETECTION_ENABLED is not set" })
  }

  try {
    const svc = await createServiceClient()
    const { data: sources, error } = await svc.from("detection_sources").select("slug").eq("enabled", true)
    if (error) throw new Error(error.message)
    const results: Record<string, unknown> = {}
    for (const { slug } of (sources ?? []) as { slug: string }[]) {
      if (!ADAPTERS[slug]) { results[slug] = { error: "no connector" }; continue }
      try {
        const s = await runSource(svc, slug, { kind: "cron" })
        results[slug] = { status: s.status, new: s.newRecords, changed: s.changedRecords, candidates: s.candidatesCreated, failed: s.failedRecords }
      } catch (err) {
        results[slug] = { error: err instanceof Error ? err.message : String(err) }
      }
    }
    return NextResponse.json({ sources: results })
  } catch (err) {
    console.error("[cron/ingest-sources] failed:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
