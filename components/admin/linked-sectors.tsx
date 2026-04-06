"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type SectorLink = {
  id: string
  sector_name: string
  is_primary: boolean
}

type SectorOption = {
  id: string
  name: string
}

interface Props {
  organizationId: string
  sectors: SectorLink[]
  allSectors: SectorOption[]
}

export function LinkedSectors({ organizationId, sectors: initial, allSectors }: Props) {
  const router = useRouter()
  const [sectors, setSectors] = useState<SectorLink[]>(initial)
  const [selectedId, setSelectedId] = useState("")
  const [newSectorName, setNewSectorName] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlinkedSectors = allSectors.filter((s) => !sectors.some((l) => l.sector_name === s.name))

  async function addSector() {
    const sectorName = selectedId
      ? allSectors.find((s) => s.id === selectedId)?.name
      : newSectorName.trim()

    if (!sectorName) return
    setLoading(true)
    setError(null)

    const payload = selectedId
      ? { sector_id: selectedId, is_primary: isPrimary }
      : { sector_name: sectorName, is_primary: isPrimary }

    const res = await fetch(`/api/admin/startups/${organizationId}/sectors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to link sector.")
      setLoading(false)
      return
    }

    const data = await res.json()
    setSectors((prev) => [...prev, { id: data.id, sector_name: sectorName, is_primary: isPrimary }])
    setSelectedId("")
    setNewSectorName("")
    setIsPrimary(false)
    setLoading(false)
    router.refresh()
  }

  async function removeSector(linkId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${organizationId}/sectors?link_id=${linkId}`, { method: "DELETE" })
    setSectors((prev) => prev.filter((s) => s.id !== linkId))
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <Separator className="my-6" />
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Sectors
        </p>
      </div>

      {sectors.length > 0 ? (
        <div className="mb-4 space-y-2">
          {sectors.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 border-l-2 border-l-border bg-card p-3">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-foreground">{s.sector_name}</p>
                {s.is_primary && (
                  <span className="badge-signal badge-signal-positive text-[10px]">Primary</span>
                )}
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-[12px] text-muted-foreground hover:text-destructive"
                onClick={() => removeSector(s.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No sectors assigned yet.</p>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          {unlinkedSectors.length > 0 ? (
            <Select
              className="flex-1 text-[13px]"
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setNewSectorName("") }}
            >
              <option value="">— Select existing sector —</option>
              {unlinkedSectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          ) : (
            <Input
              className="flex-1 text-[13px]"
              placeholder="New sector name"
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
            />
          )}
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-4 w-4 accent-primary" />
            Primary
          </label>
          <Button type="button" variant="outline" onClick={addSector} disabled={(!selectedId && !newSectorName.trim()) || loading}>
            Add
          </Button>
        </div>
        {unlinkedSectors.length > 0 && (
          <Input
            className="text-[13px]"
            placeholder="Or type a new sector name"
            value={newSectorName}
            onChange={(e) => { setNewSectorName(e.target.value); setSelectedId("") }}
          />
        )}
      </div>

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
