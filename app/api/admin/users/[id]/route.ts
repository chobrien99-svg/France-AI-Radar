import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { createClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_TIERS = ["explorer", "professional", "enterprise"]

/** Update a user's tier, admin status, subscription status, or free trial */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createServiceClient()

  const updateFields: Record<string, unknown> = {}

  if (body.subscription_tier && ALLOWED_TIERS.includes(body.subscription_tier)) {
    updateFields.subscription_tier = body.subscription_tier
  }

  if (typeof body.is_admin === "boolean") {
    updateFields.is_admin = body.is_admin
  }

  if (body.subscription_status) {
    updateFields.subscription_status = body.subscription_status
  }

  if (body.full_name !== undefined) {
    updateFields.full_name = body.full_name || null
  }

  // Free trial: { trial_days: n } starts (or extends) a trial ending n days
  // from now; { end_trial: true } ends it immediately. Both are guarded in the
  // update itself (below) so they can't race a Stripe webhook.
  let trialAction: "start" | "end" | null = null
  if (body.trial_days !== undefined) {
    const days = Number(body.trial_days)
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: "Trial length must be 1–365 days" }, { status: 400 })
    }
    trialAction = "start"
    updateFields.subscription_status = "trialing"
    updateFields.trial_ends_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  } else if (body.end_trial === true) {
    trialAction = "end"
    updateFields.subscription_status = "inactive"
    updateFields.trial_ends_at = null
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  updateFields.updated_at = new Date().toISOString()

  let query = supabase.from("profiles").update(updateFields).eq("id", id)
  if (trialAction === "start") {
    // Never put a live Stripe subscription (paid, Stripe trial or past due) on
    // an admin trial: it would replace the plan and then expire.
    query = query.or(
      "stripe_subscription_id.is.null,subscription_status.not.in.(active,trialing,past_due)"
    )
  } else if (trialAction === "end") {
    // Only admin trials (they have an end date); Stripe trials are managed in Stripe.
    query = query.eq("subscription_status", "trialing").not("trial_ends_at", "is", null)
  }

  const { data, error } = await query
    .select("id, email, subscription_tier, is_admin, subscription_status, trial_ends_at")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    if (trialAction) {
      return NextResponse.json(
        {
          error:
            trialAction === "start"
              ? "This user has a Stripe subscription; manage it in Stripe instead"
              : "This user isn't on an admin free trial",
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  return NextResponse.json(data)
}

/** Delete a user account entirely (auth.users + cascades to profiles) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const supabase = getAdminSupabase()

  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
