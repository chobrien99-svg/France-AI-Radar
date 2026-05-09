"use client"

import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { canUseAdvancedFilters } from "@/lib/subscription"
import { Events } from "@/lib/analytics"

const TIME_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
]

function parseParam(value: string | null): string[] {
  if (!value) return []
  return value.split(",").filter(Boolean)
}

type FilterOption = { value: string; label: string }

interface Props {
  tier?: string
  sectorOptions?: FilterOption[]
  locationOptions?: FilterOption[]
}

export function FilterSidebar({ tier = "explorer", sectorOptions = [], locationOptions = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const advancedAllowed = canUseAdvancedFilters(tier)

  const selected = {
    time: parseParam(searchParams.get("time")),
    sector: parseParam(searchParams.get("sector")),
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

        {/* Sector — Pro only */}
        {advancedAllowed ? (
          sectorOptions.length > 0 ? (
            <FilterGroup
              label="Sector"
              options={sectorOptions}
              selected={selected.sector}
              onToggle={(v) => toggle("sector", selected.sector, v)}
            />
          ) : (
            <div>
              <p className="metric-label mb-2">Sector</p>
              <p className="text-[12px] text-muted-foreground">No sectors assigned yet.</p>
            </div>
          )
        ) : (
          <LockedFilter label="Sector" />
        )}

        <Separator />

        {/* Location — Pro only */}
        {advancedAllowed ? (
          locationOptions.length > 0 ? (
            <FilterGroup
              label="Location"
              options={locationOptions}
              selected={selected.location}
              onToggle={(v) => toggle("location", selected.location, v)}
            />
          ) : (
            <div>
              <p className="metric-label mb-2">Location</p>
              <p className="text-[12px] text-muted-foreground">No locations available.</p>
            </div>
          )
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
  options: FilterOption[]
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
          onClick={() => Events.upgradeClicked(`locked_filter_${label.toLowerCase()}`)}
          className="text-[12px] font-medium text-primary transition-colors duration-300 hover:text-primary-container"
        >
          Upgrade to unlock →
        </Link>
      </div>
    </div>
  )
}
