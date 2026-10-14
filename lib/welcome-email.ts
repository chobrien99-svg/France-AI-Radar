import { createServiceClient } from "@/lib/supabase/server"
import { hasActiveAccess } from "@/lib/subscription"
import { SITE_URL, isEmailConfigured, renderSimpleEmail, sendEmail } from "@/lib/email"

type WelcomeUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

/**
 * Sends the "your account is ready, choose a plan" email once per account,
 * the first time a confirmed user signs in. Never throws: a failure here must
 * not break sign-in. Requires RESEND_API_KEY; WELCOME_EMAIL_FROM sets the sender.
 */
export async function sendWelcomeEmailOnce(user: WelcomeUser) {
  // Set once the send is claimed; any failure after that releases the claim
  // so the next sign-in retries.
  let releaseClaim: (() => Promise<unknown>) | null = null

  try {
    if (!user.email || !user.email_confirmed_at) return

    if (!isEmailConfigured()) {
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
      .select("full_name, subscription_status, trial_ends_at, is_admin")
      .maybeSingle()

    if (claimError) {
      console.error("[welcome-email] could not claim send:", claimError.message)
      return
    }
    // Already sent, or no profile row.
    if (!profile) return
    releaseClaim = async () =>
      supabase.from("profiles").update({ welcome_email_sent_at: null }).eq("id", user.id)
    // Admins, paying and trial accounts don't need the "choose a plan" email.
    if (hasActiveAccess(profile)) return

    const { html, text } = renderSimpleEmail({
      name: profile.full_name,
      paragraphs: [
        `Your AI Radar account for ${user.email} has been created.`,
        "To access the database of French AI startups, investors and signals, choose a plan:",
      ],
      button: { label: "Choose a plan", url: `${SITE_URL}/pricing` },
      note: "If you didn't create this account, you can ignore this email.",
    })
    const ok = await sendEmail({ to: user.email, subject: "Your AI Radar account is ready", html, text })
    if (!ok) await releaseClaim()
  } catch (err) {
    // e.g. a network error reaching Resend after the claim was taken.
    console.error("[welcome-email] failed:", err)
    if (releaseClaim) await releaseClaim().catch(() => {})
  }
}
