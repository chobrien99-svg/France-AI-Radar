// ------------------------------------------------------------------
// Name matching for signal monitoring: does a headline or excerpt
// mention a given startup? Whole-word, accent- and case-insensitive,
// with per-startup aliases and exclude words (monitoring_state).
//
// Kept free of "@/..." imports so `npm test` can run it with plain Node.
// ------------------------------------------------------------------

export type MatchTarget = {
  name: string
  aliases: string[]
  excludeTerms: string[]
}

/** Lowercase, strip accents, turn every non letter/digit run into one space. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Legal-form suffixes that rarely appear in press copy ("Jemba SAS" → "Jemba").
const LEGAL_SUFFIXES = new Set(["sas", "sasu", "sa", "sarl", "eurl", "sci", "inc", "ltd", "gmbh", "bv"])

/** The phrases to look for: the name (without a legal-form suffix) plus aliases. */
export function searchTerms(target: MatchTarget): string[] {
  const out = new Set<string>()
  for (const raw of [target.name, ...target.aliases]) {
    const words = normalizeText(raw).split(" ").filter(Boolean)
    while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop()
    const phrase = words.join(" ")
    // Single letters or two-character names would match everywhere.
    if (phrase.replace(/ /g, "").length >= 3) out.add(phrase)
  }
  return [...out]
}

/** True when any search term appears as whole words and no exclude word does. */
export function mentions(text: string, target: MatchTarget): boolean {
  const hay = ` ${normalizeText(text)} `
  if (!searchTerms(target).some((t) => hay.includes(` ${t} `))) return false
  return !target.excludeTerms.some((x) => {
    const n = normalizeText(x)
    return n.length > 0 && hay.includes(` ${n} `)
  })
}
