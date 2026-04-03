"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type LinkedPerson = {
  id: string
  full_name: string
  slug: string | null
  role: string | null
}

type AllPerson = {
  id: string
  full_name: string
  slug: string | null
  role: string | null
}

interface Props {
  organizationId: string
  linkedPeople: LinkedPerson[]
  allPeople: AllPerson[]
}

export function LinkedFounders({ organizationId, linkedPeople: initial, allPeople }: Props) {
  const router = useRouter()
  const [linked, setLinked] = useState<LinkedPerson[]>(initial)
  const [selectedId, setSelectedId] = useState("")
  const [linkRole, setLinkRole] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlinkedPeople = allPeople.filter((f) => !linked.some((l) => l.id === f.id))

  async function addLink() {
    if (!selectedId) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/organizations/${organizationId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: selectedId, role: linkRole || null }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to link person.")
      setLoading(false)
      return
    }

    const person = allPeople.find((f) => f.id === selectedId)!
    setLinked((prev) => [...prev, { id: person.id, full_name: person.full_name, slug: person.slug, role: linkRole || null }])
    setSelectedId("")
    setLinkRole("")
    setLoading(false)
    router.refresh()
  }

  async function removeLink(personId: string) {
    setLoading(true)
    await fetch(`/api/admin/organizations/${organizationId}/people?person_id=${personId}`, { method: "DELETE" })
    setLinked((prev) => prev.filter((f) => f.id !== personId))
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <Separator className="mb-6" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Linked People
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/people/new">+ Create new person</Link>
        </Button>
      </div>

      {/* Existing links */}
      {linked.length > 0 ? (
        <div className="mb-4 space-y-2">
          {linked.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{f.full_name}</p>
                {f.role && <p className="text-[11px] text-muted-foreground">{f.role}</p>}
              </div>
              <div className="flex items-center gap-2">
                {f.slug && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/people/${f.id}/edit`}>Edit person</Link>
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
        <p className="mb-4 text-[13px] text-muted-foreground">No people linked yet.</p>
      )}

      {/* Link existing founder */}
      {unlinkedPeople.length > 0 && (
        <div className="flex gap-2">
          <Select
            className="flex-1 text-[13px]"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Select a person to link —</option>
            {unlinkedPeople.map((f) => (
              <option key={f.id} value={f.id}>{f.full_name}</option>
            ))}
          </Select>
          <Input
            className="w-48 text-[13px]"
            value={linkRole}
            onChange={(e) => setLinkRole(e.target.value)}
            placeholder="Role at this organization"
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
