// i-PhD innovation competition laureates (Ministry of Higher Education and
// Research, with Bpifrance). PhD students and young doctors who plan to start
// a deeptech company: pre-company projects by definition.
// Licence Ouverte 2.0. About 300 rows, updated after each yearly edition, so
// each run reads the whole file.
import { parseCsv } from "@/lib/connectors/csv"
import type { CandidateDraft, FetchLike, NormalizedItem, SourceAdapter, SubjectDraft } from "@/lib/connectors/types"

const DATASET = "fr-esr-laureats-concours-i-phd"
export const IPHD_EXPORT_URL =
  `https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/${DATASET}/exports/csv?use_labels=true&delimiter=%3B`
const DATASET_PAGE = `https://data.enseignementsup-recherche.gouv.fr/explore/dataset/${DATASET}/table/`

/** Columns kept. Gender (code_sexe, sexe) and row numbers are left out on purpose. */
const KEEP = [
  "millesime", "edition", "resultat", "prenom", "nom", "prenom_nom",
  "acronyme_du_projet", "resume_du_projet",
  "idref", "lien_idref", "lien_scanr_auteur", "numero_national_de_these", "lien_vers_theses_fr",
  "region", "structure_de_transfert_de_technologie", "code_structure_de_transfert_de_technologie",
  "incubateur", "code_incubateur", "laboratoire", "code_laboratoire", "etablissement", "secteur",
  "id_structure_paysage", "id_paysage",
] as const

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "")
const slugPart = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function personName(p: Record<string, string>) {
  return clean(p.prenom_nom) || [clean(p.prenom), clean(p.nom)].filter(Boolean).join(" ")
}

export const iphdAdapter: SourceAdapter = {
  slug: "esr-iphd",

  async fetchItems(fetchImpl: FetchLike) {
    const res = await fetchImpl(IPHD_EXPORT_URL, { headers: { Accept: "text/csv" } })
    if (!res.ok) throw new Error(`i-PhD export answered ${res.status}`)
    const items = parseCsv(await res.text())
    if (items.length === 0) throw new Error("i-PhD export was empty")
    if (!("acronyme_du_projet" in items[0]) || !("millesime" in items[0])) {
      throw new Error(`i-PhD export columns changed: ${Object.keys(items[0]).slice(0, 8).join(", ")}…`)
    }
    return { items, cursor: { rows: items.length } }
  },

  normalize(raw) {
    const payload: Record<string, string> = {}
    for (const k of KEEP) {
      const v = clean(raw[k])
      if (v) payload[k] = v
    }
    const year = Number.parseInt(payload.millesime ?? "", 10)
    const project = payload.acronyme_du_projet ?? ""
    const person = personName(payload)
    if (!Number.isFinite(year) || !project || !person) {
      throw new Error("missing year, project name or laureate name")
    }
    payload.prenom_nom = person
    return {
      // Year + project + laureate: stable across re-publications of the file.
      externalId: `${year}:${slugPart(project)}:${slugPart(person)}`,
      url: `${DATASET_PAGE}?q=${encodeURIComponent(project)}`,
      title: `${project} (i-PhD ${year})`,
      payload,
      eventDate: null,      // the dataset gives the edition year, not a date
      editionYear: year,
      publishedAt: null,
    }
  },

  toCandidate(item: NormalizedItem): CandidateDraft {
    const p = item.payload as Record<string, string | undefined>
    const year = item.editionYear
    const project = p.acronyme_du_projet!
    const person = p.prenom_nom!
    const result = p.resultat ?? "Lauréat"

    const subjects: SubjectDraft[] = [{
      role: "person",
      name: person,
      affiliation: p.laboratoire ?? p.etablissement ?? null,
      identifiers: compact({ theses_fr: p.numero_national_de_these, idref: p.idref }),
    }]
    if (p.laboratoire) {
      subjects.push({
        role: "lab",
        name: p.laboratoire,
        affiliation: p.etablissement ?? null,
        identifiers: compact({ rnsr: p.code_laboratoire, paysage: p.id_structure_paysage }),
      })
    }
    for (const inst of splitList(p.etablissement).slice(0, 4)) {
      subjects.push({ role: "institution", name: inst, affiliation: null, identifiers: {} })
    }
    const support = new Map<string, Record<string, string>>()
    if (p.structure_de_transfert_de_technologie) support.set(p.structure_de_transfert_de_technologie, compact({ siren: p.code_structure_de_transfert_de_technologie }))
    if (p.incubateur && !support.has(p.incubateur)) support.set(p.incubateur, compact({ code: p.code_incubateur }))
    for (const [name, identifiers] of support) subjects.push({ role: "support", name, affiliation: null, identifiers })

    return {
      sourceKey: `esr-iphd:${item.externalId}`,
      kind: "project",
      title: project,
      summary: p.resume_du_projet ?? null,
      relevanceText: [project, p.resume_du_projet, p.secteur].filter(Boolean).join("\n"),
      whySurfaced: `i-PhD ${year} laureate (${result})${p.secteur ? `, sector: ${p.secteur}` : ""}.`,
      evidenceFamily: `esr-iphd:${item.externalId}`,
      evidenceConfidence: 0.9,   // official government dataset
      firstEvidenceDate: null,
      project: {
        name: project,
        summary: p.resume_du_projet ?? null,
        sector: p.secteur ?? null,
        commercializationStatus: "awarded",
      },
      award: {
        awardType: "competition",
        title: `i-PhD ${year ?? ""}`.trim(),
        programName: "i-PhD",
        programSlug: "i-phd",
        category: result,
        editionYear: year,
        awardDate: null,
        funderName: "Bpifrance / Ministère de l'Enseignement supérieur et de la Recherche",
      },
      subjects,
    }
  },
}

function compact(o: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => !!e[1]))
}

/** "Université de Toulouse,Centre National de la Recherche Scientifique (CNRS)" → two names. */
function splitList(v: string | undefined): string[] {
  if (!v) return []
  return v.split(/\s*,\s*(?=[A-ZÀ-Ý])/).map((s) => s.trim()).filter((s) => s.length > 2)
}
