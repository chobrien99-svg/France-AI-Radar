import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// Instantiated inside handler so missing env vars don't crash at build time
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  })
}

export async function GET(request: NextRequest) {
  // Map tier+interval to the Stripe price ID env var (evaluated at request time)
  const PRICE_ID_MAP: Record<string, string | undefined> = {
    explorer_monthly: process.env.STRIPE_PRICE_EXPLORER_MONTHLY,
    explorer_annual: process.env.STRIPE_PRICE_EXPLORER_ANNUAL,
    professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    professional_annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  }
  const { searchParams } = request.nextUrl
  const tier = searchParams.get("tier") ?? ""
  const interval = searchParams.get("interval") ?? "monthly"

  // Enterprise uses contact form, not Checkout
  if (tier === "enterprise") {
    return NextResponse.redirect(
      new URL("mailto:enterprise@frenchtech.journal", request.url)
    )
  }

  const priceKey = `${tier}_${interval}`
  const priceId = PRICE_ID_MAP[priceKey]

  if (!priceId || priceId.startsWith("price_...")) {
    return NextResponse.json(
      { error: `Price ID not configured for ${priceKey}. Set ${`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`} in your environment variables.` },
      { status: 400 }
    )
  }

  // Get authenticated user for prefill + metadata
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // User must be logged in to checkout — redirect to signup if not
  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth/signup?next=/api/stripe/checkout?tier=${tier}&interval=${interval}`, request.url)
    )
  }

  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email ?? undefined,
    allow_promotion_codes: true,
    metadata: {
      user_id: user.id,
      tier,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        tier,
      },
    },
    success_url: `${appUrl}/database?checkout=success`,
    cancel_url: `${appUrl}/pricing`,
  })

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create Stripe Checkout session" },
      { status: 500 }
    )
  }

  return NextResponse.redirect(session.url)
}
