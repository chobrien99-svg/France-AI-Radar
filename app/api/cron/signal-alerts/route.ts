import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendSignalAlerts } from "@/lib/signal-alerts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Run daily by Vercel Cron (see vercel.json): emails subscribers the new
// signals on startups they set alerts on. Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendSignalAlerts(await createServiceClient())
    return NextResponse.json(result)
  } catch (err) {
    console.error("[cron/signal-alerts] failed:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
