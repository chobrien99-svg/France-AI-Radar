import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

// Map tier+interval to the Stripe price ID env var
const PRICE_ID_MAP: Record<string, string | undefined> = {
  explorer_monthly: process.env.STRIPE_PRICE_EXPLORER_MONTHLY,
  explorer_annual: process.env.STRIPE_PRICE_EXPLORER_ANNUAL,
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
  professional_annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
}

export async function GET(request: NextRequest) {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(user?.email ? { customer_email: user.email } : {}),
    // Store on both session and subscription so webhook handlers can read them
    metadata: {
      user_id: user?.id ?? "",
      tier,
    },
    subscription_data: {
      metadata: {
        user_id: user?.id ?? "",
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
