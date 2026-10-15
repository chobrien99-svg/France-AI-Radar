import { createServiceClient } from "@/lib/supabase/server"
import { SITE_URL, formatEmailDate, renderSimpleEmail, sendEmail } from "@/lib/email"

const TIER_LABEL: Record<string, string> = {
  explorer: "Explorer",
  professional: "Professional",
  enterprise: "Enterprise",
}

type TrialUser = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: string | null
  trial_ends_at: string | null
}

const DAY = 24 * 60 * 60 * 1000
/** Send the "ends soon" reminder when this close to the end. */
const REMINDER_WINDOW_MS = 3 * DAY
/** Don't email about trials that ended longer ago than this (e.g. a missed run). */
const ENDED_LOOKBACK_MS = 7 * DAY

function plan(user: TrialUser) {
  return TIER_LABEL[user.subscription_tier ?? ""] ?? "AI Radar"
}

function startedEmail(user: TrialUser) {
  const ends = formatEmailDate(user.trial_ends_at!)
  return {
    subject: "Your free AI Radar trial has started",
    ...renderSimpleEmail({
    name: user.full_name,
    paragraphs: [
      `You've been given free access to AI Radar ${plan(user)} until ${ends}.`,
      "Explore French AI startups, their founders, investors and the latest signals in the database.",
    ],
    button: { label: "Open the database", url: `${SITE_URL}/database` },
    note: `Sign in with ${user.email}. Your access ends automatically on ${ends}; you won't be charged.`,
    }),
  }
}

function reminderEmail(user: TrialUser) {
  const ends = formatEmailDate(user.trial_ends_at!)
  return {
    subject: "Your AI Radar trial ends soon",
    ...renderSimpleEmail({
      name: user.full_name,
      paragraphs: [
        `Your free AI Radar ${plan(user)} trial ends on ${ends}.`,
        "To keep access to the database after that, choose a plan.",
      ],
      button: { label: "Choose a plan", url: `${SITE_URL}/pricing` },
    }),
  }
}

function endedEmail(user: TrialUser) {
  const ended = formatEmailDate(user.trial_ends_at!)
  return {
    subject: "Your AI Radar trial has ended",
    ...renderSimpleEmail({
      name: user.full_name,
      paragraphs: [
        `Your free AI Radar ${plan(user)} trial ended on ${ended}. We hope you found it useful.`,
        "Choose a plan to get back into the database, investor briefs and alerts.",
      ],
      button: { label: "Choose a plan", url: `${SITE_URL}/pricing` },
    }),
  }
}

type Column = "trial_started_email_sent_at" | "trial_reminder_sent_at" | "trial_ended_email_sent_at"

/**
 * Claims each row (sets `column` where it is still NULL) before sending, so
 * overlapping runs can't double-send, and releases the claim if sending fails.
 */
async function sendBatch(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  users: TrialUser[],
  column: Column,
  build: (u: TrialUser) => { subject: string; html: string; text: string }
) {
  let sent = 0
  for (const user of users) {
    if (!user.email) continue
    const { data: claimed } = await supabase
      .from("profiles")
      .update({ [column]: new Date().toISOString() })
      .eq("id", user.id)
      .is(column, null)
      // Still the same trial we selected (not subscribed, ended or restarted since).
      .eq("subscription_status", "trialing")
      .eq("trial_ends_at", user.trial_ends_at!)
      .select("id")
      .maybeSingle()
    if (!claimed) continue

    const ok = await sendEmail({ to: user.email, ...build(user) })
    if (ok) sent++
    else await supabase.from("profiles").update({ [column]: null }).eq("id", user.id)
  }
  return sent
}

/**
 * "Your free trial has started": sent right after an admin starts or extends a
 * trial. If it fails, the daily job retries it (see sendDueTrialEmails).
 */
export async function sendTrialStartedEmail(user: TrialUser) {
  if (!user.email || !user.trial_ends_at) return 0
  const supabase = await createServiceClient()
  return sendBatch(supabase, [user], "trial_started_email_sent_at", startedEmail)
}

/** Daily job: retried "started" emails, "ends soon" reminders and "has ended" emails. */
export async function sendDueTrialEmails(now = new Date()) {
  const supabase = await createServiceClient()
  const fields = "id, email, full_name, subscription_tier, trial_ends_at"
  const nowIso = now.toISOString()

  const { data: notStarted, error: e0 } = await supabase
    .from("profiles")
    .select(fields)
    .eq("subscription_status", "trialing")
    .gt("trial_ends_at", nowIso)
    .is("trial_started_email_sent_at", null)

  const { data: endingSoon, error: e1 } = await supabase
    .from("profiles")
    .select(fields)
    .eq("subscription_status", "trialing")
    .gt("trial_ends_at", nowIso)
    .lte("trial_ends_at", new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString())
    .is("trial_reminder_sent_at", null)

  const { data: ended, error: e2 } = await supabase
    .from("profiles")
    .select(fields)
    .eq("subscription_status", "trialing")
    .lte("trial_ends_at", nowIso)
    .gt("trial_ends_at", new Date(now.getTime() - ENDED_LOOKBACK_MS).toISOString())
    .is("trial_ended_email_sent_at", null)

  if (e0 || e1 || e2) throw new Error((e0 ?? e1 ?? e2)!.message)

  const started = await sendBatch(supabase, notStarted ?? [], "trial_started_email_sent_at", startedEmail)
  const reminders = await sendBatch(supabase, endingSoon ?? [], "trial_reminder_sent_at", reminderEmail)
  const endedSent = await sendBatch(supabase, ended ?? [], "trial_ended_email_sent_at", endedEmail)
  return { started, reminders, ended: endedSent }
}
