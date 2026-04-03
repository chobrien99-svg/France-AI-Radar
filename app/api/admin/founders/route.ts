import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const supabase = await createServiceClient()

  // Generate a unique slug from the name
  const baseSlug = generateSlug(body.name)
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const { data: founder, error } = await supabase
    .from("people")
    .insert({
      full_name: body.name,
      slug,
      role: body.role || null,
      bio: body.bio || null,
      linkedin_url: body.linkedin_url || null,
      big_tech_employer: body.big_tech_employer || null,
      academic_lab: body.academic_lab || null,
      has_phd: !!body.has_phd,
      is_repeat_founder: !!body.is_repeat_founder,
      has_big_tech_background: !!body.has_big_tech_background,
      previous_exits: body.previous_exits?.length ?? 0,
    })
    .select("id, slug")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(founder, { status: 201 })
}
