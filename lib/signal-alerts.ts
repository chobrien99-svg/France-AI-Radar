// Subscriber alerts: once a day, each user who clicked "Set Alert" on a
// startup gets one email listing that startup's new signals (all their
// alerted startups in the same email). Run by /api/cron/signal-alerts.
//
// Rules:
// - only signals added to the site after the alert was set, in the last
//   LOOKBACK_DAYS (so a missed run catches up, but old ones never pile up);
// - only signals dated in the last MAX_SIGNAL_AGE_DAYS, so a historical
//   signal typed in by an editor today isn't announced as news;
// - only users whose plan includes alerts (Professional, Enterprise, a
//   running trial of those, or admins), and only startups on the Radar;
// - each signal is emailed to a user at most once (table alert_deliveries).
import type { SupabaseClient } from "@supabase/supabase-js"
import { SITE_URL, renderSimpleEmail, sendEmail } from "@/lib/email"
import { SIGNAL_TYPE_LABELS, canSetAlerts, hasActiveAccess } from "@/lib/subscription"

const DAY = 24 * 60 * 60 * 1000
export const LOOKBACK_DAYS = 7
export const MAX_SIGNAL_AGE_DAYS = 60
/** Signals listed in one email; the rest are counted ("…and 4 more"). */
const MAX_LINES = 30

type Row = Record<string, unknown>

type AlertUser = {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  is_admin: boolean | null
}

export type AlertSignal = {
  id: string
  organization_id: string
  signal_type: string
  signal_date: string | null
  title: string
  created_at: string
}

type Org = { id: string; name: string; slug: string }

/** Whether this user's plan includes alerts right now. */
export function canReceiveAlerts(user: AlertUser): boolean {
  if (!hasActiveAccess(user)) return false
  return !!user.is_admin || canSetAlerts(user.subscription_tier ?? "explorer")
}

const typeLabel = (t: string) => SIGNAL_TYPE_LABELS[t] ?? t.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** Builds the email for one user: signals grouped by startup, newest first. */
export function buildAlertEmail(user: Pick<AlertUser, "full_name">, signals: AlertSignal[], orgs: Map<string, Org>) {
  const byOrg = new Map<string, AlertSignal[]>()
  for (const s of signals) byOrg.set(s.organization_id, [...(byOrg.get(s.organization_id) ?? []), s])
  const groups = [...byOrg.entries()]
    .map(([orgId, list]) => ({
      org: orgs.get(orgId)!,
      list: list.sort((a, b) => (b.signal_date ?? b.created_at).localeCompare(a.signal_date ?? a.created_at)),
    }))
    .sort((a, b) => a.org.name.localeCompare(b.org.name))

  let room = MAX_LINES
  const sections = groups
    .map(({ org, list }) => {
      const shown = list.slice(0, Math.max(room, 0))
      room -= shown.length
      return {
        heading: org.name,
        url: `${SITE_URL}/startup/${org.slug}`,
        lines: shown.map((s) => `${typeLabel(s.signal_type)}${s.signal_date ? ` · ${shortDate(s.signal_date)}` : ""}: ${s.title}`),
      }
    })
    .filter((s) => s.lines.length > 0)
  const hidden = signals.length - Math.min(signals.length, MAX_LINES)

  const names = groups.map((g) => g.org.name)
  const subject =
    names.length === 1
      ? `${signals.length === 1 ? "New signal" : `${signals.length} new signals`} on ${names[0]}`
      : `New signals on ${names.length} startups you follow`

  const intro =
    signals.length === 1
      ? "There's a new signal on a startup you set an alert on:"
      : `There are ${signals.length} new signals on startups you set alerts on:`

  return {
    subject,
    ...renderSimpleEmail({
      name: user.full_name,
      paragraphs: [intro],
      sections,
      afterSections: hidden > 0 ? [`…and ${hidden} more on the site.`] : [],
      button: names.length === 1 ? { label: `Open ${names[0]}`, url: sections[0].url } : { label: "Open the database", url: `${SITE_URL}/database` },
      note: "You're receiving this because you set alerts on these startups. To stop, click \"Alert Set\" on a startup's page, or remove it under Account › Alerts.",
    }),
  }
}

/** Daily job: emails each eligible user the new signals on their alerted startups. */
export async function sendSignalAlerts(svc: SupabaseClient, now = new Date()) {
  const result = { users: 0, emails: 0, signals: 0, failed: 0 }

  const { data: alertRows, error: alertsError } = await svc
    .from("alerts")
    .select("user_id, organization_id, created_at")
    .eq("is_active", true)
  if (alertsError) throw new Error(`alerts: ${alertsError.message}`)
  const alerts = ((alertRows ?? []) as Row[]).filter((a) => a.organization_id)
  if (alerts.length === 0) return result

  const userIds = [...new Set(alerts.map((a) => a.user_id as string))]
  const [{ data: profiles, error: profilesError }, { data: radar, error: radarError }] = await Promise.all([
    svc
      .from("profiles")
      .select("id, email, full_name, subscription_tier, subscription_status, trial_ends_at, is_admin")
      .in("id", userIds),
    svc
      .from("product_organizations")
      .select("organization_id, product_catalog!inner(slug)")
      .eq("product_catalog.slug", "ai-radar"),
  ])
  if (profilesError) throw new Error(`profiles: ${profilesError.message}`)
  if (radarError) throw new Error(`product_organizations: ${radarError.message}`)

  const users = new Map(((profiles ?? []) as AlertUser[]).filter((u) => u.email && canReceiveAlerts(u)).map((u) => [u.id, u]))
  const radarIds = new Set(((radar ?? []) as Row[]).map((r) => r.organization_id as string))
  const live = alerts.filter((a) => users.has(a.user_id as string) && radarIds.has(a.organization_id as string))
  if (live.length === 0) return result

  const orgIds = [...new Set(live.map((a) => a.organization_id as string))]
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY).toISOString()
  const oldestDate = new Date(now.getTime() - MAX_SIGNAL_AGE_DAYS * DAY).toISOString().slice(0, 10)

  const { data: signalRows, error: signalsError } = await svc
    .from("signals")
    .select("id, organization_id, signal_type, signal_date, title, created_at")
    .in("organization_id", orgIds)
    .gte("created_at", since)
  if (signalsError) throw new Error(`signals: ${signalsError.message}`)
  const signals = ((signalRows ?? []) as AlertSignal[]).filter((s) => !s.signal_date || s.signal_date >= oldestDate)
  if (signals.length === 0) return result

  const { data: sentRows, error: sentError } = await svc
    .from("alert_deliveries")
    .select("user_id, signal_id")
    .in("signal_id", signals.map((s) => s.id))
  if (sentError) throw new Error(`alert_deliveries: ${sentError.message}`)
  const sent = new Set(((sentRows ?? []) as Row[]).map((r) => `${r.user_id}:${r.signal_id}`))

  // What each user should get: signals added after they set the alert, not yet sent.
  const due = new Map<string, Map<string, AlertSignal>>()
  for (const a of live) {
    const userId = a.user_id as string
    for (const s of signals) {
      if (s.organization_id !== a.organization_id) continue
      if (s.created_at <= (a.created_at as string)) continue
      if (sent.has(`${userId}:${s.id}`)) continue
      if (!due.has(userId)) due.set(userId, new Map())
      due.get(userId)!.set(s.id, s)
    }
  }
  if (due.size === 0) return result

  const { data: orgRows, error: orgsError } = await svc
    .from("organizations")
    .select("id, name, slug")
    .in("id", [...new Set([...due.values()].flatMap((m) => [...m.values()].map((s) => s.organization_id)))])
  if (orgsError) throw new Error(`organizations: ${orgsError.message}`)
  const orgs = new Map(((orgRows ?? []) as Org[]).map((o) => [o.id, o]))

  for (const [userId, bySignal] of due) {
    const user = users.get(userId)!
    const list = [...bySignal.values()].filter((s) => orgs.has(s.organization_id))
    if (list.length === 0) continue
    result.users++

    // Claim before sending, so an overlapping run can't send the same signal.
    const { data: claimed, error: claimError } = await svc
      .from("alert_deliveries")
      .upsert(
        list.map((s) => ({ user_id: userId, signal_id: s.id, organization_id: s.organization_id, sent_at: now.toISOString() })),
        { onConflict: "user_id,signal_id", ignoreDuplicates: true },
      )
      .select("signal_id")
    if (claimError) throw new Error(`alert_deliveries: ${claimError.message}`)
    const claimedIds = new Set(((claimed ?? []) as Row[]).map((r) => r.signal_id as string))
    const toSend = list.filter((s) => claimedIds.has(s.id))
    if (toSend.length === 0) continue

    const ok = await sendEmail({ to: user.email!, ...buildAlertEmail(user, toSend, orgs) })
    if (ok) {
      result.emails++
      result.signals += toSend.length
    } else {
      // Release the claim so tomorrow's run tries again.
      result.failed++
      await svc.from("alert_deliveries").delete().eq("user_id", userId).in("signal_id", toSend.map((s) => s.id))
    }
  }
  return result
}
