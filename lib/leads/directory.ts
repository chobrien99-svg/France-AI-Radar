// The free government company directory (recherche-entreprises.api.gouv.fr,
// INSEE + RNE data, no key). About 7 requests a second are allowed.
import { parseDirectory, peopleOf, type DirectoryFacts } from "@/lib/leads/parse"

const API = "https://recherche-entreprises.api.gouv.fr/search"

/** Facts for one SIREN, or null when the directory doesn't list it yet (very new companies). */
export async function fetchDirectory(siren: string): Promise<DirectoryFacts | null> {
  // The service often drops connections; a couple of retries usually get through.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1000 * attempt))
    let res: Response
    try {
      res = await fetch(`${API}?${new URLSearchParams({ q: siren, per_page: "1" })}`, {
        headers: { Accept: "application/json", "User-Agent": "FranceAIRadarBot/1.0 (+https://www.franceairadar.com)" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      })
    } catch (err) {
      lastError = err
      continue
    }
    if (res.status === 429) throw new Error("company directory: too many requests (429)")
    if (res.status >= 500) {
      lastError = new Error(`company directory: HTTP ${res.status}`)
      continue
    }
    if (!res.ok) throw new Error(`company directory: HTTP ${res.status}`)
    return parseDirectory(await res.json().catch(() => null), siren)
  }
  throw lastError instanceof Error && lastError.message.startsWith("company directory") ? lastError : new Error("company directory: no answer")
}

/** Holding companies among the officers → the people behind them (at most 4 lookups). */
export async function resolveHoldings(facts: DirectoryFacts): Promise<void> {
  for (const d of facts.directors.filter((x) => x.isCompany && x.siren).slice(0, 4)) {
    try {
      d.people = peopleOf(await fetchDirectory(d.siren!))
    } catch {
      // Not essential: the research still has the holding's name.
    }
  }
}
