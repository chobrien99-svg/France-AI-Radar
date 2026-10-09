import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { LOGO_BUCKET, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/logo-spec"

export const runtime = "nodejs"

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

type Svc = Awaited<ReturnType<typeof createServiceClient>>

/** Create the public logos bucket on first use so no manual setup is needed */
async function ensureBucket(svc: Svc) {
  const { data } = await svc.storage.getBucket(LOGO_BUCKET)
  if (data) return null
  const { error } = await svc.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: LOGO_MAX_BYTES,
    allowedMimeTypes: [...LOGO_TYPES],
  })
  return error && !/already exists/i.test(error.message) ? error : null
}

/** Remove the stored file behind a logo URL, if it lives in our bucket */
async function removeStored(svc: Svc, url: string | null) {
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  if (url && i >= 0) await svc.storage.from(LOGO_BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))])
}

/** Upload (or replace) a startup's logo. Body: multipart form with `file`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 })
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Logo must be a PNG, JPG or WebP image." }, { status: 400 })
  }
  if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: "Logo must be 1 MB or smaller." }, { status: 400 })

  const svc = await createServiceClient()
  const { data: org } = await svc.from("organizations").select("id, slug, logo_url").eq("id", id).maybeSingle()
  if (!org) return NextResponse.json({ error: "Startup not found." }, { status: 404 })

  const bucketError = await ensureBucket(svc)
  if (bucketError) return NextResponse.json({ error: `Storage setup failed: ${bucketError.message}` }, { status: 500 })

  // New file name per upload so browsers and CDNs never show a stale logo
  const path = `${org.slug}-${Date.now()}.${EXT[file.type]}`
  const { error: uploadError } = await svc.storage
    .from(LOGO_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" })
  if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })

  const logoUrl = svc.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
  const { error: updateError } = await svc
    .from("organizations")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (updateError) {
    await svc.storage.from(LOGO_BUCKET).remove([path])
    return NextResponse.json({ error: `Could not save logo: ${updateError.message}` }, { status: 500 })
  }

  await removeStored(svc, org.logo_url as string | null)
  return NextResponse.json({ logo_url: logoUrl })
}

/** Remove a startup's logo (the card falls back to initials) */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const svc = await createServiceClient()
  const { data: org } = await svc.from("organizations").select("logo_url").eq("id", id).maybeSingle()
  if (!org) return NextResponse.json({ error: "Startup not found." }, { status: 404 })

  const { error } = await svc.from("organizations").update({ logo_url: null, updated_at: new Date().toISOString() }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await removeStored(svc, org.logo_url as string | null)
  return NextResponse.json({ logo_url: null })
}
