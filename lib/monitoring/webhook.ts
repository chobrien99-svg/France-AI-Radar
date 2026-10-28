// Receiving a Pappers webhook message: check the token, check the body, store
// it in monitoring_inbox. The nightly run reads it later (run.ts).
import { createHash, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const MAX_WEBHOOK_BYTES = 1_000_000

/** Same-length digests, so the comparison takes the same time whatever the guess. */
const digest = (s: string) => createHash("sha256").update(s).digest()

export async function receivePappersWebhook(
  svc: SupabaseClient,
  token: string | null,
  raw: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = process.env.PAPPERS_WEBHOOK_SECRET
  if (!secret) return { status: 503, body: { error: "Not configured" } }
  if (!timingSafeEqual(digest(token ?? ""), digest(secret))) return { status: 401, body: { error: "Unauthorized" } }
  if (raw.length > MAX_WEBHOOK_BYTES) return { status: 413, body: { error: "Too large" } }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return { status: 400, body: { error: "Body must be JSON" } }
  }
  const p = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null
  const evenement = typeof p?.evenement === "string" ? p.evenement.slice(0, 100) : null
  if (!p || !evenement) return { status: 400, body: { error: "Missing evenement" } }
  const donnees = p.donnees && typeof p.donnees === "object" ? (p.donnees as Record<string, unknown>) : {}
  const listId = typeof donnees.id_list === "string" || typeof donnees.id_list === "number" ? String(donnees.id_list).slice(0, 100) : null

  const { error } = await svc.from("monitoring_inbox").insert({ evenement, list_id: listId, payload: p })
  if (error) {
    console.error("[webhooks/pappers] could not store:", error.message)
    return { status: 500, body: { error: "Could not store" } }
  }
  return { status: 200, body: { ok: true } }
}
