import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  })
}

const TIER_PRICE_EUR: Record<string, number> = {
  explorer: 9,
  professional: 29,
  enterprise: 0,
}

async function logSubscriptionEvent(
  supabase: SupabaseClient,
  params: {
    userId: string
    eventType: string
    fromTier?: string | null
    toTier?: string | null
    stripeEventId: string
    metadata?: Record<string, unknown>
  }
) {
  if (!params.userId) return
  await supabase.from("subscription_events").insert({
    user_id: params.userId,
    event_type: params.eventType,
    from_tier: params.fromTier ?? null,
    to_tier: params.toTier ?? null,
    amount_eur: params.toTier ? TIER_PRICE_EUR[params.toTier] ?? null : null,
    stripe_event_id: params.stripeEventId,
    metadata: params.metadata ?? {},
  })
}

async function getCurrentTier(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single()
  return data?.subscription_tier ?? null
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id ?? ""
      const tier = session.metadata?.tier ?? "explorer"
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id ?? null
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null

      if (userId) {
        const fromTier = await getCurrentTier(supabase, userId)
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_tier: tier,
            subscription_status: "active",
          })
          .eq("id", userId)

        await logSubscriptionEvent(supabase, {
          userId,
          eventType: "subscription_activated",
          fromTier,
          toTier: tier,
          stripeEventId: event.id,
          metadata: { checkout_session_id: session.id },
        })
      }
      break
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id ?? ""
      const tier = sub.metadata?.tier ?? "explorer"

      if (userId) {
        const fromTier = await getCurrentTier(supabase, userId)
        await supabase
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_status: sub.status,
          })
          .eq("id", userId)

        if (fromTier !== tier) {
          await logSubscriptionEvent(supabase, {
            userId,
            eventType: "subscription_changed",
            fromTier,
            toTier: tier,
            stripeEventId: event.id,
            metadata: { status: sub.status },
          })
        }
      }
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id ?? ""

      if (userId) {
        const fromTier = await getCurrentTier(supabase, userId)
        await supabase
          .from("profiles")
          .update({
            subscription_tier: "explorer",
            subscription_status: "canceled",
          })
          .eq("id", userId)

        await logSubscriptionEvent(supabase, {
          userId,
          eventType: "subscription_canceled",
          fromTier,
          toTier: "explorer",
          stripeEventId: event.id,
        })
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer as Stripe.Customer | null)?.id ?? null

      if (customerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, subscription_tier")
          .eq("stripe_customer_id", customerId)
          .maybeSingle()

        await supabase
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId)

        if (profile?.id) {
          await logSubscriptionEvent(supabase, {
            userId: profile.id,
            eventType: "payment_failed",
            fromTier: profile.subscription_tier,
            toTier: profile.subscription_tier,
            stripeEventId: event.id,
          })
        }
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
