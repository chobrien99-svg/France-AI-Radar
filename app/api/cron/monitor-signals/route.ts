import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { runMonitoring } from "@/lib/monitoring/run"
import { sendMonitoringDigest } from "@/lib/monitoring/digest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Vercel's ceiling for this project; the run stops starting new startups
// after RUN_BUDGET_MS and picks up with them first the next night.
export const maxDuration = 300
const RUN_BUDGET_MS = 240_000

// Run nightly by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const svc = await createServiceClient()
    const summary = await runMonitoring(svc, { kind: "cron", deadline: Date.now() + RUN_BUDGET_MS })
    const digest = await sendMonitoringDigest(svc, summary.candidateIds, summary.leadsAdded)
    return NextResponse.json({ ...summary, candidateIds: undefined, digestsSent: digest.sent })
  } catch (err) {
    console.error("[cron/monitor-signals] failed:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
