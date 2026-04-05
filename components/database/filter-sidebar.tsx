"use client"

import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { canUseAdvancedFilters, SIGNAL_TYPE_LABELS } from "@/lib/subscription"

const TIME_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
]

const LOCATION_OPTIONS = [
  { value: "paris", label: "Paris / Île-de-France" },
  { value: "lyon", label: "Lyon" },
  { value: "toulouse", label: "Toulouse" },
  { value: "grenoble", label: "Grenoble" },
  { value: "other", label: "Other" },
]

function parseParam(value: string | null): string[] {
  if (!value) return []
  return value.split(",").filter(Boolean)
}

export function FilterSidebar({ tier = "free" }: { tier?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const advancedAllowed = canUseAdvancedFilters(tier)

  const selected = {
    time: parseParam(searchParams.get("time")),
    signalType: parseParam(searchParams.get("signalType")),
    location: parseParam(searchParams.get("location")),
  }

  const update = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (values.length > 0) {
        params.set(key, values.join(","))
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  function toggle(key: string, current: string[], value: string) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    update(key, next)
  }

  function reset() {
    router.replace(pathname, { scroll: false })
  }

  return (
    <aside className="sidebar-surface sticky top-20 max-h-[calc(100vh-88px)] overflow-y-auto p-5">
      <div className="mb-4">
        <p className="section-kicker">Filters</p>
        <h2 className="section-title mt-1">Narrow the radar</h2>
      </div>

      <div className="space-y-5">
        {/* Time Period — available to all */}
        <FilterGroup
          label="Time Period"
          options={TIME_OPTIONS}
          selected={selected.time}
          onToggle={(v) => toggle("time", selected.time, v)}
        />

        <Separator />

        {/* Signal Type — Pro only */}
        {advancedAllowed ? (
          <FilterGroup
            label="Signal Type"
            options={Object.entries(SIGNAL_TYPE_LABELS).map(
              ([value, label]) => ({ value, label })
            )}
            selected={selected.signalType}
            onToggle={(v) => toggle("signalType", selected.signalType, v)}
          />
        ) : (
          <LockedFilter label="Signal Type" />
        )}

        <Separator />

        {/* Location — Pro only */}
        {advancedAllowed ? (
          <FilterGroup
            label="Location"
            options={LOCATION_OPTIONS}
            selected={selected.location}
            onToggle={(v) => toggle("location", selected.location, v)}
          />
        ) : (
          <LockedFilter label="Location" />
        )}
      </div>

      <div className="mt-5">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={reset}
        >
          Reset Filters
        </Button>
      </div>
    </aside>
  )
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div>
      <p className="metric-label mb-2">{label}</p>
      <div className="space-y-0.5">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[13px] text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            <input
              type="checkbox"
              className="h-[15px] w-[15px] accent-primary"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function LockedFilter({ label }: { label: string }) {
  return (
    <div>
      <p className="metric-label mb-2">{label}</p>
      <div className="border-l-2 border-l-primary/30 bg-accent px-3 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          Professional plan required
        </p>
        <Link
          href="/pricing"
          className="text-[12px] font-medium text-primary transition-colors duration-300 hover:text-primary-container"
        >
          Upgrade to unlock →
        </Link>
      </div>
    </div>
  )
}
