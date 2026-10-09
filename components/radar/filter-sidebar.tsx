"use client"

import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Events } from "@/lib/analytics"

export type FilterGroupDef = {
  key: string
  label: string
  options: { value: string; label: string; n: number }[]
  locked?: boolean
}

/** Keys that are view settings rather than filters — kept on reset */
const KEEP_ON_RESET = ["tab", "view", "sort"]

export function FilterSidebarV2({ groups }: { groups: FilterGroupDef[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean)
  const anyFilter = Array.from(searchParams.keys()).some((k) => !KEEP_ON_RESET.includes(k))

  function go(params: URLSearchParams) {
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function toggle(key: string, value: string) {
    const cur = selected(key)
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
    const params = new URLSearchParams(searchParams.toString())
    if (next.length) params.set(key, next.join(","))
    else params.delete(key)
    go(params)
  }

  function reset() {
    const params = new URLSearchParams()
    for (const k of KEEP_ON_RESET) {
      const v = searchParams.get(k)
      if (v) params.set(k, v)
    }
    go(params)
  }

  return (
    <aside className="r2-filters">
      <div className="r2-f-head">
        <span className="r2-f-title">Filters</span>
        {anyFilter && <button type="button" className="r2-f-reset" onClick={reset}>Reset</button>}
      </div>
      {groups.map((g) => (
        <div key={g.key} className="r2-f-group">
          <div className="r2-f-label">{g.label}</div>
          {g.locked ? (
            <div className="r2-f-lock">
              Professional plan required.{" "}
              <Link
                href="/pricing"
                className="r2-f-reset"
                onClick={() => Events.upgradeClicked(`locked_filter_${g.key}`)}
              >
                Upgrade →
              </Link>
            </div>
          ) : g.options.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nothing to filter yet.</p>
          ) : (
            g.options.map((o) => (
              <label key={o.value} className="r2-f-opt">
                <input
                  type="checkbox"
                  className="r2-check"
                  checked={selected(g.key).includes(o.value)}
                  onChange={() => toggle(g.key, o.value)}
                />
                <span>{o.label}</span>
                <span className="n">{o.n}</span>
              </label>
            ))
          )}
        </div>
      ))}
    </aside>
  )
}
