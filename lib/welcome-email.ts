import { createServiceClient } from "@/lib/supabase/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.franceairadar.com"

type WelcomeUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

/**
 * Sends the "your account is ready, choose a plan" email once per account,
 * the first time a confirmed user signs in. Never throws: a failure here must
 * not break sign-in. Requires RESEND_API_KEY; WELCOME_EMAIL_FROM sets the sender.
 */
export async function sendWelcomeEmailOnce(user: WelcomeUser) {
  try {
    if (!user.email || !user.email_confirmed_at) return

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("[welcome-email] RESEND_API_KEY is not set; skipping")
      return
    }

    const supabase = await createServiceClient()

    // Claim the send atomically so concurrent sign-ins can't send it twice.
    const { data: profile, error: claimError } = await supabase
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("welcome_email_sent_at", null)
      .select("full_name, subscription_status, is_admin")
      .maybeSingle()

    if (claimError) {
      console.error("[welcome-email] could not claim send:", claimError.message)
      return
    }
    // Already sent, or no profile row.
    if (!profile) return
    // Admin-created and already-paying accounts don't need the "choose a plan" email.
    if (profile.is_admin || profile.subscription_status === "active") return

    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0]
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
    const pricingUrl = `${SITE_URL}/pricing`

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.WELCOME_EMAIL_FROM || "AI Radar <noreply@franceairadar.com>",
        to: user.email,
        subject: "Your AI Radar account is ready",
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px">
  <p>${greeting}</p>
  <p>Your AI Radar account for <strong>${escapeHtml(user.email)}</strong> has been created.</p>
  <p>To access the database of French AI startups, investors and signals, choose a plan:</p>
  <p><a href="${pricingUrl}" style="display:inline-block;background:#114563;color:#ffffff;text-decoration:none;padding:10px 20px;font-weight:bold">Choose a plan</a></p>
  <p style="color:#666;font-size:13px">If you didn't create this account, you can ignore this email.</p>
  <p>The AI Radar team<br>French Tech Journal</p>
</div>`,
        text: `${firstName ? `Hi ${firstName},` : "Hi,"}

Your AI Radar account for ${user.email} has been created.

To access the database of French AI startups, investors and signals, choose a plan:
${pricingUrl}

If you didn't create this account, you can ignore this email.

The AI Radar team
French Tech Journal`,
      }),
    })

    if (!res.ok) {
      console.error("[welcome-email] Resend error", res.status, await res.text())
      // Release the claim so the next sign-in retries.
      await supabase.from("profiles").update({ welcome_email_sent_at: null }).eq("id", user.id)
    }
  } catch (err) {
    console.error("[welcome-email] failed:", err)
  }
}
