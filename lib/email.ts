// Transactional email via the Resend API. Requires RESEND_API_KEY;
// WELCOME_EMAIL_FROM sets the sender for all site emails.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.franceairadar.com"

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

export function firstName(fullName: string | null | undefined) {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? ""
}

/** "11 November 2026" */
export function formatEmailDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

type SimpleEmail = {
  name?: string | null
  /** Plain-text paragraphs (escaped for HTML here). */
  paragraphs: string[]
  button: { label: string; url: string }
  /** Small print under the button. */
  note?: string
}

/** Renders the site's simple house-style email as HTML and plain text. */
export function renderSimpleEmail({ name, paragraphs, button, note }: SimpleEmail) {
  const first = firstName(name)
  const greeting = first ? `Hi ${first},` : "Hi,"
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px">
  <p>${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `  <p>${escapeHtml(p)}</p>`).join("\n")}
  <p><a href="${button.url}" style="display:inline-block;background:#114563;color:#ffffff;text-decoration:none;padding:10px 20px;font-weight:bold">${escapeHtml(button.label)}</a></p>
${note ? `  <p style="color:#666;font-size:13px">${escapeHtml(note)}</p>\n` : ""}  <p>The AI Radar team<br>French Tech Journal</p>
</div>`
  const text = [greeting, ...paragraphs, `${button.label}: ${button.url}`, ...(note ? [note] : []), "The AI Radar team\nFrench Tech Journal"].join("\n\n")
  return { html, text }
}

/** Sends one email. Never throws; returns whether Resend accepted it. */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not set; skipping:", message.subject)
    return false
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: process.env.WELCOME_EMAIL_FROM || "AI Radar <noreply@franceairadar.com>",
        ...message,
      }),
    })
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[email] send failed:", err)
    return false
  }
}
