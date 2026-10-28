// Morning email to admins listing the drafts a monitoring run queued, and
// how many new companies a Pappers saved search added to the "to vet" list.
import type { SupabaseClient } from "@supabase/supabase-js"
import { SITE_URL, isEmailConfigured, renderSimpleEmail, sendEmail } from "@/lib/email"

const MAX_LINES = 25

const typeLabel = (t: string) => t.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")

export async function sendMonitoringDigest(svc: SupabaseClient, candidateIds: string[], leadsAdded = 0): Promise<{ sent: number }> {
  if ((candidateIds.length === 0 && leadsAdded === 0) || !isEmailConfigured()) return { sent: 0 }

  const [{ data: rows }, { data: admins }] = await Promise.all([
    candidateIds.length === 0 ? Promise.resolve({ data: [] }) : svc.from("signal_candidates")
      .select("signal_type, title, source, source_name, confidence, possible_duplicate_signal_id, organizations(name)")
      .in("id", candidateIds)
      .order("confidence", { ascending: false }),
    svc.from("profiles").select("email, full_name").eq("is_admin", true),
  ])

  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as { name: string } | null
    const pct = typeof r.confidence === "number" ? `${Math.round(r.confidence * 100)}%` : "?"
    const dup = r.possible_duplicate_signal_id ? ", possible duplicate" : ""
    return `${org?.name ?? "Unknown startup"} · ${typeLabel(String(r.signal_type))}: ${r.title} (${r.source_name ?? r.source}, confidence ${pct}${dup})`
  })
  const shown = lines.slice(0, MAX_LINES)
  if (lines.length > MAX_LINES) shown.push(`…and ${lines.length - MAX_LINES} more.`)

  const count = lines.length
  const leadsLine = leadsAdded > 0
    ? `${leadsAdded} new compan${leadsAdded === 1 ? "y" : "ies"} from your Pappers alerts to vet for the Radar: ${SITE_URL}/admin/leads`
    : null
  const subject = count > 0
    ? `${count} new signal${count === 1 ? "" : "s"} to review on the AI Radar`
    : `${leadsAdded} new compan${leadsAdded === 1 ? "y" : "ies"} to vet for the AI Radar`
  let sent = 0
  for (const admin of (admins ?? []) as { email: string | null; full_name: string | null }[]) {
    if (!admin.email) continue
    const { html, text } = renderSimpleEmail({
      name: admin.full_name,
      paragraphs: [
        ...(count > 0 ? [`Last night's check found ${count} possible new signal${count === 1 ? "" : "s"} for Radar startups:`, ...shown] : []),
        ...(leadsLine ? [leadsLine] : []),
      ],
      button: count > 0 ? { label: "Review drafts", url: `${SITE_URL}/admin/signals` } : { label: "Companies to vet", url: `${SITE_URL}/admin/leads` },
      note: "Nothing is published until an admin approves it.",
    })
    if (await sendEmail({ to: admin.email, subject, html, text })) sent++
  }
  return { sent }
}
