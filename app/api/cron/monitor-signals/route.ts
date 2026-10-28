import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { runMonitoring } from "@/lib/monitoring/run"
import { sendMonitoringDigest } from "@/lib/monitoring/digest"
import { vetLeads } from "@/lib/leads/vet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Vercel's ceiling for this project; the run stops starting new startups
// after RUN_BUDGET_MS and picks up with them first the next night.
export const maxDuration = 300
const RUN_BUDGET_MS = 240_000
/** Kept back from the signal check for ranking the companies to vet. */
const LEADS_BUDGET_MS = 70_000

// Run nightly by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const svc = await createServiceClient()
    const started = Date.now()
    const summary = await runMonitoring(svc, { kind: "cron", deadline: started + RUN_BUDGET_MS - LEADS_BUDGET_MS })
    // Then rank the companies to vet (including any the run just added).
    const leads = await vetLeads(svc, { deadline: started + RUN_BUDGET_MS })
    if (summary.runId && leads.errors.length) {
      await svc.from("monitoring_runs").update({ errors: [...summary.errors, ...leads.errors].slice(0, 150) }).eq("id", summary.runId)
    }
    const digest = await sendMonitoringDigest(svc, summary.candidateIds, summary.leadsAdded)
    return NextResponse.json({ ...summary, candidateIds: undefined, leads, digestsSent: digest.sent })
  } catch (err) {
    console.error("[cron/monitor-signals] failed:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
