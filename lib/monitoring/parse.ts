// ------------------------------------------------------------------
// Parsers for signal monitoring sources. Each turns a raw response into
// FoundItems; nothing here touches the network or the database.
//   - parseFeed: RSS 2.0 or Atom (press feeds, Google News)
//   - parseBodacc: BODACC open-data API records (official filings)
//   - parsePappersSearch / parsePappersCompany: Pappers API v2 replies
//
// Kept free of "@/..." imports so `npm test` can run it with plain Node.
// ------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser"

export type Source = "bodacc" | "press_rss" | "google_news" | "pappers"

export type FoundItem = {
  source: Source
  url: string
  title: string
  excerpt: string | null
  publishedAt: string | null   // ISO timestamp
  sourceName: string | null
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
})

const asArray = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

/** Text content of a parsed node, whether it came back as a string or {#text}. */
function text(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string" || typeof v === "number") return String(v)
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"] ?? "")
  return ""
}

/** Drop tags and collapse whitespace; feeds put HTML in descriptions. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isoDate(s: string): string | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Only plain web links: a feed must not be able to plant javascript: or data: URLs. */
const webUrl = (s: string) => (/^https?:\/\//i.test(s.trim()) ? s.trim() : "")

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * RSS 2.0 (<rss><channel><item>) or Atom (<feed><entry>).
 * Google News titles end in " - Publisher"; that suffix is moved to sourceName.
 */
export function parseFeed(body: string, source: Source, fallbackSourceName: string | null = null): FoundItem[] {
  let doc: Record<string, unknown>
  try {
    doc = xml.parse(body) as Record<string, unknown>
  } catch {
    return []
  }
  const out: FoundItem[] = []

  const rss = doc.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  if (channel) {
    const channelTitle = text(channel.title) || fallbackSourceName
    for (const it of asArray(channel.item as Record<string, unknown>[])) {
      const url = webUrl(text(it.link)) || webUrl(text(it.guid))
      let title = stripHtml(text(it.title))
      if (!url || !title) continue
      let sourceName = text(it.source).trim() || null
      if (source === "google_news" && sourceName && title.endsWith(` - ${sourceName}`)) {
        title = title.slice(0, -(sourceName.length + 3))
      }
      sourceName ??= channelTitle
      const excerpt = stripHtml(text(it["content:encoded"]) || text(it.description))
      out.push({ source, url, title, excerpt: excerpt ? clip(excerpt, 600) : null, publishedAt: isoDate(text(it.pubDate)), sourceName })
    }
    return out
  }

  const feed = doc.feed as Record<string, unknown> | undefined
  if (feed) {
    const feedTitle = text(feed.title) || fallbackSourceName
    for (const e of asArray(feed.entry as Record<string, unknown>[])) {
      const links = asArray(e.link as Record<string, string>[])
      const link = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0]
      const url = webUrl(link?.["@_href"] ?? "")
      const title = stripHtml(text(e.title))
      if (!url || !title) continue
      const excerpt = stripHtml(text(e.summary) || text(e.content))
      out.push({
        source, url, title,
        excerpt: excerpt ? clip(excerpt, 600) : null,
        publishedAt: isoDate(text(e.published) || text(e.updated)),
        sourceName: feedTitle,
      })
    }
  }
  return out
}

// ------------------------------------------------------------------
// BODACC (Bulletin officiel des annonces civiles et commerciales)
// Records from the open-data API, dataset "annonces-commerciales".
// ------------------------------------------------------------------

// Annual-accounts filings are routine and say nothing new; skip them.
const SKIPPED_FAMILIES = new Set(["dpc"])

function parseJsonField(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object") return v as Record<string, unknown>
  if (typeof v !== "string" || !v.trim()) return null
  try {
    const parsed = JSON.parse(v)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Flatten the human-readable parts of a BODACC JSON field into one line. */
function describe(v: unknown): string {
  const obj = parseJsonField(v)
  if (!obj) return typeof v === "string" ? v : ""
  const parts: string[] = []
  const walk = (x: unknown) => {
    if (typeof x === "string" && x.trim()) parts.push(x.trim())
    else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === "object") Object.values(x).forEach(walk)
  }
  walk(obj)
  return parts.join(" · ")
}

export function bodaccUrl(id: string): string {
  return `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${encodeURIComponent(id)}`
}

/** API response ({ results: [...] }) → items, newest first, excluding routine filings. */
export function parseBodacc(body: unknown): FoundItem[] {
  const results = (body && typeof body === "object" ? (body as { results?: unknown }).results : null)
  if (!Array.isArray(results)) return []
  const out: FoundItem[] = []
  for (const r of results as Record<string, unknown>[]) {
    const id = typeof r.id === "string" ? r.id : null
    if (!id || SKIPPED_FAMILIES.has(String(r.familleavis ?? ""))) continue
    const family = String(r.familleavis_lib ?? r.familleavis ?? "Annonce")
    const kind = typeof r.typeavis_lib === "string" ? r.typeavis_lib : ""
    const company = typeof r.commercant === "string" ? r.commercant : ""
    const details = [describe(r.modificationsgenerales), describe(r.jugement), describe(r.acte), describe(r.radiationaurcs), describe(r.depot)]
      .filter(Boolean)
      .join(" · ")
    const date = typeof r.dateparution === "string" ? r.dateparution : ""
    out.push({
      source: "bodacc",
      url: (typeof r.url_complete === "string" && webUrl(r.url_complete)) || bodaccUrl(id),
      title: [`BODACC: ${family}`, kind && kind !== family ? kind : null, company || null].filter(Boolean).join(" – "),
      excerpt: details ? clip(details, 800) : null,
      publishedAt: isoDate(date),
      sourceName: "BODACC",
    })
  }
  return out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
}

/** "552 032 534" / "552032534" → "552032534", or null when it isn't 9 digits. */
export function normalizeSiren(s: string | null | undefined): string | null {
  const digits = (s ?? "").replace(/\D/g, "")
  return digits.length === 9 ? digits : null
}

// ------------------------------------------------------------------
// Pappers API v2 (api.pappers.fr): company search and company record.
// ------------------------------------------------------------------

export type PappersMatch = {
  siren: string
  name: string
  legalForm: string | null
  city: string | null
  createdOn: string | null   // YYYY-MM-DD
  nafCode: string | null
  activity: string | null
  capital: number | null
  closed: boolean
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
/** Pappers dates are YYYY-MM-DD; keep only well-formed ones. */
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

/** Public company page; a fragment after it keeps each event's URL unique. */
export function pappersUrl(siren: string, fragment?: string): string {
  return `https://www.pappers.fr/entreprise/${siren}${fragment ? `#${fragment}` : ""}`
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

/** /v2/recherche reply ({ resultats: [...] }) → companies, in Pappers' order. */
export function parsePappersSearch(body: unknown): PappersMatch[] {
  const results = body && typeof body === "object" ? (body as { resultats?: unknown }).resultats : null
  if (!Array.isArray(results)) return []
  const out: PappersMatch[] = []
  for (const r of results as Record<string, unknown>[]) {
    const siren = normalizeSiren(str(r.siren))
    const name = str(r.nom_entreprise) ?? str(r.denomination)
    if (!siren || !name) continue
    const siege = (r.siege && typeof r.siege === "object" ? r.siege : {}) as Record<string, unknown>
    out.push({
      siren,
      name,
      legalForm: str(r.forme_juridique),
      city: str(siege.ville),
      createdOn: day(r.date_creation),
      nafCode: str(r.code_naf),
      activity: str(r.libelle_code_naf),
      capital: num(r.capital),
      closed: r.entreprise_cessee === true,
    })
  }
  return out
}

/** What the next check compares against, kept in monitoring_state.pappers_seen. */
export type PappersSnapshot = { capital: number | null; closed: boolean }

/**
 * /v2/entreprise reply → events since `since` (YYYY-MM-DD): documents filed
 * (actes), new directors, and, compared with the previous snapshot, a change
 * of capital or the company closing. Annual accounts are routine and skipped,
 * as for BODACC.
 */
export function parsePappersCompany(
  body: unknown,
  since: string,
  previous: PappersSnapshot | null,
  today: string,
): { items: FoundItem[]; snapshot: PappersSnapshot } {
  const r = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const siren = normalizeSiren(str(r.siren)) ?? ""
  const company = str(r.nom_entreprise) ?? str(r.denomination) ?? siren
  const snapshot: PappersSnapshot = { capital: num(r.capital), closed: r.entreprise_cessee === true }
  const items: FoundItem[] = []
  if (!siren) return { items, snapshot }
  const item = (fragment: string, title: string, excerpt: string | null, date: string | null): FoundItem => ({
    source: "pappers",
    url: pappersUrl(siren, fragment),
    title: `Pappers: ${title} – ${company}`,
    excerpt: excerpt ? clip(excerpt, 800) : null,
    publishedAt: date ? `${date}T00:00:00.000Z` : null,
    sourceName: "Pappers",
  })

  for (const d of asArray(r.depots_actes as Record<string, unknown>[])) {
    const filed = day(d.date_depot)
    if (!filed || filed <= since) continue
    const actes = asArray(d.actes as Record<string, unknown>[])
    const types = [...new Set(actes.map((a) => str(a.type)).filter((t): t is string => Boolean(t)))]
    if (types.length && types.every((t) => /comptes annuels/i.test(t))) continue
    const decisions = actes.map((a) => str(a.decision)).filter(Boolean).join(" · ")
    const label = types.join(", ") || "Actes"
    items.push(item(`actes-${filed}-${slug(label)}`, `Documents filed (${label})`, decisions || null, filed))
  }

  for (const p of asArray(r.representants as Record<string, unknown>[])) {
    const started = day(p.date_prise_de_poste)
    if (!started || started <= since || p.actuel === false) continue
    const who = str(p.nom_complet) ?? str(p.denomination) ?? str(p.nom)
    if (!who) continue
    const role = str(p.qualite)
    items.push(item(`dirigeant-${started}-${slug(who)}`, `New ${role ?? "director"}`, `${who}${role ? `, ${role}` : ""}, since ${started}`, started))
  }

  if (previous) {
    if (snapshot.capital != null && previous.capital != null && snapshot.capital !== previous.capital) {
      items.push(item(`capital-${snapshot.capital}`, "Share capital changed",
        `Share capital changed from ${previous.capital} € to ${snapshot.capital} € (seen ${today})`, today))
    }
    if (snapshot.closed && !previous.closed) {
      const closedOn = day(r.date_cessation)
      items.push(item(`cessation-${closedOn ?? today}`, "Company closed", `Registered as closed${closedOn ? ` on ${closedOn}` : ""}`, closedOn ?? today))
    }
  }
  return { items: items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")), snapshot }
}

// ------------------------------------------------------------------
// Pappers webhooks: what Pappers sends when a watched company changes
// ("notifications.entreprises") or when a saved search ("veille") gains,
// loses or sees changes in companies ("notifications.veille").
// ------------------------------------------------------------------

/** "2024-01-01", "2024-01-01 00:00:00" or "03/05/2019" → "2024-01-01". */
function anyDay(v: unknown): string | null {
  if (typeof v !== "string") return null
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(v)
  if (iso) return iso[1]
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim())
  return fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : null
}

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const list = (v: unknown) => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => x !== null) : [])
/** A value that may be a string, a number, or a list of strings. */
const words = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).join(" ") : typeof v === "number" ? String(v) : str(v) ?? "")
const euros = (n: unknown) => (typeof n === "number" ? `${n.toLocaleString("en-GB")} €` : null)

function personName(p: Record<string, unknown>): string | null {
  const person = [words(p.prenom), words(p.nom)].filter(Boolean).join(" ")
  return person || str(p.denomination)
}

function address(a: Record<string, unknown>): string | null {
  return [str(a.adresse_ligne_1), [str(a.code_postal), str(a.ville)].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null
}

/** One watched company's changes → items. Routine or BODACC-covered changes are left out. */
function pappersChanges(siren: string, company: string, e: Record<string, unknown>): FoundItem[] {
  const items: FoundItem[] = []
  const add = (fragment: string, title: string, excerpt: string | null, date: string | null) => {
    items.push({
      source: "pappers",
      url: pappersUrl(siren, fragment),
      title: `Pappers: ${title} – ${company}`,
      excerpt: excerpt ? clip(excerpt, 800) : null,
      publishedAt: date ? `${date}T00:00:00.000Z` : null,
      sourceName: "Pappers",
    })
  }
  const change = (key: string) => obj(e[key])
  const fromTo = (c: Record<string, unknown>, fmt: (v: unknown) => string | null = (v) => words(v) || null) => {
    const now = fmt(c.valeur)
    const before = fmt(c.ancienne_valeur)
    return before ? `From ${before} to ${now ?? "?"}` : now ? `Now ${now}` : null
  }

  const capital = change("capital")
  if (capital && typeof capital.valeur === "number") {
    add(`capital-${capital.valeur}`, "Share capital changed", fromTo(capital, euros), anyDay(capital.date))
  }
  const name = change("nom_entreprise")
  if (name && str(name.valeur) && name.ancienne_valeur !== undefined) {
    add(`nom-${anyDay(name.date)}-${slug(words(name.valeur))}`, "Company name changed", fromTo(name), anyDay(name.date))
  }
  const form = change("forme_juridique")
  if (form && str(form.valeur)) add(`forme-${anyDay(form.date)}-${slug(words(form.valeur))}`, "Legal form changed", fromTo(form), anyDay(form.date))
  const hq = change("siege_social")
  if (hq) add(`siege-${anyDay(hq.date)}-${words(hq.valeur)}`, "Head office moved", address(hq), anyDay(hq.date))
  const purpose = change("objet_social")
  if (purpose && str(purpose.valeur)) {
    add(`objet-${anyDay(purpose.date)}`, "Stated business purpose changed", `Now: ${words(purpose.valeur)}`, anyDay(purpose.date))
  }
  const closed = change("entreprise_cessee")
  if (closed?.valeur === true) add(`cessation-${anyDay(closed.date)}`, "Company closed", "Registered as closed", anyDay(closed.date))
  const rcs = change("statut_rcs")
  if (rcs && /radi/i.test(words(rcs.valeur))) add(`radiation-${anyDay(rcs.date)}`, "Removed from the trade register", `RCS status: ${words(rcs.valeur)}`, anyDay(rcs.date))

  for (const a of list(e.nouvel_acte_publie)) {
    const acte = str(a.acte) ?? "Document"
    add(`acte-${anyDay(a.date)}-${slug(acte)}`, `Document filed: ${acte}`, acte, anyDay(a.date))
  }
  for (const a of list(e.nouveaux_statuts_publies)) {
    add(`statuts-${anyDay(a.date)}`, "Updated statutes filed", str(a.acte), anyDay(a.date))
  }
  for (const p of list(e.nouveau_dirigeant)) {
    const who = personName(p)
    if (who) add(`dirigeant-${anyDay(p.date)}-${slug(who)}`, `New director: ${who}`, `${who} joined the company's officers`, anyDay(p.date))
  }
  for (const p of list(e.dirigeant_partant)) {
    const who = personName(p)
    if (who) add(`depart-${anyDay(p.date)}-${slug(who)}`, `Director left: ${who}`, `${who} left the company's officers`, anyDay(p.date))
  }
  for (const p of list(e.qualite_dirigeant)) {
    const who = personName(p)
    if (who) add(`role-${anyDay(p.date)}-${slug(who)}-${slug(words(p.valeur))}`, `Officer role changed: ${who}`, `${who}: ${fromTo(p) ?? ""}`, anyDay(p.date))
  }
  for (const s of list(e.nouvel_etablissement)) {
    add(`etablissement-${anyDay(s.date)}-${words(s.siret)}`, "New establishment opened", address(s), anyDay(s.date))
  }
  for (const d of list(e.nouvelle_decision_justice)) {
    const court = str(d.juridiction) ?? "court"
    add(`justice-${words(d.id) || anyDay(d.date)}`, `Court decision (${court})`,
      [str(d.numero) && `Case ${str(d.numero)}`, str(d.position) && `position: ${str(d.position)}`].filter(Boolean).join(", ") || null, anyDay(d.date))
  }
  for (const b of list(e.nouvelle_annonce_procedure_collective_publiee)) {
    const kind = str(b.type_procedure_collective) ?? "Insolvency proceedings"
    add(`procedure-${anyDay(b.date)}-${words(b.numero_annonce)}`, kind, str(b.annonce), anyDay(b.date))
  }
  return items
}

export type PappersLead = { siren: string; name: string | null; isNew: boolean }

export type PappersWebhook = {
  event: string
  listId: string | null
  listName: string | null
  /** Changes to companies, by SIREN; only Radar startups' are used. */
  changes: { siren: string; items: FoundItem[] }[]
  /** Companies that newly match a saved search (veille). */
  leads: PappersLead[]
}

export function parsePappersWebhook(payload: unknown): PappersWebhook {
  const p = obj(payload) ?? {}
  const d = obj(p.donnees) ?? {}
  const event = str(p.evenement) ?? ""
  const out: PappersWebhook = { event, listId: words(d.id_list) || null, listName: str(d.nom_list), changes: [], leads: [] }
  const companies = event === "notifications.entreprises" ? list(d.entreprises) : event === "notifications.veille" ? list(d.siren_modifie) : []
  for (const e of companies) {
    const siren = normalizeSiren(words(e.siren))
    if (!siren) continue
    const name = str(obj(e.details_entreprise)?.nom_entreprise) ?? (words(obj(e.nom_entreprise)?.valeur) || str(e.nom_entreprise)) ?? siren
    out.changes.push({ siren, items: pappersChanges(siren, name, e) })
  }
  if (event === "notifications.veille") {
    for (const e of list(d.siren_entrant)) {
      const siren = normalizeSiren(words(e.siren))
      if (siren) out.leads.push({ siren, name: str(e.nom_entreprise), isNew: e.nouvelle_entreprise === true })
    }
  }
  return out
}
