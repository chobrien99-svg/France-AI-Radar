import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { extractDraftJson, validateDraft } from "@/lib/startup-import"
import { checkExisting, loadImportVocab, updateFromDraft, writeDraft } from "@/lib/startup-import-server"

export const runtime = "nodejs"

// Imports a startup draft produced by the Claude Project template.
//   POST { text, mode: "check" }   → preview, errors and warnings; writes nothing
//   POST { text, mode: "create" }  → re-validates, then creates the startup as a Draft
//   POST { text, mode: "update", targetId } → fills the empty fields of an existing
//        record (same slug or SIREN) and adds what it lacks; nothing is overwritten
// "create" and "update" never trust an earlier check: everything is validated again here.

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { text?: unknown; mode?: unknown; targetId?: unknown }
  if (typeof body.text !== "string") return NextResponse.json({ error: "text required" }, { status: 400 })
  const mode = body.mode === "create" ? "create" : body.mode === "update" ? "update" : "check"
  const targetId = mode === "update" && typeof body.targetId === "string" ? body.targetId : undefined
  if (mode === "update" && !targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 })

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

  const existing = await checkExisting(svc, validation.draft, targetId)
  // Only the record the draft actually matches (same slug or SIREN) can be updated
  if (targetId && existing.existing?.id !== targetId) {
    existing.errors.push({ path: "", message: "This draft doesn't match that startup (different slug and SIREN). Check the draft again." })
  }
  const errors = [...validation.errors, ...existing.errors]
  const warnings = [...validation.warnings, ...existing.warnings]
  const matchedFounders = Object.keys(existing.founderMatches).map(Number)

  if (mode === "check" || errors.length) {
    return NextResponse.json({ ok: errors.length === 0, errors, warnings, draft: validation.draft, matchedFounders, existing: existing.existing })
  }

  if (targetId) {
    const result = await updateFromDraft(svc, validation.draft, targetId, existing.founderMatches)
    if (!result.ok) {
      return NextResponse.json({ ok: false, errors: [{ path: "", message: result.error }], warnings, draft: validation.draft, matchedFounders }, { status: 500 })
    }
    return NextResponse.json({ ok: true, updated: { id: result.id, slug: result.slug, filled: result.filled, added: result.added }, warnings })
  }

  const result = await writeDraft(svc, validation.draft, existing.founderMatches)
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: [{ path: "", message: result.error }], warnings, draft: validation.draft, matchedFounders }, { status: 500 })
  }
  return NextResponse.json({ ok: true, created: { id: result.id, slug: result.slug }, warnings }, { status: 201 })
}
