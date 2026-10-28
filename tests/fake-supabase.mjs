// A small in-memory stand-in for the Supabase client: enough of the query
// builder (select/insert/update/upsert/delete, eq/is/ilike/in, single) to run
// the import's write path. `failOn` makes inserts into one table fail.
export function fakeSupabase(seed = {}, { failOn } = {}) {
  const tables = structuredClone(seed)
  let nextId = 1
  const rows = (t) => (tables[t] ??= [])

  function query(table) {
    const filters = []
    let op = "select", payload = null, onConflict = null, ignoreDuplicates = false, mode = "many"
    const like = (pattern, v) => new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i").test(String(v ?? ""))
    const matches = (r) => filters.every(([k, f, v]) => (f === "eq" ? r[k] === v : f === "is" ? (r[k] ?? null) === v : f === "in" ? v.includes(r[k]) : like(v, r[k])))
    const run = () => {
      if (op === "insert" && failOn === table) return { data: null, error: { message: `insert into ${table} failed` } }
      let data
      if (op === "insert" || op === "upsert") {
        const list = (Array.isArray(payload) ? payload : [payload]).flatMap((p) => {
          if (op === "upsert" && onConflict) {
            const hit = rows(table).find((r) => r[onConflict] === p[onConflict])
            if (hit) return ignoreDuplicates ? [] : [Object.assign(hit, p)]
          }
          const row = { id: `${table}-${nextId++}`, ...p }
          rows(table).push(row)
          return [row]
        })
        data = list
      } else if (op === "update") {
        data = rows(table).filter(matches).map((r) => Object.assign(r, payload))
      } else if (op === "delete") {
        data = rows(table).filter(matches)
        tables[table] = rows(table).filter((r) => !matches(r))
      } else {
        data = rows(table).filter(matches)
      }
      if (mode === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "not exactly one row" } }
      if (mode === "maybe") return { data: data[0] ?? null, error: null }
      return { data, error: null }
    }
    const b = {
      select() { return b }, order() { return b }, limit() { return b },
      insert(p) { op = "insert"; payload = p; return b },
      upsert(p, o) { op = "upsert"; payload = p; onConflict = o?.onConflict ?? null; ignoreDuplicates = Boolean(o?.ignoreDuplicates); return b },
      update(p) { op = "update"; payload = p; return b },
      delete() { op = "delete"; return b },
      eq(k, v) { filters.push([k, "eq", v]); return b },
      is(k, v) { filters.push([k, "is", v]); return b },
      in(k, v) { filters.push([k, "in", v]); return b },
      ilike(k, v) { filters.push([k, "ilike", v]); return b },
      single() { mode = "single"; return b },
      maybeSingle() { mode = "maybe"; return b },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
    }
    return b
  }
  return { client: { from: query }, tables }
}
