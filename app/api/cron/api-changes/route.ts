import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { parseKeyConfig } from "@/lib/api/keys"
import { recordChanges } from "@/lib/api/sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Every 10 minutes (see vercel.json): records changes to published companies
// and signals in the Enterprise API change feed. Skipped while the API is
// switched off (no ENTERPRISE_API_KEYS). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (parseKeyConfig(process.env.ENTERPRISE_API_KEYS).length === 0) {
    return NextResponse.json({ skipped: "Enterprise API is switched off (ENTERPRISE_API_KEYS is empty)" })
  }
  try {
    const result = await recordChanges(await createServiceClient())
    return NextResponse.json(result)
  } catch (err) {
    console.error("[api-changes]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Change feed run failed" }, { status: 500 })
  }
}
