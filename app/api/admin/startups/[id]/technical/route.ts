import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { CLAIMS, EVIDENCE_STATUSES, RELATIONSHIP_KINDS } from "@/lib/taxonomy"

export const runtime = "nodejs"

// Technical classification links for one startup. Each change is saved on
// its own, so editing a classification never rewrites unrelated fields.
//   POST   { type: "primary", layer_id | null, ...evidence }   set or clear the primary layer
//   POST   { type: "layer", layer_id, ...evidence }            add a secondary layer
//   POST   { type: "term", term_id, relationship_kind, is_core, ...evidence }
//   POST   { type: "claim", claim, ...evidence }
//   PATCH  { type: "layer" | "term" | "claim", id, ...fields }  edit evidence / relationship
//   DELETE ?type=layer|term|claim&id=…

const TABLES = {
  layer: "organization_technical_layers",
  term: "organization_technical_terms",
  claim: "organization_technology_claims",
} as const
type LinkType = keyof typeof TABLES

const isIn = (options: { value: string }[], v: unknown) => typeof v === "string" && options.some((o) => o.value === v)

/** Evidence fields from a request body; throws a message on invalid input */
function evidence(body: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (body.evidence_status !== undefined || !partial) {
    const status = body.evidence_status ?? "unverified"
    if (!isIn(EVIDENCE_STATUSES, status)) throw new Error("Invalid evidence status")
    out.evidence_status = status
  }
  if (body.source_url !== undefined || !partial) {
    const url = typeof body.source_url === "string" ? body.source_url.trim() : ""
    if (url && !/^https?:\/\//i.test(url)) throw new Error("Source URL must start with http:// or https://")
    out.source_url = url || null
  }
  if (body.source_note !== undefined || !partial) {
    out.source_note = typeof body.source_note === "string" && body.source_note.trim() ? body.source_note.trim() : null
  }
  return out
}

function termFields(body: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (body.relationship_kind !== undefined || !partial) {
    const kind = body.relationship_kind ?? "develops"
    if (!isIn(RELATIONSHIP_KINDS, kind)) throw new Error("Invalid relationship")
    out.relationship_kind = kind
  }
  if (body.is_core !== undefined || !partial) out.is_core = !!body.is_core
  return out
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Readable message for the constraint errors admins can actually hit */
function dbError(error: { code?: string; message: string }) {
  if (error.code === "23505") return fail("Already linked to this startup.", 409)
  return fail(error.message, 500)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return fail("Forbidden", 403)

  const { id: organization_id } = await params
  const body = (await request.json()) as Record<string, unknown>
  const supabase = await createServiceClient()

  let row: Record<string, unknown>
  try {
    if (body.type === "primary") {
      // Replace the current primary layer (if any). A layer that was secondary is promoted.
      const { error: clearErr } = await supabase.from(TABLES.layer).delete().eq("organization_id", organization_id).eq("is_primary", true)
      if (clearErr) return dbError(clearErr)
      if (!body.layer_id) return NextResponse.json({ id: null })
      const { error: dupErr } = await supabase.from(TABLES.layer).delete().eq("organization_id", organization_id).eq("layer_id", body.layer_id as string)
      if (dupErr) return dbError(dupErr)
      row = { organization_id, layer_id: body.layer_id, is_primary: true, ...evidence(body, false) }
      const { data, error } = await supabase.from(TABLES.layer).insert(row).select("id").single()
      return error ? dbError(error) : NextResponse.json(data, { status: 201 })
    }

    if (body.type === "layer") {
      if (typeof body.layer_id !== "string") return fail("layer_id required")
      row = { organization_id, layer_id: body.layer_id, is_primary: false, ...evidence(body, false) }
    } else if (body.type === "term") {
      if (typeof body.term_id !== "string") return fail("term_id required")
      row = { organization_id, term_id: body.term_id, ...termFields(body, false), ...evidence(body, false) }
    } else if (body.type === "claim") {
      if (!isIn(CLAIMS, body.claim)) return fail("Invalid claim")
      row = { organization_id, claim: body.claim, ...evidence(body, false) }
    } else {
      return fail("Unknown type")
    }
  } catch (e) {
    return fail((e as Error).message)
  }

  const { data, error } = await supabase.from(TABLES[body.type as LinkType]).insert(row).select("id").single()
  return error ? dbError(error) : NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return fail("Forbidden", 403)

  const { id: organization_id } = await params
  const body = (await request.json()) as Record<string, unknown>
  const type = body.type as LinkType
  if (!(type in TABLES) || typeof body.id !== "string") return fail("type and id required")

  let fields: Record<string, unknown>
  try {
    fields = { ...evidence(body, true), ...(type === "term" ? termFields(body, true) : {}) }
  } catch (e) {
    return fail((e as Error).message)
  }
  if (Object.keys(fields).length === 0) return fail("Nothing to update")

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from(TABLES[type])
    .update(fields)
    .eq("id", body.id)
    .eq("organization_id", organization_id)
  return error ? dbError(error) : NextResponse.json({ updated: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return fail("Forbidden", 403)

  const { id: organization_id } = await params
  const type = request.nextUrl.searchParams.get("type") as LinkType
  const linkId = request.nextUrl.searchParams.get("id")
  if (!(type in TABLES) || !linkId) return fail("type and id required")

  const supabase = await createServiceClient()
  const { error } = await supabase.from(TABLES[type]).delete().eq("id", linkId).eq("organization_id", organization_id)
  return error ? dbError(error) : NextResponse.json({ deleted: true })
}
