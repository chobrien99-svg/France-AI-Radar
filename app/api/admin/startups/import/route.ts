import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { extractDraftJson, validateDraft } from "@/lib/startup-import"
import { checkExisting, loadImportVocab, writeDraft } from "@/lib/startup-import-server"

export const runtime = "nodejs"

// Imports a startup draft produced by the Claude Project template.
//   POST { text, mode: "check" }   → preview, errors and warnings; writes nothing
//   POST { text, mode: "create" }  → re-validates, then creates the startup as a Draft
// "create" never trusts an earlier check: everything is validated again here.

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { text?: unknown; mode?: unknown }
  if (typeof body.text !== "string") return NextResponse.json({ error: "text required" }, { status: 400 })
  const mode = body.mode === "create" ? "create" : "check"

  const extracted = extractDraftJson(body.text)
  if ("error" in extracted) {
    return NextResponse.json({ ok: false, errors: [{ path: "", message: extracted.error }], warnings: [], draft: null })
  }

  const svc = await createServiceClient()
  const vocab = await loadImportVocab(svc)
  const validation = validateDraft(extracted.value, vocab)
  if (!validation.draft) {
    return NextResponse.json({ ok: false, errors: validation.errors, warnings: validation.warnings, draft: null })
  }

  const existing = await checkExisting(svc, validation.draft)
  const errors = [...validation.errors, ...existing.errors]
  const warnings = [...validation.warnings, ...existing.warnings]
  const matchedFounders = Object.keys(existing.founderMatches).map(Number)

  if (mode === "check" || errors.length) {
    return NextResponse.json({ ok: errors.length === 0, errors, warnings, draft: validation.draft, matchedFounders })
  }

  const result = await writeDraft(svc, validation.draft, existing.founderMatches)
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: [{ path: "", message: result.error }], warnings, draft: validation.draft, matchedFounders }, { status: 500 })
  }
  return NextResponse.json({ ok: true, created: { id: result.id, slug: result.slug }, warnings }, { status: 201 })
}
