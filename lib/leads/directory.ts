// The free government company directory (recherche-entreprises.api.gouv.fr,
// INSEE + RNE data, no key). About 7 requests a second are allowed.
import { parseDirectory, type DirectoryFacts } from "@/lib/leads/parse"

const API = "https://recherche-entreprises.api.gouv.fr/search"

/** Facts for one SIREN, or null when the directory doesn't list it yet (very new companies). */
export async function fetchDirectory(siren: string): Promise<DirectoryFacts | null> {
  const res = await fetch(`${API}?${new URLSearchParams({ q: siren, per_page: "1" })}`, {
    headers: { Accept: "application/json", "User-Agent": "FranceAIRadarBot/1.0 (+https://www.franceairadar.com)" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (res.status === 429) throw new Error("company directory: too many requests (429)")
  if (!res.ok) throw new Error(`company directory: HTTP ${res.status}`)
  return parseDirectory(await res.json().catch(() => null), siren)
}
