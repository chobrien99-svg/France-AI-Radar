// Guessing a new company's website from its names, as an editor would by
// typing "five-angels.com" into the browser. Search engines often don't
// list a site that went up last week, so the obvious addresses are tried
// directly (free, from our server) and the ones that answer are handed to
// the web research to open and confirm. A site that answers may still
// belong to someone else; the research decides.
import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

// Words that are rarely part of the domain: "ORAKLIA TECHNOLOGIES" → oraklia.
const GENERIC = /\b(SAS|SASU|SARL|EURL|SA|TECHNOLOGIES?|TECH|SOLUTIONS?|FRANCE|GROUPE?|LABS?|STUDIO|SYSTEMS?|SERVICES?|INNOVATIONS?|DIGITAL|AI|IA)\b/gi
const TLDS = ["com", "fr", "ai", "io"]
/** Domain-sale and parking pages: an address that lands there isn't the company's. */
const PARKED = /(^|\.)(sedo|sedoparking|afternic|dan|hugedomains|godaddy|parkingcrew|bodis|above|undeveloped|domainmarket|ovh)\.(com|net|fr)$/i
const MAX_GUESSES = 16
const MAX_REDIRECTS = 3

// Whoever registers a guessed domain controls where it points, so only
// public addresses are contacted: never this server, a private network or a
// cloud metadata endpoint. Every redirect is checked the same way.
const PRIVATE = new BlockList()
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) PRIVATE.addSubnet(net, bits, "ipv4")
// IPv4-mapped addresses (::ffff:10.0.0.5) are matched against the IPv4 rules above.
for (const [net, bits] of [["::", 127], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) PRIVATE.addSubnet(net, bits, "ipv6")

/** How host names are resolved (replaced in tests). */
export const dns = { resolve: async (host: string) => (await lookup(host, { all: true })).map((a) => a.address) }

async function isPublicHost(host: string): Promise<boolean> {
  if (isIP(host.replace(/^\[|\]$/g, ""))) return false   // a bare IP is never a company's site
  const addresses = await dns.resolve(host).catch(() => [] as string[])
  return addresses.length > 0 && addresses.every((a) => !PRIVATE.check(a, isIP(a) === 6 ? "ipv6" : "ipv4"))
}

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
  const answers = await Promise.all(guesses.map(async (guess) => {
    let url = guess
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const target = new URL(url)
        if ((target.protocol !== "https:" && target.protocol !== "http:") || target.port) return null   // web pages on the usual ports only
        if (PARKED.test(target.host)) return null
        if (!(await isPublicHost(target.hostname))) return null
        const res = await fetch(url, {
          redirect: "manual",
          headers: { "User-Agent": "FranceAIRadarBot/1.0 (+https://www.franceairadar.com)", Accept: "text/html" },
          signal: AbortSignal.timeout(5_000),
          cache: "no-store",
        })
        await res.body?.cancel().catch(() => {})
        const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null
        if (!next) return res.ok ? guess : null
        url = new URL(next, url).toString()
      }
      return null   // too many redirects
    } catch {
      return null   // no such domain, or it didn't answer in time
    }
  }))
  return answers.filter((u): u is string => Boolean(u)).slice(0, 3)
}
