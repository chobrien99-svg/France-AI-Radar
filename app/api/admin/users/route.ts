import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_TIERS = ["explorer", "professional", "enterprise"]

/** Create a new user account (invites them via email) */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { email, full_name, tier, send_invite } = body

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const supabase = getAdminSupabase()
  const selectedTier = ALLOWED_TIERS.includes(tier) ? tier : "explorer"

  // Create user via Supabase Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: !send_invite,
    user_metadata: { full_name: full_name || "" },
    ...(send_invite ? {} : { password: crypto.randomUUID() }),
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const userId = authData.user.id

  // Update the profile with the selected tier (trigger should have created it)
  await supabase
    .from("profiles")
    .update({
      subscription_tier: selectedTier,
      subscription_status: "active",
      full_name: full_name || null,
    })
    .eq("id", userId)

  // If send_invite, generate a password reset link they can use to set their password
  let inviteLink: string | null = null
  if (send_invite) {
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://france-ai-radar.vercel.app"}/auth/callback`,
      },
    })
    inviteLink = linkData?.properties?.action_link ?? null
  }

  return NextResponse.json({
    id: userId,
    email,
    tier: selectedTier,
    invite_link: inviteLink,
  }, { status: 201 })
}
