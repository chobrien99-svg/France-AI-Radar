import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { ReviewError, addNote, changeState, decideSubject, updateProjectDetails } from "@/lib/detection/review"

export const runtime = "nodejs"

// Editor actions on an Early Detection candidate (Admin › Candidates):
//   { action: "state", to, note?, organization_slug?, merge_into_id? }
//   { action: "note", note }
//   { action: "subject", subject_id, decision: "confirm" | "unmatched" | "reject" | "reopen", option_id? }
//   { action: "details", brand_name?, website_url?, linkedin_url? }   (empty string clears a field)
// Every action is checked and logged in lib/detection/review.ts. Nothing here publishes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const str = (v: unknown) => (typeof v === "string" ? v : null)

  try {
    const svc = await createServiceClient()
    if (body.action === "state") {
      const result = await changeState(svc, id, String(body.to ?? ""), admin.id, {
        note: str(body.note),
        organizationSlug: str(body.organization_slug),
        mergeIntoId: str(body.merge_into_id),
      })
      return NextResponse.json({ ok: true, ...result })
    }
    if (body.action === "note") {
      await addNote(svc, id, admin.id, str(body.note) ?? "")
      return NextResponse.json({ ok: true })
    }
    if (body.action === "subject") {
      await decideSubject(svc, String(body.subject_id ?? ""), String(body.decision ?? ""), admin.id, str(body.option_id))
      return NextResponse.json({ ok: true })
    }
    if (body.action === "details") {
      // Only the fields actually sent are changed.
      const fields = Object.fromEntries(["brand_name", "website_url", "linkedin_url"].filter((k) => k in body).map((k) => [k, body[k]]))
      return NextResponse.json({ ok: true, ...(await updateProjectDetails(svc, id, admin.id, fields)) })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error("[admin/candidates] action failed:", err)
    return NextResponse.json({ error: "Something went wrong; nothing was changed or only part of it. Reload to check." }, { status: 500 })
  }
}
