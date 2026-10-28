import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { MAX_WEBHOOK_BYTES, receivePappersWebhook } from "@/lib/monitoring/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Pappers posts surveillance and veille notifications here. The address
// given to Pappers carries ?token=<PAPPERS_WEBHOOK_SECRET>; anything else is
// refused. Messages are only stored: the nightly monitoring run reads them,
// so a burst or a retry costs nothing here.
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 })
  }
  const svc = await createServiceClient()
  const { status, body } = await receivePappersWebhook(svc, request.nextUrl.searchParams.get("token"), await request.text())
  return NextResponse.json(body, { status })
}
