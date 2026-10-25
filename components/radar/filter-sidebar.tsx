"use client"

import { Fragment } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Events } from "@/lib/analytics"

export type FilterGroupDef = {
  key: string
  label: string
  /** `section` starts a sub-heading (options arrive grouped); `hint` is a hover tooltip; no `n` hides the count */
  options: { value: string; label: string; n?: number; section?: string; hint?: string }[]
  locked?: boolean
}

/** Fired on Reset so the search box can drop keystrokes not yet written to the URL */
export const FILTERS_RESET_EVENT = "radar:filters-reset"

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
    window.dispatchEvent(new Event(FILTERS_RESET_EVENT))
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
            g.options.map((o, i) => (
              <Fragment key={o.value}>
                {o.section && o.section !== g.options[i - 1]?.section && (
                  <div className="r2-f-sub">{o.section}</div>
                )}
                <label className="r2-f-opt" title={o.hint}>
                  <input
                    type="checkbox"
                    className="r2-check"
                    checked={selected(g.key).includes(o.value)}
                    onChange={() => toggle(g.key, o.value)}
                  />
                  <span>{o.label}</span>
                  {o.n !== undefined && <span className="n">{o.n}</span>}
                </label>
              </Fragment>
            ))
          )}
        </div>
      ))}
    </aside>
  )
}
