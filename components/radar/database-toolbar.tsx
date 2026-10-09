"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Icon } from "./icons"
import { ExportButton } from "@/components/database/export-button"
import { SORTS } from "@/lib/radar"

export function DatabaseSearch({ tab, defaultValue }: { tab: "startups" | "founders"; defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "/" jumps to the search box
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? "") && !el?.isContentEditable) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (v.trim()) params.set("q", v.trim())
      else params.delete("q")
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
    }, 250)
  }

  return (
    <label className="r2-search">
      <Icon name="search" size={18} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={onChange}
        aria-label={tab === "startups" ? "Search startups" : "Search founders"}
        placeholder={tab === "startups" ? "Startups, sectors, founders…" : "Founders, roles, companies…"}
      />
      <span className="r2-kbd" aria-hidden="true">/</span>
    </label>
  )
}

export function DatabaseToolbar({
  tab,
  shown,
  total,
  sort,
  view,
  shortlist,
  savedCount,
  canShortlist,
  canExport,
}: {
  tab: "startups" | "founders"
  shown: number
  total: number
  sort: string
  view: "grid" | "list"
  shortlist: boolean
  savedCount: number
  canShortlist: boolean
  canExport: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="r2-toolbar">
      <span className="r2-count">
        Showing <b>{shown}</b> of <b>{total}</b> {tab}
      </span>
      <div className="r2-tools">
        {tab === "startups" && canShortlist && (
          <button type="button" className="r2-chip" aria-pressed={shortlist} onClick={() => set("shortlist", shortlist ? null : "1")}>
            <Icon name={shortlist ? "star-on" : "star"} size={13} /> Shortlist · {savedCount}
          </button>
        )}
        <select className="r2-select" aria-label="Sort" value={sort} onChange={(e) => set("sort", e.target.value === "latest" ? null : e.target.value)}>
          {SORTS[tab].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="r2-seg" role="group" aria-label="Layout">
          <button type="button" aria-current={view === "list"} onClick={() => set("view", "list")} title="List"><Icon name="list" /></button>
          <button type="button" aria-current={view === "grid"} onClick={() => set("view", null)} title="Grid"><Icon name="grid" size={14} /></button>
        </div>
        {tab === "startups" && <ExportButton canExport={canExport} className="r2-chip" />}
      </div>
    </div>
  )
}
