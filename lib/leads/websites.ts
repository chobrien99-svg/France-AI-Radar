// Guessing a new company's website from its names, as an editor would by
// typing "five-angels.com" into the browser. Search engines often don't
// list a site that went up last week, so the obvious addresses are tried
// directly (free, from our server) and the ones that answer are handed to
// the web research to open and confirm. A site that answers may still
// belong to someone else; the research decides.

// Words that are rarely part of the domain: "ORAKLIA TECHNOLOGIES" → oraklia.
const GENERIC = /\b(SAS|SASU|SARL|EURL|SA|TECHNOLOGIES?|TECH|SOLUTIONS?|FRANCE|GROUPE?|LABS?|STUDIO|SYSTEMS?|SERVICES?|INNOVATIONS?|DIGITAL|AI|IA)\b/gi
const TLDS = ["com", "fr", "ai", "io"]
/** Domain-sale and parking pages: an address that lands there isn't the company's. */
const PARKED = /(^|\.)(sedo|sedoparking|afternic|dan|hugedomains|godaddy|parkingcrew|bodis|above|undeveloped|domainmarket|ovh)\.(com|net|fr)$/i
const MAX_GUESSES = 16

function slugs(name: string): string[] {
  const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[&+]/g, " ").replace(/['’.]/g, "")
  const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const core = words(plain.replace(GENERIC, " "))
  const all = words(plain)
  // "five-angels" and "fiveangels"; for a legal name, also the full "oraklia-technologies".
  return [core.join("-"), core.join(""), all.join("-")].filter((s) => s.replace(/-/g, "").length >= 3)
}

/** The addresses to try, brand first: five-angels.com, fiveangels.com, five-angels.fr… */
export function siteGuesses(names: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  for (const name of names) for (const slug of name ? slugs(name) : []) for (const tld of TLDS) seen.add(`https://${slug}.${tld}/`)
  return [...seen].slice(0, MAX_GUESSES)
}

/** The guessed addresses that answer with a page (at most 3), tried in parallel. */
export async function findWebsites(names: (string | null | undefined)[]): Promise<string[]> {
  const guesses = siteGuesses(names)
  const answers = await Promise.all(guesses.map(async (url) => {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "FranceAIRadarBot/1.0 (+https://www.franceairadar.com)", Accept: "text/html" },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      })
      await res.body?.cancel().catch(() => {})
      if (!res.ok) return null
      const landed = new URL(res.url || url)
      return PARKED.test(landed.host) ? null : url
    } catch {
      return null   // no such domain, or it didn't answer in time
    }
  }))
  return answers.filter((u): u is string => Boolean(u)).slice(0, 3)
}
