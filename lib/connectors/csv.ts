// A small CSV reader for open-data exports: handles quoted fields (with
// commas, semicolons, doubled quotes and line breaks inside), a byte-order
// mark, and guesses the delimiter (Opendatasoft exports use ";").

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "")
  const firstLine = src.slice(0, src.search(/\r?\n|$/))
  const delimiter = [";", ",", "\t"].sort((a, b) => count(firstLine, b) - count(firstLine, a))[0]

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"' && field === "") quoted = true
    else if (c === delimiter) { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.some((v) => v !== "")) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((v) => v !== "")) rows.push(row)

  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map(normalizeKey)
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()])))
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1
}

/** "Lien vers theses.fr" → "lien_vers_theses_fr" (also how Opendatasoft names fields). */
export function normalizeKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}
