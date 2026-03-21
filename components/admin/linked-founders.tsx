"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type LinkedFounder = {
  id: string
  name: string
  slug: string | null
  role: string | null
}

type AllFounder = {
  id: string
  name: string
  slug: string | null
  role: string | null
}

interface Props {
  startupId: string
  linkedFounders: LinkedFounder[]
  allFounders: AllFounder[]
}

export function LinkedFounders({ startupId, linkedFounders: initial, allFounders }: Props) {
  const router = useRouter()
  const [linked, setLinked] = useState<LinkedFounder[]>(initial)
  const [selectedId, setSelectedId] = useState("")
  const [linkRole, setLinkRole] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlinkedFounders = allFounders.filter((f) => !linked.some((l) => l.id === f.id))

  async function addLink() {
    if (!selectedId) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/startups/${startupId}/founders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ founder_id: selectedId, role: linkRole || null }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to link founder.")
      setLoading(false)
      return
    }

    const founder = allFounders.find((f) => f.id === selectedId)!
    setLinked((prev) => [...prev, { id: founder.id, name: founder.name, slug: founder.slug, role: linkRole || null }])
    setSelectedId("")
    setLinkRole("")
    setLoading(false)
    router.refresh()
  }

  async function removeLink(founderId: string) {
    setLoading(true)
    await fetch(`/api/admin/startups/${startupId}/founders?founder_id=${founderId}`, { method: "DELETE" })
    setLinked((prev) => prev.filter((f) => f.id !== founderId))
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <Separator className="mb-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Linked Founders
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/founders/new">+ Create new founder</Link>
        </Button>
      </div>

      {/* Existing links */}
      {linked.length > 0 ? (
        <div className="mb-4 space-y-2">
          {linked.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{f.name}</p>
                {f.role && <p className="text-[11px] text-muted-foreground">{f.role}</p>}
              </div>
              <div className="flex items-center gap-2">
                {f.slug && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/founders/${f.id}/edit`}>Edit founder</Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[12px] text-muted-foreground hover:text-destructive"
                  onClick={() => removeLink(f.id)}
                  disabled={loading}
                >
                  Unlink
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted-foreground">No founders linked yet.</p>
      )}

      {/* Link existing founder */}
      {unlinkedFounders.length > 0 && (
        <div className="flex gap-2">
          <Select
            className="flex-1 text-[13px]"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Select a founder to link —</option>
            {unlinkedFounders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
          <Input
            className="w-48 text-[13px]"
            value={linkRole}
            onChange={(e) => setLinkRole(e.target.value)}
            placeholder="Role at this startup"
          />
          <Button type="button" variant="outline" onClick={addLink} disabled={!selectedId || loading}>
            Link
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
