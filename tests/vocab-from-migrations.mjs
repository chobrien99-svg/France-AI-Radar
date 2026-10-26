// Builds an ImportVocab (lib/startup-import.ts) from the taxonomy migrations,
// so tests check drafts against the same terms the database is seeded with.
import { readFileSync, readdirSync } from "node:fs"

const dir = new URL("../supabase/migrations/", import.meta.url)
const sql = readdirSync(dir).filter((f) => f.includes("technical_taxonomy")).sort().map((f) => readFileSync(new URL(f, dir), "utf8"))

const q = String.raw`'((?:[^']|'')*)'`
const val = String.raw`(?:${q}|NULL)`

export function vocabFromMigrations() {
  const terms = new Map()
  const termRe = new RegExp(String.raw`^\s*\(${q}, ${q}, '(specialization|method|modality|domain)', ${val}, \d+, ${val}\)`, "gm")
  for (const s of sql) for (const m of s.matchAll(termRe)) terms.set(m[1], { id: `t:${m[1]}`, slug: m[1], label: m[2], facet: m[3], aliases: [], isActive: true })

  const deleted = new Set([...(sql[1] ?? "").split("DELETE FROM technical_term_aliases")[1]?.split(");")[0].matchAll(/'([^']+)'/g) ?? []].map((m) => m[1]))
  for (const s of sql) {
    const block = s.split("INSERT INTO technical_term_aliases")[1]?.split(") AS a(slug, alias)")[0] ?? ""
    for (const m of block.matchAll(new RegExp(String.raw`\(${q}, ${q}\)`, "g"))) {
      if (!deleted.has(m[2].toLowerCase())) terms.get(m[1]).aliases.push(m[2])
    }
  }

  const layerBlock = sql[0].split("Seed: primary layers")[1].split("ON CONFLICT")[0]
  const layers = [...layerBlock.matchAll(new RegExp(String.raw`\(${q}, ${q}, ${q}, \d+\)`, "g"))].map((m) => ({ id: `l:${m[1]}`, slug: m[1], label: m[2], isActive: true }))

  const sectors = ["TechBio", "HealthTech", "Artificial Intelligence", "Cybersecurity"].map((name) => ({ id: `s:${name}`, name }))
  return { layers, terms: [...terms.values()], sectors }
}
