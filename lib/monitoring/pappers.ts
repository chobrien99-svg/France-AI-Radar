// Pappers API v2 (api.pappers.fr), a paid register-data service.
// Pay-as-you-go: each call costs credits (a company record is 1 credit),
// so calls are kept few: a search only when an admin asks for one, and one
// company record per startup every PAPPERS_INTERVAL_DAYS (see run.ts).
// The key is sent in the api-key header, never in the URL, so it can't end
// up in logs.
import { normalizeSiren, parsePappersSearch, type PappersMatch } from "@/lib/monitoring/parse"

const API = "https://api.pappers.fr/v2"

export function pappersConfigured(): boolean {
  return Boolean(process.env.PAPPERS_API_KEY)
}

/** Days between two company-record checks of the same startup; 0 switches the nightly check off. */
export function pappersIntervalDays(): number {
  const n = Number(process.env.PAPPERS_INTERVAL_DAYS)
  return Number.isFinite(n) && n >= 0 && process.env.PAPPERS_INTERVAL_DAYS?.trim() ? n : 14
}

/** An error after which further calls this run are pointless (bad key, no credits). */
export class PappersAccountError extends Error {}

async function call(path: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { "api-key": process.env.PAPPERS_API_KEY ?? "", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (res.status === 401) throw new PappersAccountError("Pappers: the API key was refused (401); check PAPPERS_API_KEY")
  if (res.status === 402 || res.status === 403) throw new PappersAccountError(`Pappers: no credits left or access denied (${res.status})`)
  if (res.status === 404) throw new Error("Pappers: company not found (404)")
  if (res.status === 429) throw new PappersAccountError("Pappers: too many requests (429)")
  if (!res.ok) throw new Error(`Pappers: HTTP ${res.status}`)
  try {
    return await res.json()
  } catch {
    throw new Error("Pappers: reply was not JSON")
  }
}

/** Companies matching a name, best first (up to 5). */
export async function searchCompanies(name: string): Promise<PappersMatch[]> {
  const body = await call("/recherche", { q: name, par_page: "5", page: "1" })
  if (!body || typeof body !== "object" || !Array.isArray((body as { resultats?: unknown }).resultats)) {
    throw new Error("Pappers: unexpected search reply")
  }
  return parsePappersSearch(body)
}

/** The full company record (1 credit). */
export async function getCompany(sirenRaw: string): Promise<unknown> {
  const siren = normalizeSiren(sirenRaw)
  if (!siren) throw new Error("Pappers: not a 9-digit SIREN")
  const body = await call("/entreprise", { siren })
  if (!body || typeof body !== "object" || !("siren" in body)) throw new Error("Pappers: unexpected company reply")
  return body
}

/** The surveillance list the Radar's startups are added to (its ID is shown in the Pappers account). */
export function pappersWatchListId(): string | null {
  return process.env.PAPPERS_WATCH_LIST_ID?.trim() || null
}

// The published docs cut the path off; the first is what other clients use.
// The others are only tried when Pappers says the route itself doesn't exist.
const WATCH_PATHS = ["/surveillance/entreprise", "/surveillance/liste/entreprise", "/surveillance/entreprise/liste"]

/**
 * Adds companies to a surveillance list (included in the subscription, no
 * credits). Returns how many were new to the list.
 */
export async function addToWatchList(listId: string, sirens: string[]): Promise<number> {
  const body = JSON.stringify(sirens.map((siren) => ({ siren })))
  let lastError = ""
  for (const path of WATCH_PATHS) {
    const res = await fetch(`${API}${path}?${new URLSearchParams({ id_liste: listId })}`, {
      method: "POST",
      headers: { "api-key": process.env.PAPPERS_API_KEY ?? "", "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
    const reply = (await res.json().catch(() => ({}))) as { notifications_ajoutees?: unknown; message?: unknown }
    const message = typeof reply.message === "string" ? reply.message.slice(0, 200) : ""
    if (res.ok) return typeof reply.notifications_ajoutees === "number" ? reply.notifications_ajoutees : 0
    if (res.status === 401) throw new PappersAccountError("Pappers: the API key was refused (401); check PAPPERS_API_KEY")
    if (res.status === 403) throw new PappersAccountError(`Pappers watch list: plan limit reached (403)${message ? `: ${message}` : ""}`)
    lastError = `Pappers watch list: HTTP ${res.status}${message ? `: ${message}` : ""}`
    // Only an unknown route is worth another path; "Liste non trouvée" means a wrong list ID.
    if (res.status !== 404 || !/^route /i.test(message)) break
  }
  throw new PappersAccountError(lastError)
}
