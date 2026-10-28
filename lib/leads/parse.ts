// ------------------------------------------------------------------
// Companies to vet (company_leads): reading the free government company
// directory, and the first-pass score. Pure functions, no network.
//
// The score only ranks the list; nothing is decided automatically.
// Red flags chosen by the editors: a consulting / IT-services / training
// activity code, and consultancy words in the name. A solo founder or a
// domiciliation address are shown as facts, not counted against.
// ------------------------------------------------------------------

export type Director = { name: string; role: string | null; isCompany: boolean }

export type DirectoryFacts = {
  name: string | null
  nafCode: string | null
  nafLabel: string | null
  legalForm: string | null
  createdOn: string | null   // YYYY-MM-DD
  city: string | null
  employer: boolean | null
  directors: Director[]
  closed: boolean
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase())

// INSEE legal-form codes seen among new companies.
const LEGAL_FORMS: Record<string, string> = {
  "5710": "SAS",
  "5720": "SASU (single shareholder)",
  "5499": "SARL",
  "5498": "EURL (single shareholder)",
  "5599": "SA",
  "1000": "Sole trader",
  "6540": "SCI",
}

// NAF codes that matter for the score, with a readable label.
const NAF_LABELS: Record<string, string> = {
  "58.29A": "System and network software publishing",
  "58.29B": "Development tools software publishing",
  "58.29C": "Applications software publishing",
  "62.01Z": "Computer programming",
  "62.02A": "IT consulting",
  "62.02B": "Third-party IT maintenance",
  "62.03Z": "Computer facilities management",
  "62.09Z": "Other IT services",
  "63.11Z": "Data processing and hosting",
  "63.12Z": "Web portals",
  "70.21Z": "Public relations and communication",
  "70.22Z": "Business and management consulting",
  "72.11Z": "Biotechnology research",
  "72.19Z": "Research in natural sciences and engineering",
  "73.11Z": "Advertising agency",
  "74.90B": "Various specialised activities",
  "85.59A": "Continuing adult training",
  "85.59B": "Other education",
  "64.20Z": "Holding company",
}

const CONSULTING_NAF = [/^70\.2/, /^62\.0[239]/, /^74\.90/, /^85\.5/, /^73\.1/, /^64\.20/]
const PRODUCT_NAF = [/^62\.01/, /^58\.2/, /^72\.1/, /^63\.1/]
const CONSULTING_WORDS = /\b(CONSULTING|CONSULTANTS?|CONSEILS?|PARTNERS|FORMATIONS?|HOLDING|INVEST(?:ISSEMENTS?|MENTS?)?|GROUP|GROUPE|ADVISORY)\b/i

/** /search?q=<siren> reply → facts for that SIREN, or null when it isn't listed. */
export function parseDirectory(body: unknown, siren: string): DirectoryFacts | null {
  const results = body && typeof body === "object" ? (body as { results?: unknown }).results : null
  if (!Array.isArray(results)) return null
  const r = (results as Record<string, unknown>[]).find((x) => String(x?.siren ?? "") === siren)
  if (!r) return null
  const siege = (r.siege && typeof r.siege === "object" ? r.siege : {}) as Record<string, unknown>
  const naf = str(r.activite_principale) ?? str(siege.activite_principale)
  const employerFlag = r.caractere_employeur ?? siege.caractere_employeur
  const employer = employerFlag === "O" ? true : employerFlag === "N" ? false : null
  const directors: Director[] = (Array.isArray(r.dirigeants) ? (r.dirigeants as Record<string, unknown>[]) : []).flatMap((d) => {
    const isCompany = d.type_dirigeant === "personne morale"
    const name = isCompany
      ? str(d.denomination)
      : [str(d.prenoms)?.split(/\s+/)[0], str(d.nom)].filter(Boolean).map((s) => titleCase(s!)).join(" ") || null
    return name ? [{ name, role: str(d.qualite), isCompany }] : []
  })
  const legal = str(r.nature_juridique)
  return {
    name: str(r.nom_complet) ?? str(r.nom_raison_sociale),
    nafCode: naf,
    nafLabel: naf ? NAF_LABELS[naf] ?? null : null,
    legalForm: legal ? LEGAL_FORMS[legal] ?? `Legal form ${legal}` : null,
    createdOn: typeof r.date_creation === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date_creation) ? r.date_creation : null,
    city: str(siege.libelle_commune),
    employer,
    directors,
    closed: r.etat_administratif === "C" || Boolean(str(r.date_fermeture)),
  }
}

export type LeadScore = { score: number; reasons: string[] }

/**
 * 50 to start, clamped to 0-100. Each rule that fires adds a reason in plain
 * words, so an editor can see why a company is high or low on the list.
 */
export function scoreLead(name: string | null, facts: DirectoryFacts | null): LeadScore {
  let score = 50
  const reasons: string[] = []
  const add = (points: number, why: string) => {
    score += points
    reasons.push(`${points > 0 ? "+" : ""}${points} ${why}`)
  }
  const naf = facts?.nafCode ?? null
  if (naf && CONSULTING_NAF.some((re) => re.test(naf))) add(-30, `consulting, IT-services or training activity (${naf}${facts?.nafLabel ? ` ${facts.nafLabel}` : ""})`)
  else if (naf && PRODUCT_NAF.some((re) => re.test(naf))) add(20, `software or R&D activity (${naf}${facts?.nafLabel ? ` ${facts.nafLabel}` : ""})`)
  const word = (name ?? facts?.name ?? "").match(CONSULTING_WORDS)
  if (word) add(-20, `"${word[0].toUpperCase()}" in the name`)
  // Founders often hold their shares through a personal holding company, so
  // "X HOLDING" officers count as co-founders; other companies suggest a
  // studio, a parent company or an investor.
  const officers = facts?.directors ?? []
  const backers = officers.filter((d) => d.isCompany && !/\bHOLDING\b/i.test(d.name))
  if (officers.length >= 2) add(10, `${officers.length} officers (people or their holding companies)`)
  if (backers.length) add(10, `a company among its officers (${backers.map((d) => d.name).join(", ")}): studio, parent company or investor`)
  if (facts?.closed) add(-50, "already closed")
  return { score: Math.max(0, Math.min(100, score)), reasons }
}
